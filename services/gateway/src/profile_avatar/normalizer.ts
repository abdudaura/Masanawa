import { createHash } from "node:crypto";
import sharp from "sharp";

/** The only encoding stored and served as a public Masanawa profile image. */
export interface NormalizedProfileAvatar {
  readonly bytes: Buffer;
  readonly mediaType: "image/webp";
  readonly sha256: string;
  readonly width: 512;
  readonly height: 512;
}

export class ProfileAvatarError extends Error {
  constructor(
    readonly code:
      | "profile.avatar.invalid_image"
      | "profile.avatar.unsupported_format"
      | "profile.avatar.invalid_dimensions"
      | "profile.avatar.too_large",
    readonly statusCode: 400 | 413 | 415,
  ) {
    super(code);
    this.name = "ProfileAvatarError";
  }
}

const INPUT_LIMIT_BYTES = 2 * 1024 * 1024;
const OUTPUT_LIMIT_BYTES = 512 * 1024;
const PIXEL_LIMIT = 12_000_000;
const EDGE_LIMIT = 4096;
const MIN_EDGE = 64;
const INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

/**
 * Decode and re-encode untrusted user images in a resource-bounded decoder.
 *
 * Original bytes and EXIF, GPS, ICC and comment metadata are never persisted.
 * SVG, GIF, HEIC, AVIF, animated WebP and other active/container formats are
 * not accepted. No client MIME/header information authorizes a format.
 */
export async function normalizeProfileAvatar(input: Uint8Array): Promise<NormalizedProfileAvatar> {
  if (!(input instanceof Uint8Array) || input.byteLength === 0) {
    throw new ProfileAvatarError("profile.avatar.invalid_image", 400);
  }
  if (input.byteLength > INPUT_LIMIT_BYTES) {
    throw new ProfileAvatarError("profile.avatar.too_large", 413);
  }
  const source = Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  try {
    const decoder = sharp(source, {
      limitInputPixels: PIXEL_LIMIT,
      failOn: "error",
      animated: false,
      sequentialRead: true,
    });
    const meta = await decoder.metadata();
    if (!meta.format || !INPUT_FORMATS.has(meta.format) ||
        (meta.pages ?? 1) !== 1) {
      throw new ProfileAvatarError("profile.avatar.unsupported_format", 415);
    }
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < MIN_EDGE || height < MIN_EDGE ||
        width > EDGE_LIMIT || height > EDGE_LIMIT ||
        width * height > PIXEL_LIMIT) {
      throw new ProfileAvatarError("profile.avatar.invalid_dimensions", 400);
    }

    // Orientation is applied before cropping. No withMetadata()/keepMetadata().
    // Always produce opaque sRGB WebP to remove source profile GPS/EXIF fields
    // and eliminate animation/alpha edge cases for public profile rendering.
    const bytes = await decoder
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb")
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    if (!bytes.length || bytes.length > OUTPUT_LIMIT_BYTES) {
      throw new ProfileAvatarError("profile.avatar.too_large", 413);
    }
    return Object.freeze({
      bytes,
      mediaType: "image/webp" as const,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: 512 as const,
      height: 512 as const,
    });
  } catch (error) {
    if (error instanceof ProfileAvatarError) throw error;
    throw new ProfileAvatarError("profile.avatar.invalid_image", 400);
  }
}

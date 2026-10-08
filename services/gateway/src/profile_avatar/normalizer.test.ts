import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeProfileAvatar, ProfileAvatarError } from "./normalizer.js";

describe("R18 trusted profile image normalization", () => {
  it("converts valid PNG into a bounded square WebP without source metadata", async () => {
    const source = await sharp({
      create: {
        width: 720,
        height: 900,
        channels: 4,
        background: { r: 90, g: 120, b: 200, alpha: 0.5 },
      },
    }).png().toBuffer();
    const result = await normalizeProfileAvatar(source);
    expect(result.mediaType).toBe("image/webp");
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.bytes.byteLength).toBeLessThanOrEqual(512 * 1024);
    expect(result.sha256).toBe(createHash("sha256").update(result.bytes).digest("hex"));
    const meta = await sharp(result.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.pages ?? 1).toBe(1);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.hasAlpha).toBe(false);
  });

  it("normalizes equal input deterministically for content-addressed storage", async () => {
    const src = await sharp({
      create: { width: 320, height: 320, channels: 3, background: "#3975bb" },
    }).jpeg().toBuffer();
    const a = await normalizeProfileAvatar(src);
    const b = await normalizeProfileAvatar(src);
    expect(a.sha256).toEqual(b.sha256);
    expect(a.bytes.equals(b.bytes)).toBe(true);
  });

  it("rejects oversized uploads before decoding", async () => {
    await expect(normalizeProfileAvatar(Buffer.alloc(2 * 1024 * 1024 + 1)))
      .rejects.toMatchObject({
        code: "profile.avatar.too_large",
        statusCode: 413,
      } satisfies Partial<ProfileAvatarError>);
  });

  it("rejects unsupported SVG and GIF instead of storing active image content", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400"/></svg>');
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
    for (const src of [svg, gif]) {
      await expect(normalizeProfileAvatar(src)).rejects.toMatchObject({
        code: "profile.avatar.unsupported_format",
        statusCode: 415,
      });
    }
  });

  it("rejects files too small for readable user avatars", async () => {
    const tiny = await sharp({
      create: { width: 30, height: 50, channels: 3, background: "#123456" },
    }).png().toBuffer();
    await expect(normalizeProfileAvatar(tiny)).rejects.toMatchObject({
      code: "profile.avatar.invalid_dimensions",
      statusCode: 400,
    });
  });

  it("rejects corrupted, empty and unknown buffers", async () => {
    for (const src of [
      Buffer.alloc(0),
      Buffer.from("not-an-image"),
      Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    ]) {
      await expect(normalizeProfileAvatar(src)).rejects.toMatchObject({
        code: "profile.avatar.invalid_image",
        statusCode: 400,
      });
    }
  });
});

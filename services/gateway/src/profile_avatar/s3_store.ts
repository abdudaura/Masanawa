import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NormalizedProfileAvatar } from "./normalizer.js";

const HEX_DIGEST = /^[0-9a-f]{64}$/u;
const OWNER_ID = /^(?:tenant|user)_[A-Za-z0-9-]{12,100}$/u;

type Owner = Readonly<{ tenantId: string; userId: string }>;
export interface AvatarObjectStore {
  put(owner: Owner, avatar: NormalizedProfileAvatar): Promise<Readonly<{
    key: string;
    url: string;
    sha256: string;
  }>>;
  delete(owner: Owner, sha256: string): Promise<void>;
  urlFor(owner: Owner, sha256: string): string;
}

function hash(payload: Buffer | string): string {
  return createHash("sha256").update(payload).digest("hex");
}
function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}
function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), "s3"), "aws4_request");
}
function timestamp(now: Date): Readonly<{ stamp: string; date: string }> {
  if (!Number.isFinite(now.getTime())) throw new TypeError("Invalid signing clock");
  const stamp = now.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return { stamp, date: stamp.slice(0, 8) };
}
function ownerPath(owner: Owner, checksum: string): string {
  if (!OWNER_ID.test(owner.tenantId) || !owner.tenantId.startsWith("tenant_") ||
      !OWNER_ID.test(owner.userId) || !owner.userId.startsWith("user_") ||
      !HEX_DIGEST.test(checksum)) {
    throw new TypeError("Invalid owner-scoped avatar identity");
  }
  return ["profiles", owner.tenantId, owner.userId, "sha256-" + checksum + ".webp"].join("/");
}

export function createS3AvatarObjectStore(input: Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  /** Explicit public, read-only CDN for immutable objects; not an S3 upload endpoint. */
  publicBaseUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): AvatarObjectStore {
  const endpoint = new URL(input.endpoint);
  const publicBase = new URL(input.publicBaseUrl);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.pathname !== "/" || endpoint.search || endpoint.hash ||
      !endpoint.hostname ||
      publicBase.protocol !== "https:" || publicBase.username || publicBase.password ||
      publicBase.pathname !== "/" || publicBase.search || publicBase.hash ||
      !publicBase.hostname) {
    throw new TypeError("Avatar storage requires HTTPS origins without credentials or URL parameters");
  }
  const region = input.region.trim();
  const bucket = input.bucket.trim();
  const accessKey = input.accessKey.trim();
  const secretKey = input.secretKey;
  if (!/^[a-z0-9][a-z0-9.-]{2,62}$/u.test(bucket) ||
      bucket.includes("..") || bucket.endsWith(".") ||
      !/^[A-Za-z0-9-]{2,48}$/u.test(region) || !accessKey ||
      secretKey.length < 16) {
    throw new TypeError("Avatar S3 configuration is incomplete or invalid");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  function target(key: string): URL {
    const url = new URL(endpoint.toString());
    url.pathname = "/" + [bucket, ...key.split("/")].map(encodeURIComponent).join("/");
    return url;
  }
  function publicUrl(key: string): string {
    const url = new URL(publicBase.toString());
    url.pathname = "/" + key.split("/").map(encodeURIComponent).join("/");
    return url.toString();
  }
  function signedHeaders(
    method: "PUT" | "DELETE",
    url: URL,
    body: Buffer,
  ): Readonly<Record<string, string>> {
    const { stamp, date } = timestamp(now());
    const checksum = hash(body);
    const headers = method === "PUT"
      ? "content-type;host;x-amz-content-sha256;x-amz-date"
      : "host;x-amz-content-sha256;x-amz-date";
    const canonical = method === "PUT"
      ? `content-type:image/webp\nhost:${url.host}\nx-amz-content-sha256:${checksum}\nx-amz-date:${stamp}\n`
      : `host:${url.host}\nx-amz-content-sha256:${checksum}\nx-amz-date:${stamp}\n`;
    const scope = `${date}/${region}/s3/aws4_request`;
    const request = [
      method, url.pathname, "", canonical, headers, checksum,
    ].join("\n");
    const signature = createHmac("sha256", signingKey(secretKey, date, region))
      .update(["AWS4-HMAC-SHA256", stamp, scope, hash(request)].join("\n"), "utf8")
      .digest("hex");
    return Object.freeze({
      ...(method === "PUT" ? { "content-type": "image/webp" } : {}),
      "x-amz-content-sha256": checksum,
      "x-amz-date": stamp,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${headers}, Signature=${signature}`,
    });
  }

  return Object.freeze({
    urlFor(owner, digest) {
      return publicUrl(ownerPath(owner, digest));
    },
    async put(owner, avatar) {
      const key = ownerPath(owner, avatar.sha256);
      if (avatar.mediaType !== "image/webp" || avatar.width !== 512 ||
          avatar.height !== 512 || !Buffer.isBuffer(avatar.bytes) ||
          avatar.bytes.byteLength < 1 || avatar.bytes.byteLength > 512 * 1024) {
        throw new TypeError("Only normalized 512x512 WebP avatars may be stored");
      }
      const actual = hash(avatar.bytes);
      if (!timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(avatar.sha256, "hex"))) {
        throw new TypeError("Avatar content checksum does not match normalized bytes");
      }
      const url = target(key);
      const response = await fetchImpl(url, {
        method: "PUT",
        headers: signedHeaders("PUT", url, avatar.bytes),
        body: new Uint8Array(avatar.bytes),
        redirect: "error",
      });
      if (!response.ok) throw new Error("profile.avatar.object_write_failed");
      return Object.freeze({ key, url: publicUrl(key), sha256: avatar.sha256 });
    },
    async delete(owner, digest) {
      const url = target(ownerPath(owner, digest));
      const response = await fetchImpl(url, {
        method: "DELETE",
        headers: signedHeaders("DELETE", url, Buffer.alloc(0)),
        redirect: "error",
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("profile.avatar.object_delete_failed");
      }
    },
  } satisfies AvatarObjectStore);
}


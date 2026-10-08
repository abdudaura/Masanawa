import { createHash, createHmac } from "node:crypto";

export interface AvatarObjectStore {
  put(key: string, png: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  managedKey(url: string | null): string | null;
}
type RequestMethod = "PUT" | "DELETE";

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
function hmac(key: string | Buffer, input: string): Buffer {
  return createHmac("sha256", key).update(input).digest();
}
function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), "s3"), "aws4_request");
}
function timestamp(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/gu, "");
}
function objectPath(key: string): string {
  if (!/^profile-avatars\/[a-f0-9]{64}\/[a-f0-9]{64}\/[a-f0-9-]{36}\.png$/u.test(key)) {
    throw new TypeError("profiles.avatar.invalid_object_key");
  }
  return key.split("/").map(encodeURIComponent).join("/");
}

export function createS3AvatarStore(input: Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicBaseUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): AvatarObjectStore {
  const endpoint = new URL(input.endpoint);
  const publicBase = new URL(input.publicBaseUrl);
  if (endpoint.protocol !== "https:" || endpoint.pathname !== "/" ||
      endpoint.search || endpoint.hash || endpoint.username || endpoint.password ||
      publicBase.protocol !== "https:" || publicBase.search || publicBase.hash ||
      publicBase.username || publicBase.password ||
      !input.region.trim() || !input.accessKey.trim() ||
      input.secretKey.length < 8 ||
      !/^[a-z0-9][a-z0-9.-]{2,62}$/u.test(input.bucket)) {
    throw new TypeError("profiles.avatar.invalid_store_configuration");
  }
  const now = input.now ?? (() => new Date());
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = new URL(publicBase.toString());
  if (!base.pathname.endsWith("/")) base.pathname += "/";

  function location(key: string): URL {
    const url = new URL(endpoint.toString());
    url.pathname = "/" + input.bucket + "/" + objectPath(key);
    return url;
  }

  function signatureHeaders(url: URL, method: RequestMethod,
      body: Buffer | null): Record<string, string> {
    const date = timestamp(now());
    const shortDate = date.slice(0, 8);
    const scope = shortDate + "/" + input.region + "/s3/aws4_request";
    const hash = sha256(body ?? Buffer.alloc(0));
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": hash,
      "x-amz-date": date,
    };
    if (body !== null) {
      headers["content-type"] = "image/png";
      headers["cache-control"] = "public, max-age=31536000, immutable";
    }
    const names = Object.keys(headers).sort();
    const canonical = names.map(name => name + ":" + headers[name]!.trim() + "\n").join("");
    const signed = names.join(";");
    const canonicalRequest = [
      method, url.pathname, "", canonical, signed, hash,
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256", date, scope, sha256(canonicalRequest),
    ].join("\n");
    const digest = createHmac(
      "sha256", signingKey(input.secretKey, shortDate, input.region),
    ).update(stringToSign).digest("hex");
    return {
      "x-amz-content-sha256": hash,
      "x-amz-date": date,
      ...(body === null ? {} : {
        "content-type": headers["content-type"]!,
        "cache-control": headers["cache-control"]!,
      }),
      authorization: "AWS4-HMAC-SHA256 Credential=" + input.accessKey +
        "/" + scope + ", SignedHeaders=" + signed + ", Signature=" + digest,
    };
  }

  return Object.freeze<AvatarObjectStore>({
    async put(key, png) {
      if (!Buffer.isBuffer(png) || png.length < 60 || png.length > 2 * 1024 * 1024) {
        throw new TypeError("profiles.avatar.invalid_size");
      }
      const url = location(key);
      const response = await fetchImpl(url, {
        method: "PUT",
        headers: signatureHeaders(url, "PUT", png),
        body: new Uint8Array(png),
        redirect: "error",
      });
      if (!response.ok) throw new Error("profiles.avatar.store_unavailable");
    },
    async delete(key) {
      const url = location(key);
      const response = await fetchImpl(url, {
        method: "DELETE",
        headers: signatureHeaders(url, "DELETE", null),
        redirect: "error",
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("profiles.avatar.delete_unavailable");
      }
    },
    publicUrl(key) {
      return new URL(objectPath(key), base).toString();
    },
    managedKey(url) {
      if (!url) return null;
      try {
        const parsed = new URL(url);
        if (parsed.origin !== base.origin ||
            !parsed.pathname.startsWith(base.pathname) ||
            parsed.search || parsed.hash) return null;
        const key = decodeURIComponent(parsed.pathname.slice(base.pathname.length));
        return objectPath(key) === key ? key : null;
      } catch {
        return null;
      }
    },
  });
}

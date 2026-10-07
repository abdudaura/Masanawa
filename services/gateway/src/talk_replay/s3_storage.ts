import { createHash, createHmac } from "node:crypto";

export interface ReplayObjectStorage {
  readonly bucket: string;
  presignGet(input: Readonly<{
    objectKey: string;
    expiresSeconds?: number;
  }>): Readonly<{ url: string; expiresAt: string }>;
  sha256(input: Readonly<{ objectKey: string }>): Promise<Readonly<{
    checksumSha256: string;
    byteLength: number;
  }>>;
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function objectPath(key: string): string {
  const normalized = key
    .split("/")
    .filter(Boolean)
    .map(encode)
    .join("/");
  if (!normalized) throw new TypeError("Replay object key is invalid");
  return `/${normalized}`;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function amzDate(date: Date): Readonly<{ full: string; day: string }> {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/gu, "");
  return Object.freeze({
    full: iso,
    day: iso.slice(0, 8),
  });
}

export function createS3ReplayObjectStorage(input: Readonly<{
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secret: string;
  forcePathStyle?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): ReplayObjectStorage {
  const endpoint = new URL(input.endpoint.trim().replace(/\/$/u, ""));
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new TypeError("Replay storage endpoint is invalid");
  }
  const bucket = input.bucket.trim();
  const region = input.region.trim();
  const accessKey = input.accessKey.trim();
  const secret = input.secret.trim();
  if (!bucket || !region || !accessKey || !secret) {
    throw new TypeError("Replay object storage credentials are incomplete");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const forcePathStyle = input.forcePathStyle ?? true;

  function presign(
    objectKey: string,
    expiresSeconds: number,
  ): Readonly<{ url: string; expiresAt: string }> {
    if (
      !Number.isSafeInteger(expiresSeconds) ||
      expiresSeconds < 30 ||
      expiresSeconds > 3600
    ) {
      throw new RangeError("Replay playback URL expiry is invalid");
    }
    const time = now();
    const stamp = amzDate(time);
    const keyPath = objectPath(objectKey);
    const url = new URL(endpoint.toString());
    if (forcePathStyle) {
      url.pathname = `/${encode(bucket)}${keyPath}`;
    } else {
      url.hostname = `${bucket}.${url.hostname}`;
      url.pathname = keyPath;
    }

    const scope = `${stamp.day}/${region}/s3/aws4_request`;
    const params: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKey}/${scope}`,
      "X-Amz-Date": stamp.full,
      "X-Amz-Expires": String(expiresSeconds),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQuery = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encode(key)}=${encode(value)}`)
      .join("&");
    const canonicalRequest = [
      "GET",
      url.pathname,
      canonicalQuery,
      `host:${url.host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      stamp.full,
      scope,
      sha(canonicalRequest),
    ].join("\n");
    const signingKey = hmac(
      hmac(
        hmac(hmac(`AWS4${secret}`, stamp.day), region),
        "s3",
      ),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign, "utf8")
      .digest("hex");

    url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return Object.freeze({
      url: url.toString(),
      expiresAt: new Date(time.getTime() + expiresSeconds * 1000).toISOString(),
    });
  }

  return Object.freeze({
    bucket,

    presignGet(request) {
      return presign(request.objectKey, request.expiresSeconds ?? 300);
    },

    async sha256(request) {
      const signed = presign(request.objectKey, 300);
      const response = await fetchImpl(signed.url, { method: "GET" });
      if (!response.ok || !response.body) {
        throw new Error("talks.replay_storage_read_failed");
      }
      const hash = createHash("sha256");
      let byteLength = 0;
      for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
        hash.update(chunk);
        byteLength += chunk.byteLength;
      }
      if (byteLength < 1) {
        throw new Error("talks.replay_storage_empty");
      }
      return Object.freeze({
        checksumSha256: hash.digest("hex"),
        byteLength,
      });
    },
  });
}

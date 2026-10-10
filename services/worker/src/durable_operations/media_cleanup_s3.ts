/**
 * AF15 exact-object S3 deletion adapter for the canonical media cleanup runner.
 * Does not schedule work, select candidates, mutate DB metadata, or authorize
 * deleting an object: the durable repository must claim, tombstone and preflight
 * reference/retention/hold policy before the runner invokes this adapter.
 */
import { createHash, createHmac } from "node:crypto";
import {
  validCleanupCandidate,
  type CleanupCandidate,
  type ImmutableObjectDeleter,
} from "./media_cleanup.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}
function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), "s3"), "aws4_request");
}
function encoded(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, c =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export interface MediaCleanupS3Config {
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

export function createS3MediaCleanupDeleter(input: MediaCleanupS3Config): ImmutableObjectDeleter {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.pathname !== "/" ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      !endpoint.hostname) {
    throw new TypeError("media_cleanup.invalid_s3_origin");
  }
  const bucket = input.bucket.trim();
  const region = input.region.trim();
  const accessKey = input.accessKey.trim();
  const secret = input.secretKey;
  if (!/^[a-z0-9][a-z0-9.-]{2,62}$/u.test(bucket) ||
      bucket.includes("..") || bucket.endsWith(".") ||
      !/^[A-Za-z0-9-]{2,48}$/u.test(region) ||
      !/^[A-Za-z0-9/+=._-]{3,128}$/u.test(accessKey) ||
      typeof secret !== "string" || secret.length < 16 ||
      secret.length > 512) {
    throw new TypeError("media_cleanup.invalid_s3_config");
  }
  const now = input.now ?? (() => new Date());
  const fetchImpl = input.fetchImpl ?? fetch;

  return Object.freeze({
    async deleteExact(candidate: CleanupCandidate): Promise<"deleted" | "absent"> {
      if (!candidate || !validCleanupCandidate(candidate)) {
        throw new TypeError("media_cleanup.invalid_object_identity");
      }
      const dateValue = now();
      if (!Number.isFinite(dateValue.getTime())) {
        throw new TypeError("media_cleanup.invalid_s3_clock");
      }
      const stamp = dateValue.toISOString().replace(/[:-]|\.\d{3}/gu, "");
      const date = stamp.slice(0, 8);
      const path = "/" + [bucket, ...candidate.objectKey.split("/")].map(encoded).join("/");
      // Version-pinned deletes cannot fall back to deleting the latest object.
      // Unversioned deletion requires the runner-validated sha256 immutable key.
      const query = candidate.objectVersion === null
        ? ""
        : "versionId=" + encoded(candidate.objectVersion);
      const url = new URL(endpoint.toString());
      url.pathname = path;
      url.search = query;
      const payloadHash = sha256("");
      const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
      const canonicalHeaders =
        "host:" + url.host + "\n" +
        "x-amz-content-sha256:" + payloadHash + "\n" +
        "x-amz-date:" + stamp + "\n";
      const scope = date + "/" + region + "/s3/aws4_request";
      const canonicalRequest = [
        "DELETE", path, query, canonicalHeaders, signedHeaders, payloadHash,
      ].join("\n");
      const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonicalRequest)].join("\n");
      const signature = createHmac("sha256", signingKey(secret, date, region))
        .update(toSign, "utf8").digest("hex");
      const response = await fetchImpl(url, {
        method: "DELETE",
        redirect: "error",
        headers: {
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": stamp,
          authorization:
            "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope +
            ", SignedHeaders=" + signedHeaders + ", Signature=" + signature,
        },
      });
      if (response.ok) return "deleted";
      // An ambiguous 404 may be a missing bucket or wrong credentials. Do not
      // mark the tombstone complete without an explicit S3 object-absence code.
      if (response.status === 404 &&
          ["NoSuchKey", "NoSuchVersion"].includes(
            response.headers.get("x-amz-error-code") ?? "")) return "absent";
      throw new Error("media_cleanup.s3_delete_uncertain");
    },
  } satisfies ImmutableObjectDeleter);
}

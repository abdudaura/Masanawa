import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PlatformError, nowInstant, parseCanonicalId, toInstant, type Instant } from "@masanawa/contracts";
import { assertCurrentAuthority, createAuthorityContext, type CurrentAuthoritySource } from "@masanawa/security";
import type { MediaTransferGrant, MediaTransferRequest, MediaUploadRequest, PrivateMediaStorage } from "@masanawa/providers";

export interface R2MediaStorageConfig {
  readonly accountId: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly currentAuthority: CurrentAuthoritySource;
  readonly now?: () => Instant;
}
const mediaTypes = new Set(["image/jpeg", "image/png", "image/webp", "audio/aac", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "application/pdf"]);
function denied(): never {
  throw new PlatformError({ code: "storage.media_access_denied", category: "authorization",
    message: "Current authority does not admit this private media transfer.", retryable: false });
}

/** Signing only: no network reads/writes, public bucket, metadata store or independent truth. */
export function createR2PrivateMediaStorage(config: R2MediaStorageConfig): PrivateMediaStorage {
  if (!/^[a-f0-9]{32}$/u.test(config.accountId) ||
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u.test(config.bucket) ||
      !/^[A-Za-z0-9]{16,128}$/u.test(config.accessKeyId) ||
      typeof config.secretAccessKey !== "string" || config.secretAccessKey.length < 16 ||
      config.secretAccessKey.length > 256 || /\s/u.test(config.secretAccessKey)) {
    throw new TypeError("Invalid R2 configuration");
  }
  const bucket = config.bucket, clock = config.now ?? nowInstant, source = config.currentAuthority;
  const client = new S3Client({ region: "auto", forcePathStyle: true,
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  async function grant(raw: MediaTransferRequest | MediaUploadRequest, upload: boolean): Promise<MediaTransferGrant> {
    const resource = Object.freeze({ tenantId: parseCanonicalId("tenant", raw.resource.tenantId),
      relationshipId: parseCanonicalId("relationship", raw.resource.relationshipId),
      mediaArtifactId: parseCanonicalId("media-artifact", raw.resource.mediaArtifactId) });
    const authority = Object.freeze({ ...createAuthorityContext(raw.authority),
      authorityContextId: parseCanonicalId("authority-context", raw.authority.authorityContextId),
      principal: Object.freeze({ ...raw.authority.principal }) });
    const at = toInstant(clock()), seconds = raw.expiresInSeconds;
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 300) throw new RangeError("Media grant duration must be 1–300 seconds");
    if (authority.tenantId !== resource.tenantId || authority.issuedAt > at ||
        !authority.capabilities.includes(upload ? "storage.media.upload" : "storage.media.read") ||
        !authority.resourceScope.relationshipIds?.includes(resource.relationshipId)) denied();
    const expiresAt = toInstant(new Date(Date.parse(at) + seconds * 1000));
    if (authority.expiresAt && expiresAt > authority.expiresAt) denied();
    const headers: Record<string, string> = {};
    if (upload) {
      const input = raw as MediaUploadRequest;
      if (!mediaTypes.has(input.mimeType) || !Number.isSafeInteger(input.byteLength) ||
          input.byteLength < 1 || input.byteLength > 12 * 1024 * 1024) throw new RangeError("Invalid media upload envelope");
      headers["content-type"] = input.mimeType;
      headers["content-length"] = String(input.byteLength);
    }
    const objectKey = `${resource.tenantId}/${resource.relationshipId}/${resource.mediaArtifactId}`;
    async function admit(checkedAt: Instant) {
      await assertCurrentAuthority(authority, source, checkedAt);
    // Parent revocation cannot be bypassed by minting a URL through a delegated ceiling.
    if (source.isRevoked) for (const authorityContextId of authority.delegationChain) {
      if (await source.isRevoked({ ...authority, authorityContextId })) denied();
    }
    }
    await admit(at);
    let url: string;
    try {
      url = await getSignedUrl(client, upload
        ? new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: headers["content-type"], ContentLength: Number(headers["content-length"]) })
        : new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        { expiresIn: seconds, signingDate: new Date(at), signableHeaders: new Set(Object.keys(headers)) });
    } catch {
      throw new PlatformError({ code: "storage.media_signing_failed", category: "unavailable",
        message: "Private media transfer could not be prepared.", retryable: false });
    }
    // Authority can expire/revoke during asynchronous SDK credential/signing work.
    const finishedAt = toInstant(clock());
    if (finishedAt >= expiresAt) denied();
    await admit(finishedAt);
    return Object.freeze({ method: upload ? "PUT" : "GET", url, objectKey,
      headers: Object.freeze(headers), expiresAt });
  }
  return Object.freeze({ grantUpload: (input: MediaUploadRequest) => grant(input, true),
    grantDownload: (input: MediaTransferRequest) => grant(input, false) });
}

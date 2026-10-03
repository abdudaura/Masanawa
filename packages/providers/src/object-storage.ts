import type { Instant, MediaArtifactId, RelationshipId, TenantId } from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";

/** Transport projection only. The owning file/media operation records metadata and receipts. */
export interface PrivateMediaObject {
  readonly tenantId: TenantId;
  readonly relationshipId: RelationshipId;
  readonly mediaArtifactId: MediaArtifactId;
}
export interface MediaTransferRequest {
  readonly authority: AuthorityContext;
  readonly resource: PrivateMediaObject;
  readonly expiresInSeconds: number;
}
export interface MediaUploadRequest extends MediaTransferRequest {
  readonly mimeType: string;
  readonly byteLength: number;
}
/** Bearer credential: keep URL and headers out of logs and canonical Memory. */
export interface MediaTransferGrant {
  readonly method: "GET" | "PUT";
  readonly url: string;
  readonly objectKey: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Instant;
}
export interface PrivateMediaStorage {
  grantUpload(input: MediaUploadRequest): Promise<MediaTransferGrant>;
  grantDownload(input: MediaTransferRequest): Promise<MediaTransferGrant>;
}

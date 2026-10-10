export type Owner = Readonly<{ tenantId: string; userId: string }>;
export type ArtifactState = 'generating' | 'ready' | 'failed' | 'revoked' | 'deleting' | 'deleted';
export type Grant = Readonly<{ userId: string; expiresAt: string }>;
export type Provenance = Readonly<{ kind: 'user-text' | 'operator'; taskId?: string; operationId?: string }>;
export interface Artifact {
  id: string; tenantId: string; userId: string; requestId: string;
  filename: string; mimeType: 'text/plain; charset=utf-8'; sizeBytes: number; sha256: string;
  objectKey: string; provenance: Provenance; state: ArtifactState; revision: number;
  createdAt: string; expiresAt: string; grants: readonly Grant[];
}
export type ArtifactView = Omit<Artifact, 'tenantId' | 'userId' | 'requestId' | 'objectKey' | 'grants'> & {
  owned: boolean; sharedWith: readonly Grant[];
};
export interface ArtifactRepository {
  reserve(value: Artifact): Promise<Artifact>;
  find(tenantId: string, id: string): Promise<Artifact | null>;
  findRequest(owner: Owner, requestId: string): Promise<Artifact | null>;
  change(owner: Owner, id: string, revision: number,
    patch: Pick<Artifact, 'state' | 'grants'>): Promise<Artifact | null>;
  list(owner: Owner, after: string | undefined, limit: number): Promise<readonly Artifact[]>;
  cleanupCandidates(limit: number): Promise<readonly Artifact[]>;
}
/** Same private put/get/delete capability as C04. No public URL is returned. */
export interface ArtifactObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string, maxBytes: number): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export class ArtifactError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, statusCode: number) { super(code); this.code=code; this.statusCode=statusCode; }
}
export const MAX_BYTES = 256 * 1024;

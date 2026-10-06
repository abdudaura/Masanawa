import type {
  CharacterId,
  Instant,
  MediaArtifactId,
  MediaProjectId,
  OperationId,
  TenantId,
} from "@masanawa/contracts";

export type StudioProjectState = "active" | "archived";

export interface StudioProject {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly mediaProjectId: MediaProjectId;
  readonly characterId: CharacterId;
  readonly title: string;
  readonly state: StudioProjectState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly archivedAt: Instant | null;
}

export type StudioArtifactKind =
  | "script"
  | "storyboard"
  | "audio"
  | "image"
  | "video"
  | "subtitle"
  | "render-manifest"
  | "other";

export interface StudioArtifactParent {
  readonly mediaArtifactId: MediaArtifactId;
  readonly revision: number;
}

export interface StudioArtifactSourceEvidence {
  readonly sourceType:
    | "user-input"
    | "character-output"
    | "uploaded-media"
    | "provider-output"
    | "operation";
  readonly reference: string;
  readonly contentHash: string;
  readonly operationId: OperationId | null;
}

export interface StudioArtifactRevision {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly mediaProjectId: MediaProjectId;
  readonly characterId: CharacterId;
  readonly mediaArtifactId: MediaArtifactId;
  readonly revision: number;
  readonly kind: StudioArtifactKind;
  readonly mediaType: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly parents: readonly StudioArtifactParent[];
  readonly sources: readonly StudioArtifactSourceEvidence[];
  readonly provenanceHash: string;
  readonly createdAt: Instant;
}

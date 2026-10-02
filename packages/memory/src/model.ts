import type {
  CharacterId,
  CharacterSessionId,
  Instant,
  MemoryRecordId,
  MemoryRevisionId,
  RelationshipId,
  TaskId,
  TenantId,
  WorldId,
} from "@masanawa/contracts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export const memoryTypes = [
  "observation",
  "fact",
  "event",
  "state",
  "preference",
  "relationship",
  "plan",
  "reflection",
  "procedural",
  "summary",
  "prohibition",
] as const;

export type MemoryType = (typeof memoryTypes)[number];

export const memoryLifecycleStates = [
  "active",
  "superseded",
  "absorbed",
  "expired",
  "tombstoned",
] as const;

export type MemoryLifecycleState = (typeof memoryLifecycleStates)[number];

export type MemoryScope =
  | { readonly kind: "organization" }
  | {
      readonly kind: "relationship";
      readonly relationshipId: RelationshipId;
    }
  | {
      readonly kind: "character-private";
      readonly characterId: CharacterId;
    }
  | {
      readonly kind: "character-shared";
      readonly characterId: CharacterId;
    }
  | {
      readonly kind: "world";
      readonly worldId: WorldId;
    }
  | {
      readonly kind: "session";
      readonly characterSessionId: CharacterSessionId;
    }
  | {
      readonly kind: "task";
      readonly taskId: TaskId;
    };

export type MemoryScopeKind = MemoryScope["kind"];

export const memoryEvidenceSourceKinds = [
  "platform-event",
  "world-evidence",
  "message",
  "artifact",
  "operator",
  "import",
  "other",
] as const;

export type MemoryEvidenceSourceKind =
  (typeof memoryEvidenceSourceKinds)[number];

export interface MemoryEvidence {
  readonly ordinal: number;
  readonly sourceKind: MemoryEvidenceSourceKind;
  readonly sourceReference: string;
  readonly sourceContentHash: string;
  readonly verbatimText: string | null;
  readonly observedAt: Instant;
}

export interface MemoryExtractionInfo {
  readonly method: string;
  readonly modelVersion: string | null;
}

export interface MemoryRevision {
  readonly tenantId: TenantId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryRecordId: MemoryRecordId;
  readonly revisionNumber: number;
  readonly content: string;
  readonly payload: JsonObject;
  readonly confidence: number;
  readonly extraction: MemoryExtractionInfo;
  readonly eventTime: Instant | null;
  readonly observedAt: Instant;
  readonly validFrom: Instant | null;
  readonly validTo: Instant | null;
  readonly expiresAt: Instant | null;
  readonly createdAt: Instant;
  readonly evidence: readonly MemoryEvidence[];
}

export interface MemoryRecord {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly lifecycleState: MemoryLifecycleState;
  readonly currentRevisionId: MemoryRevisionId;
  readonly revision: number;
  readonly lifecycleRevision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface MemoryRecordSnapshot {
  readonly record: MemoryRecord;
  readonly currentRevision: MemoryRevision;
}


export const memoryRecordLinkKinds = ["supersedes", "absorbs"] as const;
export type MemoryRecordLinkKind = (typeof memoryRecordLinkKinds)[number];

export interface MemoryRecordLink {
  readonly tenantId: TenantId;
  readonly sourceMemoryRecordId: MemoryRecordId;
  readonly sourceMemoryRevisionId: MemoryRevisionId;
  readonly targetMemoryRecordId: MemoryRecordId;
  readonly targetMemoryRevisionId: MemoryRevisionId;
  readonly kind: MemoryRecordLinkKind;
  readonly reason: string;
  readonly createdAt: Instant;
}

export interface MemoryScopePublication {
  readonly tenantId: TenantId;
  readonly sourceMemoryRecordId: MemoryRecordId;
  readonly sourceMemoryRevisionId: MemoryRevisionId;
  readonly targetMemoryRecordId: MemoryRecordId;
  readonly targetMemoryRevisionId: MemoryRevisionId;
  readonly operationId: import("@masanawa/contracts").OperationId;
  readonly authorityContextId: import("@masanawa/contracts").AuthorityContextId;
  readonly approvalId: import("@masanawa/contracts").ApprovalId;
  readonly policyRevision: string;
  readonly principalKey: string;
  readonly reason: string;
  readonly publishedAt: Instant;
}

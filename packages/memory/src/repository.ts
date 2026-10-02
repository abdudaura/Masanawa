import type {
  Instant,
  MemoryRecordId,
  MemoryRevisionId,
  TenantId,
} from "@masanawa/contracts";
import type {
  JsonObject,
  MemoryLifecycleState,
  MemoryRecordSnapshot,
  MemoryScope,
  MemoryType,
} from "./model.js";
import type {
  MemoryEvidenceInput,
  MemoryRevisionContentInput,
} from "./invariants.js";

export interface CreateMemoryRecordInput extends MemoryRevisionContentInput {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly memoryType: MemoryType;
  readonly scope: MemoryScope;
  readonly createdAt: Instant;
}

export interface AppendMemoryRevisionInput extends MemoryRevisionContentInput {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly memoryRevisionId: MemoryRevisionId;
  readonly expectedRevision: number;
  readonly updatedAt: Instant;
}

export interface ListMemoryRecordsByScopesInput {
  readonly tenantId: TenantId;
  readonly scopes: readonly MemoryScope[];
  readonly lifecycleStates?: readonly MemoryLifecycleState[];
  readonly limit?: number;
}

export interface MemoryRepository {
  createMemoryRecord(
    input: CreateMemoryRecordInput,
  ): Promise<MemoryRecordSnapshot>;
  appendMemoryRevision(
    input: AppendMemoryRevisionInput,
  ): Promise<MemoryRecordSnapshot>;
  getMemoryRecord(
    tenantId: TenantId,
    memoryRecordId: MemoryRecordId,
  ): Promise<MemoryRecordSnapshot | null>;
  listMemoryRecordsByScopes(
    input: ListMemoryRecordsByScopesInput,
  ): Promise<readonly MemoryRecordSnapshot[]>;
}

export type {
  JsonObject,
  MemoryEvidenceInput,
  MemoryRevisionContentInput,
};

import type {
  Instant,
  MemoryRecordId,
  MemoryRevisionId,
  TenantId,
} from "@masanawa/contracts";
import type {
  MemoryLifecycleState,
  MemoryRecordLink,
  MemoryRecordLinkKind,
  MemoryRecordSnapshot,
  MemoryScope,
  MemoryType,
} from "./model.js";
import type { MemoryRevisionContentInput } from "./invariants.js";

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

export interface LinkMemoryRecordsInput {
  readonly tenantId: TenantId;
  readonly sourceMemoryRecordId: MemoryRecordId;
  readonly expectedSourceLifecycleRevision: number;
  readonly targetMemoryRecordId: MemoryRecordId;
  readonly kind: MemoryRecordLinkKind;
  readonly reason: string;
  readonly transitionedAt: Instant;
}

export interface LinkedMemoryRecords {
  readonly link: MemoryRecordLink;
  readonly source: MemoryRecordSnapshot;
  readonly target: MemoryRecordSnapshot;
  readonly reused: boolean;
}

export interface GetMemoryRecordInScopeInput {
  readonly tenantId: TenantId;
  readonly memoryRecordId: MemoryRecordId;
  readonly scope: MemoryScope;
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
  linkMemoryRecords(
    input: LinkMemoryRecordsInput,
  ): Promise<LinkedMemoryRecords>;
  getMemoryRecordInScope(
    input: GetMemoryRecordInScopeInput,
  ): Promise<MemoryRecordSnapshot | null>;
  listMemoryRecordsByScopes(
    input: ListMemoryRecordsByScopesInput,
  ): Promise<readonly MemoryRecordSnapshot[]>;
}

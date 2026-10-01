import type {
  CharacterId,
  CharacterVersionId,
  Instant,
  TenantId,
  WorldEventId,
  WorldGenerationId,
  WorldId,
} from "@masanawa/contracts";
import type {
  CharacterLifeState,
  JsonObject,
  SimulationInput,
  World,
  WorldEvent,
  WorldEventProvenance,
  WorldEventVisibility,
  WorldGeneration,
  WorldPolicy,
} from "./model.js";

export interface CreateWorldInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly initialGenerationId: WorldGenerationId;
  readonly policy: WorldPolicy;
  readonly simulationTime: Instant;
  readonly createdAt: Instant;
}

export interface AdmitSimulationInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly idempotencyKey: string;
  readonly kind: string;
  readonly payload: JsonObject;
  readonly receivedAt: Instant;
  readonly effectiveAt: Instant;
}

export interface CommitWorldGenerationInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly expectedGenerationNumber: number;
  readonly nextGenerationId: WorldGenerationId;
  readonly simulationTime: Instant;
  readonly committedAt: Instant;
  readonly completedInputSequences: readonly number[];
}

export interface CommitWorldGenerationResult {
  readonly world: World;
  readonly generation: WorldGeneration;
  readonly completedInputs: readonly SimulationInput[];
}

export interface WorldRepository {
  createWorld(input: CreateWorldInput): Promise<World>;
  getWorld(tenantId: TenantId, worldId: WorldId): Promise<World | null>;
  admitSimulationInput(input: AdmitSimulationInput): Promise<SimulationInput>;
  commitGeneration(
    input: CommitWorldGenerationInput,
  ): Promise<CommitWorldGenerationResult>;
}

export interface PutCharacterLifeStateInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly expectedRevision: number | null;
  readonly availability: string | null;
  readonly narrativeState: string | null;
  readonly activeGoal: string | null;
  readonly storyArc: string | null;
  readonly coarseLocation: string | null;
  readonly effectiveAt: Instant;
  readonly updatedAt: Instant;
}

export interface AppendWorldEventInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly worldEventId: WorldEventId;
  readonly characterId: CharacterId | null;
  readonly characterVersionId: CharacterVersionId | null;
  readonly eventKind: string;
  readonly payload: JsonObject;
  readonly provenance: WorldEventProvenance;
  readonly visibility: WorldEventVisibility;
  readonly occurrenceKey: string | null;
  readonly effectiveStart: Instant;
  readonly effectiveEnd: Instant | null;
  readonly recordedAt: Instant;
  readonly admission: "draft" | "automatic-approved";
}

export interface ApproveWorldEventInput {
  readonly tenantId: TenantId;
  readonly worldEventId: WorldEventId;
  readonly approvedAt: Instant;
}

export interface GovernedWorldRepository extends WorldRepository {
  putCharacterLifeState(
    input: PutCharacterLifeStateInput,
  ): Promise<CharacterLifeState>;
  appendWorldEvent(input: AppendWorldEventInput): Promise<WorldEvent>;
  approveWorldEvent(input: ApproveWorldEventInput): Promise<WorldEvent>;
}

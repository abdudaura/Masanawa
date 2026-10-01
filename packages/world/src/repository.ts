import type {
  CharacterId,
  Instant,
  TenantId,
  WorldEventId,
  WorldGenerationId,
  WorldId,
} from "@masanawa/contracts";
import type {
  JsonObject,
  CharacterLifeState,
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


export interface WorldEventDraft {
  readonly worldEventId: WorldEventId;
  readonly characterId: CharacterId | null;
  readonly kind: string;
  readonly payload: JsonObject;
  readonly provenance: WorldEventProvenance;
  readonly visibility: WorldEventVisibility;
  readonly occurrenceKey?: string;
  readonly validFrom: Instant;
  readonly validUntil?: Instant;
  readonly requestAutoApproval?: boolean;
}

export interface CharacterLifeStateChange {
  readonly characterId: CharacterId;
  readonly expectedRevision: number | null;
  readonly availability: string | null;
  readonly narrativeState: string | null;
  readonly activeGoal: string | null;
  readonly storyArc: string | null;
  readonly coarseLocation: string | null;
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
  readonly events?: readonly WorldEventDraft[];
  readonly lifeStateChanges?: readonly CharacterLifeStateChange[];
}

export interface CommitWorldGenerationResult {
  readonly world: World;
  readonly generation: WorldGeneration;
  readonly completedInputs: readonly SimulationInput[];
  readonly events: readonly WorldEvent[];
  readonly lifeStateChanges: readonly CharacterLifeState[];
}

export interface WorldRepository {
  createWorld(input: CreateWorldInput): Promise<World>;
  getWorld(tenantId: TenantId, worldId: WorldId): Promise<World | null>;
  admitSimulationInput(input: AdmitSimulationInput): Promise<SimulationInput>;
  commitGeneration(
    input: CommitWorldGenerationInput,
  ): Promise<CommitWorldGenerationResult>;
}

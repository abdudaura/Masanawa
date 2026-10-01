import type {
  Instant,
  TenantId,
  WorldGenerationId,
  WorldId,
} from "@masanawa/contracts";
import type {
  JsonObject,
  SimulationInput,
  World,
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

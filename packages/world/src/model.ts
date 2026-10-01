import type {
  CharacterId,
  Instant,
  TenantId,
  WorldGenerationId,
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

export type WorldStatus = "active" | "paused" | "stopped";
export type CatchUpMode = "skip" | "bounded" | "manual";

export interface WorldPolicy {
  readonly schemaVersion: 1;
  readonly catchUpMode: CatchUpMode;
  readonly maxCatchUpSteps: number;
  readonly spatialEnabled: boolean;
  readonly automaticCanonEnabled: boolean;
}

export interface World {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly status: WorldStatus;
  readonly policy: WorldPolicy;
  readonly policyRevision: number;
  readonly currentGenerationId: WorldGenerationId;
  readonly currentGenerationNumber: number;
  readonly simulationTime: Instant;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface WorldGeneration {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly worldGenerationId: WorldGenerationId;
  readonly generationNumber: number;
  readonly previousGenerationId: WorldGenerationId | null;
  readonly simulationTime: Instant;
  readonly committedAt: Instant;
}

export type SimulationInputState = "admitted" | "completed" | "rejected";

export interface SimulationInput {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly sequence: number;
  readonly idempotencyKey: string;
  readonly kind: string;
  readonly payload: JsonObject;
  readonly state: SimulationInputState;
  readonly receivedAt: Instant;
  readonly effectiveAt: Instant;
  readonly completedGenerationNumber: number | null;
}

export interface CharacterLifeState {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly characterId: CharacterId;
  readonly availability: string | null;
  readonly narrativeState: string | null;
  readonly activeGoal: string | null;
  readonly storyArc: string | null;
  readonly coarseLocation: string | null;
  readonly revision: number;
  readonly effectiveAt: Instant;
  readonly updatedAt: Instant;
}

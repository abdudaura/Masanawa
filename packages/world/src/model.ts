import type {
  CharacterId,
  Instant,
  TenantId,
  WorldEventId,
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

export type WorldEventProvenance = "authored" | "engine" | "imported" | "model";
export type WorldEventVisibility = "public" | "shared" | "internal" | "private";
export type CanonState = "draft" | "approved" | "retired";

export interface WorldEvent {
  readonly tenantId: TenantId;
  readonly worldEventId: WorldEventId;
  readonly worldId: WorldId;
  readonly characterId: CharacterId | null;
  readonly characterVersionId: import("@masanawa/contracts").CharacterVersionId | null;
  readonly eventKind: string;
  readonly payload: JsonObject;
  readonly provenance: WorldEventProvenance;
  readonly visibility: WorldEventVisibility;
  readonly canonState: CanonState;
  readonly occurrenceKey: string | null;
  readonly effectiveStart: Instant;
  readonly effectiveEnd: Instant | null;
  readonly recordedAt: Instant;
  readonly approvedAt: Instant | null;
  readonly retiredAt: Instant | null;
}

export interface Routine {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly routineKey: string;
  readonly characterId: CharacterId;
  readonly characterVersionId: import("@masanawa/contracts").CharacterVersionId;
  readonly timezone: string;
  readonly localTime: string;
  readonly enabled: boolean;
  readonly inputKind: string;
  readonly inputPayload: JsonObject;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export type StoryArcState = "planned" | "active" | "completed" | "retired";

export interface StoryArc {
  readonly tenantId: TenantId;
  readonly worldId: WorldId;
  readonly storyArcKey: string;
  readonly characterId: CharacterId;
  readonly characterVersionId: import("@masanawa/contracts").CharacterVersionId;
  readonly state: StoryArcState;
  readonly title: string;
  readonly summary: string;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

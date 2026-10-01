import { PlatformError, toInstant, type Instant } from "@masanawa/contracts";
import type { WorldPolicy } from "./model.js";

export function normalizeWorldPolicy(input: WorldPolicy): WorldPolicy {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported WorldPolicy schemaVersion");
  }
  if (
    !Number.isSafeInteger(input.maxCatchUpSteps) ||
    input.maxCatchUpSteps < 0 ||
    input.maxCatchUpSteps > 10_000
  ) {
    throw new RangeError("maxCatchUpSteps must be between 0 and 10000");
  }
  if (input.catchUpMode === "bounded" && input.maxCatchUpSteps < 1) {
    throw new RangeError("bounded catch-up requires at least one step");
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    catchUpMode: input.catchUpMode,
    maxCatchUpSteps: input.maxCatchUpSteps,
    spatialEnabled: input.spatialEnabled,
    automaticCanonEnabled: input.automaticCanonEnabled,
  });
}

export function assertSimulationTimeDoesNotMoveBackward(
  current: Instant,
  proposed: Instant,
): void {
  const currentNormalized = toInstant(current);
  const proposedNormalized = toInstant(proposed);
  if (proposedNormalized < currentNormalized) {
    throw new PlatformError({
      code: "world.simulation_time_regression",
      category: "conflict",
      message: "Simulation time cannot move backward",
      retryable: false,
    });
  }
}

export function normalizeSimulationInputKey(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 256) {
    throw new TypeError("Simulation input idempotency key is invalid");
  }
  return normalized;
}

export function normalizeSimulationInputKind(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    throw new TypeError("Simulation input kind is invalid");
  }
  return normalized;
}

export type TurnPhase =
  | "listening"
  | "finalizing-user"
  | "generating"
  | "playing"
  | "completed"
  | "cancelled"
  | "failed";

export interface RealtimeTurnState {
  readonly schemaVersion: 1;
  readonly presenceSessionId: string;
  readonly turnId: string;
  readonly generation: number;
  readonly playbackEpoch: number;
  readonly phase: TurnPhase;
  readonly userTurnFinal: boolean;
  readonly outputInterruptible: boolean;
  readonly cancellationReason: string | null;
}

export interface BargeInDecision {
  readonly accepted: boolean;
  readonly cancelGeneration: number | null;
  readonly next: RealtimeTurnState;
  readonly reason:
    | "accepted"
    | "output-protected"
    | "nothing-to-interrupt"
    | "terminal-turn";
}

function boundedString(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function nonnegative(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function presenceId(value: string): string {
  const normalized = boundedString(value, "presenceSessionId", 24, 220);
  if (!normalized.startsWith("presence-session_")) {
    throw new TypeError("presenceSessionId must be canonical");
  }
  return normalized;
}

export function normalizeRealtimeTurn(
  input: RealtimeTurnState,
): RealtimeTurnState {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported realtime turn schemaVersion");
  }
  if (
    input.phase !== "listening" &&
    input.phase !== "finalizing-user" &&
    input.phase !== "generating" &&
    input.phase !== "playing" &&
    input.phase !== "completed" &&
    input.phase !== "cancelled" &&
    input.phase !== "failed"
  ) {
    throw new TypeError("turn phase is invalid");
  }
  if (typeof input.userTurnFinal !== "boolean") {
    throw new TypeError("userTurnFinal must be boolean");
  }
  if (typeof input.outputInterruptible !== "boolean") {
    throw new TypeError("outputInterruptible must be boolean");
  }

  const terminal =
    input.phase === "completed" ||
    input.phase === "cancelled" ||
    input.phase === "failed";

  if (terminal && input.phase !== "cancelled" && input.cancellationReason !== null) {
    throw new Error("non-cancelled terminal turn cannot carry cancellationReason");
  }
  if (input.phase === "cancelled" && input.cancellationReason === null) {
    throw new Error("cancelled turn requires cancellationReason");
  }
  if (!terminal && input.cancellationReason !== null) {
    throw new Error("non-terminal turn cannot carry cancellationReason");
  }
  if (
    (input.phase === "generating" ||
      input.phase === "playing" ||
      input.phase === "completed") &&
    !input.userTurnFinal
  ) {
    throw new Error("model/output phases require finalized user turn");
  }

  return Object.freeze({
    schemaVersion: 1,
    presenceSessionId: presenceId(input.presenceSessionId),
    turnId: boundedString(input.turnId, "turnId", 8, 180),
    generation: positive(input.generation, "generation"),
    playbackEpoch: nonnegative(input.playbackEpoch, "playbackEpoch"),
    phase: input.phase,
    userTurnFinal: input.userTurnFinal,
    outputInterruptible: input.outputInterruptible,
    cancellationReason:
      input.cancellationReason === null
        ? null
        : boundedString(input.cancellationReason, "cancellationReason", 1, 500),
  });
}

export function createRealtimeTurn(input: {
  readonly presenceSessionId: string;
  readonly turnId: string;
  readonly generation: number;
}): RealtimeTurnState {
  return normalizeRealtimeTurn({
    schemaVersion: 1,
    presenceSessionId: input.presenceSessionId,
    turnId: input.turnId,
    generation: input.generation,
    playbackEpoch: 0,
    phase: "listening",
    userTurnFinal: false,
    outputInterruptible: true,
    cancellationReason: null,
  });
}

export function markSemanticTurnFinal(
  currentInput: RealtimeTurnState,
): RealtimeTurnState {
  const current = normalizeRealtimeTurn(currentInput);
  if (current.phase !== "listening" && current.phase !== "finalizing-user") {
    throw new Error("semantic finalization requires an open user turn");
  }
  return normalizeRealtimeTurn({
    ...current,
    phase: "generating",
    userTurnFinal: true,
  });
}

export function beginPlayback(input: {
  readonly current: RealtimeTurnState;
  readonly interruptible: boolean;
}): RealtimeTurnState {
  const current = normalizeRealtimeTurn(input.current);
  if (current.phase !== "generating") {
    throw new Error("playback can begin only while generating");
  }
  return normalizeRealtimeTurn({
    ...current,
    phase: "playing",
    playbackEpoch: current.playbackEpoch + 1,
    outputInterruptible: input.interruptible,
  });
}

export function completeRealtimeTurn(
  currentInput: RealtimeTurnState,
): RealtimeTurnState {
  const current = normalizeRealtimeTurn(currentInput);
  if (current.phase !== "generating" && current.phase !== "playing") {
    throw new Error("turn completion requires generated output");
  }
  return normalizeRealtimeTurn({
    ...current,
    phase: "completed",
    cancellationReason: null,
  });
}

export function failRealtimeTurn(input: {
  readonly current: RealtimeTurnState;
}): RealtimeTurnState {
  const current = normalizeRealtimeTurn(input.current);
  if (
    current.phase === "completed" ||
    current.phase === "cancelled" ||
    current.phase === "failed"
  ) {
    throw new Error("terminal turn cannot fail again");
  }
  return normalizeRealtimeTurn({
    ...current,
    phase: "failed",
    cancellationReason: null,
  });
}

export function requestBargeIn(input: {
  readonly current: RealtimeTurnState;
  readonly nextTurnId: string;
  readonly reason?: string;
}): BargeInDecision {
  const current = normalizeRealtimeTurn(input.current);

  if (
    current.phase === "completed" ||
    current.phase === "cancelled" ||
    current.phase === "failed"
  ) {
    return Object.freeze({
      accepted: false,
      cancelGeneration: null,
      next: current,
      reason: "terminal-turn" as const,
    });
  }

  if (current.phase !== "generating" && current.phase !== "playing") {
    return Object.freeze({
      accepted: false,
      cancelGeneration: null,
      next: current,
      reason: "nothing-to-interrupt" as const,
    });
  }

  if (!current.outputInterruptible) {
    return Object.freeze({
      accepted: false,
      cancelGeneration: null,
      next: current,
      reason: "output-protected" as const,
    });
  }

  const cancellationReason = boundedString(
    input.reason ?? "user-barge-in",
    "reason",
    1,
    500,
  );

  // We return the cancelled prior generation through cancelGeneration while the
  // new state starts a fresh generation. Adapters must cancel provider/playout
  // work for cancelGeneration before accepting output for next.generation.
  const next = createRealtimeTurn({
    presenceSessionId: current.presenceSessionId,
    turnId: input.nextTurnId,
    generation: current.generation + 1,
  });

  return Object.freeze({
    accepted: true,
    cancelGeneration: current.generation,
    next,
    reason: "accepted" as const,
    cancellationReason,
  }) as BargeInDecision;
}

export function assertCurrentRealtimeCallback(input: {
  readonly current: RealtimeTurnState;
  readonly generation: number;
  readonly playbackEpoch?: number;
}): void {
  const current = normalizeRealtimeTurn(input.current);
  const generation = positive(input.generation, "generation");
  if (generation !== current.generation) {
    throw new Error("stale realtime generation callback");
  }
  if (
    input.playbackEpoch !== undefined &&
    nonnegative(input.playbackEpoch, "playbackEpoch") !== current.playbackEpoch
  ) {
    throw new Error("stale playback epoch callback");
  }
}

export function protectCurrentOutput(
  currentInput: RealtimeTurnState,
): RealtimeTurnState {
  const current = normalizeRealtimeTurn(currentInput);
  if (current.phase !== "generating" && current.phase !== "playing") {
    throw new Error("only active output can be protected");
  }
  return normalizeRealtimeTurn({
    ...current,
    outputInterruptible: false,
  });
}

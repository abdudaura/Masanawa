export type PresenceSessionState =
  | "connecting"
  | "active"
  | "ended"
  | "failed";

export interface PresenceSession {
  readonly schemaVersion: 1;
  readonly presenceSessionId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly relationshipId: string;
  readonly characterId: string;
  readonly characterSessionId: string;
  readonly state: PresenceSessionState;
  /**
   * Opaque realtime transport handle only. This must never become Character,
   * Relationship, Workflow, payment or Memory truth.
   */
  readonly transportSessionRef: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly endedAt: string | null;
  readonly failureReason: string | null;
  readonly revision: number;
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

function canonicalLikeId(
  value: string,
  prefix: string,
  name: string,
): string {
  const normalized = boundedString(value, name, prefix.length + 8, 220);
  if (!normalized.startsWith(`${prefix}_`)) {
    throw new TypeError(`${name} must be a canonical ${prefix} id`);
  }
  return normalized;
}

function instant(value: string, name: string): string {
  const normalized = boundedString(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

export function normalizePresenceSession(
  input: PresenceSession,
): PresenceSession {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported PresenceSession schemaVersion");
  }
  if (
    input.state !== "connecting" &&
    input.state !== "active" &&
    input.state !== "ended" &&
    input.state !== "failed"
  ) {
    throw new TypeError("PresenceSession state is invalid");
  }

  const createdAt = instant(input.createdAt, "createdAt");
  const updatedAt = instant(input.updatedAt, "updatedAt");
  if (updatedAt < createdAt) {
    throw new Error("updatedAt cannot predate createdAt");
  }

  const endedAt =
    input.endedAt === null ? null : instant(input.endedAt, "endedAt");
  const failureReason =
    input.failureReason === null
      ? null
      : boundedString(input.failureReason, "failureReason", 1, 500);

  if (
    (input.state === "connecting" || input.state === "active") &&
    (endedAt !== null || failureReason !== null)
  ) {
    throw new Error("non-terminal PresenceSession cannot contain terminal fields");
  }

  if (input.state === "ended") {
    if (endedAt === null || failureReason !== null || endedAt !== updatedAt) {
      throw new Error("ended PresenceSession requires endedAt equal to updatedAt");
    }
  }

  if (input.state === "failed") {
    if (endedAt === null || failureReason === null || endedAt !== updatedAt) {
      throw new Error(
        "failed PresenceSession requires endedAt/failureReason at updatedAt",
      );
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    presenceSessionId: canonicalLikeId(
      input.presenceSessionId,
      "presence-session",
      "presenceSessionId",
    ),
    tenantId: canonicalLikeId(input.tenantId, "tenant", "tenantId"),
    userId: canonicalLikeId(input.userId, "user", "userId"),
    relationshipId: canonicalLikeId(
      input.relationshipId,
      "relationship",
      "relationshipId",
    ),
    characterId: canonicalLikeId(
      input.characterId,
      "character",
      "characterId",
    ),
    characterSessionId: canonicalLikeId(
      input.characterSessionId,
      "character-session",
      "characterSessionId",
    ),
    state: input.state,
    transportSessionRef:
      input.transportSessionRef === null
        ? null
        : boundedString(
            input.transportSessionRef,
            "transportSessionRef",
            1,
            500,
          ),
    createdAt,
    updatedAt,
    endedAt,
    failureReason,
    revision: revision(input.revision),
  });
}

export function transitionPresenceSession(input: {
  readonly current: PresenceSession;
  readonly nextState: Exclude<PresenceSessionState, "connecting">;
  readonly occurredAt: string;
  readonly transportSessionRef?: string | null;
  readonly failureReason?: string | null;
}): PresenceSession {
  const current = normalizePresenceSession(input.current);

  if (current.state === "ended" || current.state === "failed") {
    throw new Error("terminal PresenceSession cannot transition again");
  }

  const allowed =
    (current.state === "connecting" &&
      (input.nextState === "active" ||
        input.nextState === "ended" ||
        input.nextState === "failed")) ||
    (current.state === "active" &&
      (input.nextState === "ended" || input.nextState === "failed"));

  if (!allowed) {
    throw new Error(
      `Invalid PresenceSession transition: ${current.state} -> ${input.nextState}`,
    );
  }

  const occurredAt = instant(input.occurredAt, "occurredAt");
  if (occurredAt < current.updatedAt) {
    throw new Error("PresenceSession transition cannot move backward in time");
  }

  return normalizePresenceSession({
    ...current,
    state: input.nextState,
    revision: current.revision + 1,
    updatedAt: occurredAt,
    transportSessionRef:
      input.transportSessionRef === undefined
        ? current.transportSessionRef
        : input.transportSessionRef,
    endedAt:
      input.nextState === "ended" || input.nextState === "failed"
        ? occurredAt
        : null,
    failureReason:
      input.nextState === "failed"
        ? boundedString(
            input.failureReason ?? "",
            "failureReason",
            1,
            500,
          )
        : null,
  });
}

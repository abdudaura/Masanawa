export type CommitmentState =
  | "open"
  | "completed"
  | "cancelled"
  | "expired";

export interface CommitmentScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly relationshipId: string;
  readonly characterId: string;
}

export interface ProactiveCommitment {
  readonly schemaVersion: 1;
  readonly commitmentId: string;
  readonly revision: number;
  readonly scope: CommitmentScope;
  readonly promise: string;
  readonly createdAt: string;
  readonly dueAt: string;
  readonly followUpTriggerId: string;
  readonly state: CommitmentState;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly expiredAt: string | null;
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
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

function normalizeScope(scope: CommitmentScope): CommitmentScope {
  return Object.freeze({
    tenantId: canonicalLikeId(scope.tenantId, "tenant", "scope.tenantId"),
    userId: canonicalLikeId(scope.userId, "user", "scope.userId"),
    relationshipId: canonicalLikeId(
      scope.relationshipId,
      "relationship",
      "scope.relationshipId",
    ),
    characterId: canonicalLikeId(
      scope.characterId,
      "character",
      "scope.characterId",
    ),
  });
}

export function normalizeCommitment(
  input: ProactiveCommitment,
): ProactiveCommitment {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported commitment schemaVersion");
  }

  const createdAt = instant(input.createdAt, "createdAt");
  const dueAt = instant(input.dueAt, "dueAt");
  if (new Date(dueAt).getTime() <= new Date(createdAt).getTime()) {
    throw new Error("dueAt must be after createdAt");
  }

  if (
    input.state !== "open" &&
    input.state !== "completed" &&
    input.state !== "cancelled" &&
    input.state !== "expired"
  ) {
    throw new TypeError("state is invalid");
  }

  const completedAt =
    input.completedAt === null ? null : instant(input.completedAt, "completedAt");
  const cancelledAt =
    input.cancelledAt === null ? null : instant(input.cancelledAt, "cancelledAt");
  const expiredAt =
    input.expiredAt === null ? null : instant(input.expiredAt, "expiredAt");

  const terminalCount = [completedAt, cancelledAt, expiredAt].filter(
    (value) => value !== null,
  ).length;

  if (input.state === "open" && terminalCount !== 0) {
    throw new Error("open commitment must not contain terminal timestamps");
  }
  if (input.state === "completed" && (completedAt === null || terminalCount !== 1)) {
    throw new Error("completed commitment requires only completedAt");
  }
  if (input.state === "cancelled" && (cancelledAt === null || terminalCount !== 1)) {
    throw new Error("cancelled commitment requires only cancelledAt");
  }
  if (input.state === "expired" && (expiredAt === null || terminalCount !== 1)) {
    throw new Error("expired commitment requires only expiredAt");
  }

  return Object.freeze({
    schemaVersion: 1,
    commitmentId: boundedString(input.commitmentId, "commitmentId", 8, 180),
    revision: revision(input.revision),
    scope: normalizeScope(input.scope),
    promise: boundedString(input.promise, "promise", 1, 1_000),
    createdAt,
    dueAt,
    followUpTriggerId: boundedString(
      input.followUpTriggerId,
      "followUpTriggerId",
      8,
      180,
    ),
    state: input.state,
    completedAt,
    cancelledAt,
    expiredAt,
  });
}

export function transitionCommitment(input: {
  readonly current: ProactiveCommitment;
  readonly nextState: Exclude<CommitmentState, "open">;
  readonly occurredAt: string;
}): ProactiveCommitment {
  const current = normalizeCommitment(input.current);
  if (current.state !== "open") {
    throw new Error("terminal commitment cannot transition again");
  }

  const occurredAt = instant(input.occurredAt, "occurredAt");
  if (new Date(occurredAt).getTime() < new Date(current.createdAt).getTime()) {
    throw new Error("terminal transition cannot predate commitment creation");
  }

  if (input.nextState === "expired") {
    if (new Date(occurredAt).getTime() < new Date(current.dueAt).getTime()) {
      throw new Error("commitment cannot expire before dueAt");
    }
  }

  return normalizeCommitment({
    ...current,
    revision: current.revision + 1,
    state: input.nextState,
    completedAt: input.nextState === "completed" ? occurredAt : null,
    cancelledAt: input.nextState === "cancelled" ? occurredAt : null,
    expiredAt: input.nextState === "expired" ? occurredAt : null,
  });
}

export function commitmentNeedsFollowUp(
  commitment: ProactiveCommitment,
  now: string,
): boolean {
  const normalized = normalizeCommitment(commitment);
  if (normalized.state !== "open") return false;

  const instantNow = instant(now, "now");
  return new Date(instantNow).getTime() >= new Date(normalized.dueAt).getTime();
}

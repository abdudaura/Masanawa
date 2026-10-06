import {
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import {
  createProactiveTrigger,
  normalizeProactiveTriggerDefinition,
  type EventTriggerDefinition,
  type ProactiveTrigger,
  type ProactiveTriggerScope,
} from "./trigger.js";

export type ProactiveCommitmentKind = "promise" | "commitment";
export type ProactiveCommitmentParty = "character" | "user";
export type ProactiveCommitmentState = "open" | "fulfilled" | "cancelled";

export interface TimeCommitmentDue {
  readonly kind: "time";
  readonly at: Instant;
  readonly timezone: string;
}

export interface EventCommitmentDue {
  readonly kind: "event";
  readonly eventType: string;
  readonly sourceScope: EventTriggerDefinition["sourceScope"];
  readonly filters: Readonly<Record<string, string>>;
}

export interface ManualCommitmentDue {
  readonly kind: "manual";
}

export type ProactiveCommitmentDue =
  | TimeCommitmentDue
  | EventCommitmentDue
  | ManualCommitmentDue;

export interface ProactiveCommitment {
  readonly schemaVersion: 1;
  readonly scope: ProactiveTriggerScope;
  readonly commitmentKey: string;
  readonly kind: ProactiveCommitmentKind;
  readonly responsibleParty: ProactiveCommitmentParty;
  readonly statement: string;
  readonly due: ProactiveCommitmentDue;
  readonly state: ProactiveCommitmentState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly resolvedAt: Instant | null;
  readonly resolutionNote: string | null;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function stableKey(value: string, name: string, max = 140): string {
  const normalized = bounded(value, name, 1, max).toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

function normalizeScope(scope: ProactiveTriggerScope): ProactiveTriggerScope {
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", scope.tenantId),
    userId: parseCanonicalId("user", scope.userId),
    characterId: parseCanonicalId("character", scope.characterId),
    relationshipId: parseCanonicalId("relationship", scope.relationshipId),
  });
}

function normalizeDue(
  due: ProactiveCommitmentDue,
): ProactiveCommitmentDue {
  if (due.kind === "manual") {
    return Object.freeze({ kind: "manual" as const });
  }

  if (due.kind === "time") {
    const normalized = normalizeProactiveTriggerDefinition({
      kind: "schedule",
      timezone: due.timezone,
      schedule: {
        kind: "once",
        at: due.at,
      },
    });
    if (normalized.kind !== "schedule" || normalized.schedule.kind !== "once") {
      throw new Error("time commitment normalization failed");
    }
    return Object.freeze({
      kind: "time" as const,
      at: normalized.schedule.at,
      timezone: normalized.timezone,
    });
  }

  const normalized = normalizeProactiveTriggerDefinition({
    kind: "event",
    eventType: due.eventType,
    sourceScope: due.sourceScope,
    filters: due.filters,
  });
  if (normalized.kind !== "event") {
    throw new Error("event commitment normalization failed");
  }
  return Object.freeze({
    kind: "event" as const,
    eventType: normalized.eventType,
    sourceScope: normalized.sourceScope,
    filters: normalized.filters,
  });
}

function kind(value: ProactiveCommitmentKind): ProactiveCommitmentKind {
  if (value !== "promise" && value !== "commitment") {
    throw new TypeError("commitment kind is invalid");
  }
  return value;
}

function party(value: ProactiveCommitmentParty): ProactiveCommitmentParty {
  if (value !== "character" && value !== "user") {
    throw new TypeError("responsibleParty is invalid");
  }
  return value;
}

function state(value: ProactiveCommitmentState): ProactiveCommitmentState {
  if (value !== "open" && value !== "fulfilled" && value !== "cancelled") {
    throw new TypeError("commitment state is invalid");
  }
  return value;
}

export function normalizeProactiveCommitment(
  input: ProactiveCommitment,
): ProactiveCommitment {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported ProactiveCommitment schemaVersion");
  }

  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error("updatedAt cannot precede createdAt");
  }

  const due = normalizeDue(input.due);
  if (due.kind === "time" && Date.parse(due.at) < Date.parse(createdAt)) {
    throw new Error("time commitment cannot be due before creation");
  }

  const normalizedState = state(input.state);
  const resolvedAt =
    input.resolvedAt === null ? null : toInstant(input.resolvedAt);
  const resolutionNote =
    input.resolutionNote === null
      ? null
      : bounded(input.resolutionNote, "resolutionNote", 1, 1_000);

  if (normalizedState === "open") {
    if (resolvedAt !== null || resolutionNote !== null) {
      throw new Error("open commitment cannot carry resolution evidence");
    }
  } else {
    if (resolvedAt === null) {
      throw new Error("resolved commitment requires resolvedAt");
    }
    if (
      Date.parse(resolvedAt) < Date.parse(createdAt) ||
      Date.parse(resolvedAt) > Date.parse(updatedAt)
    ) {
      throw new Error("resolvedAt is outside commitment lifetime");
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    scope: normalizeScope(input.scope),
    commitmentKey: stableKey(input.commitmentKey, "commitmentKey"),
    kind: kind(input.kind),
    responsibleParty: party(input.responsibleParty),
    statement: bounded(input.statement, "statement", 1, 2_000),
    due,
    state: normalizedState,
    revision: revision(input.revision),
    createdAt,
    updatedAt,
    resolvedAt,
    resolutionNote,
  });
}

export function createProactiveCommitment(input: {
  readonly scope: ProactiveTriggerScope;
  readonly commitmentKey: string;
  readonly kind: ProactiveCommitmentKind;
  readonly responsibleParty: ProactiveCommitmentParty;
  readonly statement: string;
  readonly due: ProactiveCommitmentDue;
  readonly createdAt: Instant;
}): ProactiveCommitment {
  return normalizeProactiveCommitment({
    schemaVersion: 1,
    scope: input.scope,
    commitmentKey: input.commitmentKey,
    kind: input.kind,
    responsibleParty: input.responsibleParty,
    statement: input.statement,
    due: input.due,
    state: "open",
    revision: 1,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    resolvedAt: null,
    resolutionNote: null,
  });
}

export function reviseProactiveCommitment(input: {
  readonly commitment: ProactiveCommitment;
  readonly expectedRevision: number;
  readonly statement?: string;
  readonly due?: ProactiveCommitmentDue;
  readonly changedAt: Instant;
}): ProactiveCommitment {
  const current = normalizeProactiveCommitment(input.commitment);
  if (current.state !== "open") {
    throw new Error("resolved commitment cannot be revised");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("Proactive commitment revision is stale");
  }
  const changedAt = toInstant(input.changedAt);
  if (Date.parse(changedAt) < Date.parse(current.updatedAt)) {
    throw new Error("changedAt cannot precede current commitment state");
  }

  return normalizeProactiveCommitment({
    ...current,
    statement: input.statement ?? current.statement,
    due: input.due ?? current.due,
    revision: current.revision + 1,
    updatedAt: changedAt,
  });
}

export function resolveProactiveCommitment(input: {
  readonly commitment: ProactiveCommitment;
  readonly expectedRevision: number;
  readonly resolution: Exclude<ProactiveCommitmentState, "open">;
  readonly resolvedAt: Instant;
  readonly note?: string | null;
}): ProactiveCommitment {
  const current = normalizeProactiveCommitment(input.commitment);
  if (input.expectedRevision !== current.revision) {
    throw new Error("Proactive commitment revision is stale");
  }
  if (current.state !== "open") {
    if (current.state === input.resolution) {
      return current;
    }
    throw new Error("resolved commitment state is terminal");
  }
  if (input.resolution !== "fulfilled" && input.resolution !== "cancelled") {
    throw new TypeError("resolution is invalid");
  }

  const resolvedAt = toInstant(input.resolvedAt);
  if (Date.parse(resolvedAt) < Date.parse(current.updatedAt)) {
    throw new Error("resolvedAt cannot precede current commitment state");
  }

  return normalizeProactiveCommitment({
    ...current,
    state: input.resolution,
    revision: current.revision + 1,
    updatedAt: resolvedAt,
    resolvedAt,
    resolutionNote:
      input.note === undefined || input.note === null
        ? null
        : bounded(input.note, "resolutionNote", 1, 1_000),
  });
}

export function compileCommitmentFollowUpTrigger(input: {
  readonly commitment: ProactiveCommitment;
  readonly compiledAt: Instant;
}): ProactiveTrigger | null {
  const commitment = normalizeProactiveCommitment(input.commitment);
  if (commitment.state !== "open" || commitment.due.kind === "manual") {
    return null;
  }

  const definition =
    commitment.due.kind === "time"
      ? ({
          kind: "schedule",
          timezone: commitment.due.timezone,
          schedule: {
            kind: "once",
            at: commitment.due.at,
          },
        } as const)
      : ({
          kind: "event",
          eventType: commitment.due.eventType,
          sourceScope: commitment.due.sourceScope,
          filters: commitment.due.filters,
        } as const);

  return createProactiveTrigger({
    scope: commitment.scope,
    triggerKey: `followup.${commitment.commitmentKey}`,
    definition,
    createdAt: toInstant(input.compiledAt),
  });
}

import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type ProactiveTriggerState = "active" | "paused" | "revoked";

export interface ProactiveTriggerScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface OneShotSchedule {
  readonly kind: "once";
  readonly at: Instant;
}

export interface IntervalSchedule {
  readonly kind: "interval";
  readonly everySeconds: number;
  readonly startAt: Instant;
}

export interface DailySchedule {
  readonly kind: "daily";
  readonly localTime: string;
}

export interface WeeklySchedule {
  readonly kind: "weekly";
  readonly localTime: string;
  readonly weekdays: readonly number[];
}

export type ProactiveSchedule =
  | OneShotSchedule
  | IntervalSchedule
  | DailySchedule
  | WeeklySchedule;

export interface ScheduleTriggerDefinition {
  readonly kind: "schedule";
  readonly timezone: string;
  readonly schedule: ProactiveSchedule;
}

export interface EventTriggerDefinition {
  readonly kind: "event";
  readonly eventType: string;
  readonly sourceScope: "tenant" | "user" | "relationship" | "character";
  readonly filters: Readonly<Record<string, string>>;
}

export type ConditionOperator =
  | "equals"
  | "not-equals"
  | "greater-than"
  | "less-than"
  | "contains";

export interface ConditionTriggerDefinition {
  readonly kind: "condition";
  readonly observationKey: string;
  readonly operator: ConditionOperator;
  readonly expectedValue: string | number | boolean;
  readonly evaluationCadenceSeconds: number;
  readonly requireConsecutiveMatches: number;
  readonly cooldownSeconds: number;
}

export type ProactiveTriggerDefinition =
  | ScheduleTriggerDefinition
  | EventTriggerDefinition
  | ConditionTriggerDefinition;

export interface ProactiveTrigger {
  readonly schemaVersion: 1;
  readonly scope: ProactiveTriggerScope;
  readonly triggerKey: string;
  readonly state: ProactiveTriggerState;
  readonly definition: ProactiveTriggerDefinition;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
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
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function stableKey(value: string, name: string, max = 160): string {
  const normalized = bounded(value, name, 1, max).toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positiveInteger(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function timezone(value: string): string {
  const normalized = bounded(value, "timezone", 1, 120);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format();
  } catch {
    throw new TypeError("timezone must be a valid IANA timezone");
  }
  return normalized;
}

function localTime(value: string): string {
  const normalized = bounded(value, "localTime", 5, 5);
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/u.test(normalized)) {
    throw new TypeError("localTime must use HH:MM");
  }
  return normalized;
}

function normalizeScope(scope: ProactiveTriggerScope): ProactiveTriggerScope {
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", scope.tenantId),
    userId: parseCanonicalId("user", scope.userId),
    characterId: parseCanonicalId("character", scope.characterId),
    relationshipId: parseCanonicalId("relationship", scope.relationshipId),
  });
}

function normalizeFilters(
  filters: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (
    filters === null ||
    typeof filters !== "object" ||
    Array.isArray(filters)
  ) {
    throw new TypeError("event filters must be an object");
  }
  const entries = Object.entries(filters);
  if (entries.length > 16) {
    throw new RangeError("event filters exceed their bound");
  }
  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = stableKey(rawKey, "event filter key", 80);
    normalized[key] = bounded(rawValue, `event filter ${key}`, 1, 256);
  }
  return Object.freeze(normalized);
}

function normalizeSchedule(
  definition: ScheduleTriggerDefinition,
): ScheduleTriggerDefinition {
  const zone = timezone(definition.timezone);
  const schedule = definition.schedule;

  if (schedule.kind === "once") {
    return Object.freeze({
      kind: "schedule",
      timezone: zone,
      schedule: Object.freeze({
        kind: "once",
        at: toInstant(schedule.at),
      }),
    });
  }

  if (schedule.kind === "interval") {
    return Object.freeze({
      kind: "schedule",
      timezone: zone,
      schedule: Object.freeze({
        kind: "interval",
        everySeconds: positiveInteger(
          schedule.everySeconds,
          "everySeconds",
          300,
          31_536_000,
        ),
        startAt: toInstant(schedule.startAt),
      }),
    });
  }

  if (schedule.kind === "daily") {
    return Object.freeze({
      kind: "schedule",
      timezone: zone,
      schedule: Object.freeze({
        kind: "daily",
        localTime: localTime(schedule.localTime),
      }),
    });
  }

  if (schedule.kind === "weekly") {
    if (
      !Array.isArray(schedule.weekdays) ||
      schedule.weekdays.length < 1 ||
      schedule.weekdays.length > 7
    ) {
      throw new RangeError("weekdays must contain 1 to 7 days");
    }
    const weekdays = schedule.weekdays.map((day) =>
      positiveInteger(day, "weekday", 0, 6),
    );
    if (new Set(weekdays).size !== weekdays.length) {
      throw new TypeError("weekdays must be unique");
    }
    return Object.freeze({
      kind: "schedule",
      timezone: zone,
      schedule: Object.freeze({
        kind: "weekly",
        localTime: localTime(schedule.localTime),
        weekdays: Object.freeze([...weekdays].sort((a, b) => a - b)),
      }),
    });
  }

  throw new TypeError("schedule kind is invalid");
}

function normalizeEvent(
  definition: EventTriggerDefinition,
): EventTriggerDefinition {
  if (
    definition.sourceScope !== "tenant" &&
    definition.sourceScope !== "user" &&
    definition.sourceScope !== "relationship" &&
    definition.sourceScope !== "character"
  ) {
    throw new TypeError("sourceScope is invalid");
  }
  return Object.freeze({
    kind: "event",
    eventType: stableKey(definition.eventType, "eventType", 160),
    sourceScope: definition.sourceScope,
    filters: normalizeFilters(definition.filters),
  });
}

function normalizeCondition(
  definition: ConditionTriggerDefinition,
): ConditionTriggerDefinition {
  if (
    definition.operator !== "equals" &&
    definition.operator !== "not-equals" &&
    definition.operator !== "greater-than" &&
    definition.operator !== "less-than" &&
    definition.operator !== "contains"
  ) {
    throw new TypeError("condition operator is invalid");
  }

  if (
    typeof definition.expectedValue !== "string" &&
    typeof definition.expectedValue !== "number" &&
    typeof definition.expectedValue !== "boolean"
  ) {
    throw new TypeError("expectedValue is invalid");
  }
  if (
    typeof definition.expectedValue === "number" &&
    !Number.isFinite(definition.expectedValue)
  ) {
    throw new TypeError("expectedValue must be finite");
  }
  const expectedValue =
    typeof definition.expectedValue === "string"
      ? bounded(definition.expectedValue, "expectedValue", 1, 512)
      : definition.expectedValue;

  if (
    (definition.operator === "greater-than" ||
      definition.operator === "less-than") &&
    typeof expectedValue !== "number"
  ) {
    throw new TypeError(
      "numeric condition operators require a numeric expectedValue",
    );
  }
  if (
    definition.operator === "contains" &&
    typeof expectedValue !== "string"
  ) {
    throw new TypeError("contains requires a string expectedValue");
  }

  return Object.freeze({
    kind: "condition",
    observationKey: stableKey(
      definition.observationKey,
      "observationKey",
      160,
    ),
    operator: definition.operator,
    expectedValue,
    evaluationCadenceSeconds: positiveInteger(
      definition.evaluationCadenceSeconds,
      "evaluationCadenceSeconds",
      300,
      86_400,
    ),
    requireConsecutiveMatches: positiveInteger(
      definition.requireConsecutiveMatches,
      "requireConsecutiveMatches",
      1,
      10,
    ),
    cooldownSeconds: positiveInteger(
      definition.cooldownSeconds,
      "cooldownSeconds",
      0,
      604_800,
    ),
  });
}

export function normalizeProactiveTriggerDefinition(
  definition: ProactiveTriggerDefinition,
): ProactiveTriggerDefinition {
  if (definition.kind === "schedule") return normalizeSchedule(definition);
  if (definition.kind === "event") return normalizeEvent(definition);
  if (definition.kind === "condition") return normalizeCondition(definition);
  throw new TypeError("trigger definition kind is invalid");
}

function revision(value: number): number {
  return positiveInteger(value, "revision", 1, 2_147_483_647);
}

function state(value: ProactiveTriggerState): ProactiveTriggerState {
  if (value !== "active" && value !== "paused" && value !== "revoked") {
    throw new TypeError("trigger state is invalid");
  }
  return value;
}

export function normalizeProactiveTrigger(
  input: ProactiveTrigger,
): ProactiveTrigger {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported ProactiveTrigger schemaVersion");
  }
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error("updatedAt cannot precede createdAt");
  }

  return Object.freeze({
    schemaVersion: 1,
    scope: normalizeScope(input.scope),
    triggerKey: stableKey(input.triggerKey, "triggerKey", 160),
    state: state(input.state),
    definition: normalizeProactiveTriggerDefinition(input.definition),
    revision: revision(input.revision),
    createdAt,
    updatedAt,
  });
}

export function createProactiveTrigger(input: {
  readonly scope: ProactiveTriggerScope;
  readonly triggerKey: string;
  readonly definition: ProactiveTriggerDefinition;
  readonly createdAt: Instant;
}): ProactiveTrigger {
  return normalizeProactiveTrigger({
    schemaVersion: 1,
    scope: input.scope,
    triggerKey: input.triggerKey,
    state: "active",
    definition: input.definition,
    revision: 1,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function reviseProactiveTrigger(input: {
  readonly trigger: ProactiveTrigger;
  readonly expectedRevision: number;
  readonly definition: ProactiveTriggerDefinition;
  readonly changedAt: Instant;
}): ProactiveTrigger {
  const current = normalizeProactiveTrigger(input.trigger);
  if (current.state === "revoked") {
    throw new Error("revoked trigger cannot be revised");
  }
  if (input.expectedRevision !== current.revision) {
    throw new Error("Proactive trigger revision is stale");
  }
  const changedAt = toInstant(input.changedAt);
  if (Date.parse(changedAt) < Date.parse(current.updatedAt)) {
    throw new Error("changedAt cannot precede current trigger state");
  }

  return normalizeProactiveTrigger({
    ...current,
    definition: input.definition,
    revision: current.revision + 1,
    updatedAt: changedAt,
  });
}

export function transitionProactiveTrigger(input: {
  readonly trigger: ProactiveTrigger;
  readonly expectedRevision: number;
  readonly state: Exclude<ProactiveTriggerState, "active"> | "active";
  readonly changedAt: Instant;
}): ProactiveTrigger {
  const current = normalizeProactiveTrigger(input.trigger);
  if (input.expectedRevision !== current.revision) {
    throw new Error("Proactive trigger revision is stale");
  }
  const nextState = state(input.state);
  if (current.state === "revoked" && nextState !== "revoked") {
    throw new Error("revoked trigger is terminal");
  }
  const changedAt = toInstant(input.changedAt);
  if (Date.parse(changedAt) < Date.parse(current.updatedAt)) {
    throw new Error("changedAt cannot precede current trigger state");
  }
  if (nextState === current.state) {
    return current;
  }

  return normalizeProactiveTrigger({
    ...current,
    state: nextState,
    revision: current.revision + 1,
    updatedAt: changedAt,
  });
}

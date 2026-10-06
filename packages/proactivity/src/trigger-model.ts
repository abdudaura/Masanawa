export type ProactiveTriggerKind = "schedule" | "event" | "condition";

export interface ProactiveTriggerScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly relationshipId: string;
  readonly characterId: string;
}

export interface ProactiveTriggerBase {
  readonly schemaVersion: 1;
  readonly triggerId: string;
  readonly revision: number;
  readonly enabled: boolean;
  readonly scope: ProactiveTriggerScope;
  readonly purpose: string;
  readonly dedupeKey: string;
}

export interface ScheduleTrigger extends ProactiveTriggerBase {
  readonly kind: "schedule";
  readonly schedule: {
    readonly mode: "at" | "cron";
    readonly at?: string;
    readonly cron?: string;
    readonly timeZone: string;
  };
}

export interface EventTrigger extends ProactiveTriggerBase {
  readonly kind: "event";
  readonly event: {
    readonly eventType: string;
    readonly source: "perception" | "workflow" | "world" | "channel" | "system";
  };
}

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains";

export type ConditionScalar = string | number | boolean;

export interface ConditionTrigger extends ProactiveTriggerBase {
  readonly kind: "condition";
  readonly condition: {
    readonly signalKey: string;
    readonly operator: ConditionOperator;
    readonly expected: ConditionScalar;
  };
}

export type ProactiveTrigger =
  | ScheduleTrigger
  | EventTrigger
  | ConditionTrigger;

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

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

function normalizeScope(scope: ProactiveTriggerScope): ProactiveTriggerScope {
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

function normalizeBase(input: ProactiveTriggerBase): ProactiveTriggerBase {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported proactive trigger schemaVersion");
  }
  if (typeof input.enabled !== "boolean") {
    throw new TypeError("enabled must be boolean");
  }

  return Object.freeze({
    schemaVersion: 1,
    triggerId: boundedString(input.triggerId, "triggerId", 8, 180),
    revision: revision(input.revision),
    enabled: input.enabled,
    scope: normalizeScope(input.scope),
    purpose: boundedString(input.purpose, "purpose", 1, 120).toLowerCase(),
    dedupeKey: boundedString(input.dedupeKey, "dedupeKey", 8, 256),
  });
}

function parseInstant(value: string, name: string): string {
  const normalized = boundedString(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

function validateCron(value: string): string {
  const cron = boundedString(value, "schedule.cron", 9, 120);
  const fields = cron.split(/\s+/u);
  if (fields.length !== 5) {
    throw new TypeError("schedule.cron must contain exactly 5 fields");
  }
  if (fields.some((field) => !/^[0-9*,\/-]+$/u.test(field))) {
    throw new TypeError("schedule.cron contains unsupported syntax");
  }
  return cron;
}

function validateTimeZone(value: string): string {
  const timeZone = boundedString(value, "schedule.timeZone", 1, 100);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new TypeError("schedule.timeZone is invalid");
  }
  return timeZone;
}

export function normalizeProactiveTrigger(input: ProactiveTrigger): ProactiveTrigger {
  const base = normalizeBase(input);

  if (input.kind === "schedule") {
    const timeZone = validateTimeZone(input.schedule.timeZone);
    if (input.schedule.mode === "at") {
      if (!input.schedule.at || input.schedule.cron !== undefined) {
        throw new Error("at schedule requires only schedule.at");
      }
      return Object.freeze({
        ...base,
        kind: "schedule",
        schedule: Object.freeze({
          mode: "at" as const,
          at: parseInstant(input.schedule.at, "schedule.at"),
          timeZone,
        }),
      });
    }
    if (input.schedule.mode === "cron") {
      if (!input.schedule.cron || input.schedule.at !== undefined) {
        throw new Error("cron schedule requires only schedule.cron");
      }
      return Object.freeze({
        ...base,
        kind: "schedule",
        schedule: Object.freeze({
          mode: "cron" as const,
          cron: validateCron(input.schedule.cron),
          timeZone,
        }),
      });
    }
    throw new TypeError("schedule.mode is invalid");
  }

  if (input.kind === "event") {
    if (
      input.event.source !== "perception" &&
      input.event.source !== "workflow" &&
      input.event.source !== "world" &&
      input.event.source !== "channel" &&
      input.event.source !== "system"
    ) {
      throw new TypeError("event.source is invalid");
    }

    return Object.freeze({
      ...base,
      kind: "event",
      event: Object.freeze({
        eventType: boundedString(
          input.event.eventType,
          "event.eventType",
          1,
          160,
        ).toLowerCase(),
        source: input.event.source,
      }),
    });
  }

  if (input.kind === "condition") {
    const operator = input.condition.operator;
    if (
      operator !== "eq" &&
      operator !== "neq" &&
      operator !== "gt" &&
      operator !== "gte" &&
      operator !== "lt" &&
      operator !== "lte" &&
      operator !== "contains"
    ) {
      throw new TypeError("condition.operator is invalid");
    }

    const expected = input.condition.expected;
    if (
      typeof expected !== "string" &&
      typeof expected !== "number" &&
      typeof expected !== "boolean"
    ) {
      throw new TypeError("condition.expected must be a scalar");
    }
    if (typeof expected === "number" && !Number.isFinite(expected)) {
      throw new RangeError("condition.expected number is invalid");
    }
    if (
      (operator === "gt" ||
        operator === "gte" ||
        operator === "lt" ||
        operator === "lte") &&
      typeof expected !== "number"
    ) {
      throw new TypeError(`${operator} condition requires numeric expected value`);
    }
    if (operator === "contains" && typeof expected !== "string") {
      throw new TypeError("contains condition requires string expected value");
    }

    return Object.freeze({
      ...base,
      kind: "condition",
      condition: Object.freeze({
        signalKey: boundedString(
          input.condition.signalKey,
          "condition.signalKey",
          1,
          160,
        ),
        operator,
        expected:
          typeof expected === "string"
            ? boundedString(expected, "condition.expected", 0, 512)
            : expected,
      }),
    });
  }

  throw new TypeError("trigger kind is invalid");
}

export function proactiveTriggerIdentity(
  trigger: ProactiveTrigger,
): string {
  const normalized = normalizeProactiveTrigger(trigger);
  return [
    normalized.scope.tenantId,
    normalized.scope.relationshipId,
    normalized.scope.characterId,
    normalized.triggerId,
    String(normalized.revision),
  ].join(":");
}

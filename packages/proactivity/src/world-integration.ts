import {
  normalizeProactiveTrigger,
  type EventTrigger,
  type ProactiveTriggerScope,
  type ScheduleTrigger,
} from "./trigger-model.js";

export interface WorldRoutineTriggerSource {
  readonly tenantId: string;
  readonly worldId: string;
  readonly routineKey: string;
  readonly characterId: string;
  readonly timezone: string;
  readonly localTime: string;
  readonly enabled: boolean;
  readonly revision: number;
}

export interface WorldEventTriggerSource {
  readonly tenantId: string;
  readonly worldEventId: string;
  readonly worldId: string;
  readonly characterId: string | null;
  readonly eventKind: string;
  readonly visibility: "public" | "shared" | "internal" | "private";
  readonly canonState: "draft" | "approved" | "retired";
  readonly occurrenceKey: string | null;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new RangeError("source revision is invalid");
  }
  return value;
}

function assertScope(input: {
  readonly scope: ProactiveTriggerScope;
  readonly tenantId: string;
  readonly characterId: string | null;
}): void {
  if (input.tenantId !== input.scope.tenantId) {
    throw new Error("World source belongs to another Tenant");
  }
  if (input.characterId === null) {
    throw new Error("World-wide events require an explicit fan-out owner before proactivity");
  }
  if (input.characterId !== input.scope.characterId) {
    throw new Error("World source belongs to another Character");
  }
}

function localTime(value: string): { readonly hour: number; readonly minute: number } {
  const normalized = bounded(value, "routine.localTime", 5, 5);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(normalized)) {
    throw new TypeError("routine.localTime must be HH:MM");
  }
  const [hour, minute] = normalized.split(":").map(Number);
  return { hour: hour!, minute: minute! };
}

function sourceDedupe(parts: readonly string[]): string {
  return parts.map((part) => encodeURIComponent(bounded(part, "dedupe component", 1, 220))).join(":");
}

export function projectWorldRoutineTrigger(input: {
  readonly routine: WorldRoutineTriggerSource;
  readonly scope: ProactiveTriggerScope;
  readonly triggerId: string;
  readonly purpose: string;
}): ScheduleTrigger {
  if (!input.routine.enabled) {
    throw new Error("Disabled World routine cannot create a proactive trigger");
  }
  assertScope({
    scope: input.scope,
    tenantId: input.routine.tenantId,
    characterId: input.routine.characterId,
  });

  const sourceRevision = revision(input.routine.revision);
  const { hour, minute } = localTime(input.routine.localTime);
  const trigger: ScheduleTrigger = {
    schemaVersion: 1,
    triggerId: input.triggerId,
    revision: sourceRevision,
    enabled: true,
    scope: input.scope,
    purpose: input.purpose,
    dedupeKey: sourceDedupe([
      "world-routine",
      input.routine.worldId,
      input.routine.routineKey,
      String(sourceRevision),
    ]),
    kind: "schedule",
    schedule: {
      mode: "cron",
      cron: `${minute} ${hour} * * *`,
      timeZone: input.routine.timezone,
    },
  };

  return normalizeProactiveTrigger(trigger) as ScheduleTrigger;
}

export function projectWorldEventTrigger(input: {
  readonly event: WorldEventTriggerSource;
  readonly scope: ProactiveTriggerScope;
  readonly triggerId: string;
  readonly triggerRevision: number;
  readonly purpose: string;
}): EventTrigger {
  if (input.event.canonState !== "approved") {
    throw new Error("Only approved World canon may create proactive event triggers");
  }
  if (input.event.visibility !== "public" && input.event.visibility !== "shared") {
    throw new Error("Internal/private World events cannot create user-facing proactivity");
  }
  assertScope({
    scope: input.scope,
    tenantId: input.event.tenantId,
    characterId: input.event.characterId,
  });

  const eventKind = bounded(input.event.eventKind, "event.eventKind", 1, 160).toLowerCase();
  const sourceIdentity =
    input.event.occurrenceKey === null
      ? input.event.worldEventId
      : input.event.occurrenceKey;

  const trigger: EventTrigger = {
    schemaVersion: 1,
    triggerId: input.triggerId,
    revision: revision(input.triggerRevision),
    enabled: true,
    scope: input.scope,
    purpose: input.purpose,
    dedupeKey: sourceDedupe([
      "world-event",
      input.event.worldId,
      sourceIdentity,
    ]),
    kind: "event",
    event: {
      eventType: eventKind,
      source: "world",
    },
  };

  return normalizeProactiveTrigger(trigger) as EventTrigger;
}

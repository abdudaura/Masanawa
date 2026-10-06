import {
  normalizeProactiveTrigger,
  type EventTrigger,
  type ProactiveTriggerScope,
  type ScheduleTrigger,
} from "./trigger-model.js";

export interface WorldRoutineSnapshot {
  readonly tenantId: string;
  readonly worldId: string;
  readonly routineKey: string;
  readonly characterId: string;
  readonly timezone: string;
  readonly localTime: string;
  readonly enabled: boolean;
  readonly revision: number;
}

export interface WorldEventSnapshot {
  readonly tenantId: string;
  readonly worldEventId: string;
  readonly worldId: string;
  readonly characterId: string | null;
  readonly eventKind: string;
  readonly visibility: "public" | "shared" | "internal" | "private";
  readonly canonState: "draft" | "approved" | "retired";
  readonly effectiveStart: string;
  readonly occurrenceKey: string | null;
}

export interface ProactivityProjectionScope extends ProactiveTriggerScope {
  readonly purpose: string;
}

function localTime(value: string): { hour: number; minute: number } {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
    throw new TypeError("routine.localTime must be HH:MM");
  }
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour!, minute: minute! };
}

export function projectRoutineTrigger(input: {
  readonly routine: WorldRoutineSnapshot;
  readonly scope: ProactivityProjectionScope;
}): ScheduleTrigger | null {
  const { routine, scope } = input;
  if (!routine.enabled) return null;
  if (routine.tenantId !== scope.tenantId) {
    throw new Error("Routine tenant does not match proactive scope");
  }
  if (routine.characterId !== scope.characterId) {
    throw new Error("Routine Character does not match proactive scope");
  }

  const { hour, minute } = localTime(routine.localTime);
  return normalizeProactiveTrigger({
    schemaVersion: 1,
    triggerId: `routine:${routine.worldId}:${routine.routineKey}`,
    revision: routine.revision,
    enabled: true,
    scope: {
      tenantId: scope.tenantId,
      userId: scope.userId,
      relationshipId: scope.relationshipId,
      characterId: scope.characterId,
    },
    purpose: scope.purpose,
    dedupeKey: `routine:${routine.worldId}:${routine.routineKey}:${routine.revision}`,
    kind: "schedule",
    schedule: {
      mode: "cron",
      cron: `${minute} ${hour} * * *`,
      timeZone: routine.timezone,
    },
  }) as ScheduleTrigger;
}

export function projectWorldEventTrigger(input: {
  readonly event: WorldEventSnapshot;
  readonly scope: ProactivityProjectionScope;
}): EventTrigger | null {
  const { event, scope } = input;

  if (event.canonState !== "approved") return null;
  if (event.visibility !== "public" && event.visibility !== "shared") return null;

  if (event.tenantId !== scope.tenantId) {
    throw new Error("WorldEvent tenant does not match proactive scope");
  }
  if (event.characterId !== null && event.characterId !== scope.characterId) {
    return null;
  }

  const occurrenceIdentity =
    event.occurrenceKey === null ? event.worldEventId : event.occurrenceKey;

  return normalizeProactiveTrigger({
    schemaVersion: 1,
    triggerId: `world-event:${event.worldEventId}`,
    revision: 1,
    enabled: true,
    scope: {
      tenantId: scope.tenantId,
      userId: scope.userId,
      relationshipId: scope.relationshipId,
      characterId: scope.characterId,
    },
    purpose: scope.purpose,
    dedupeKey: `world:${event.worldId}:${occurrenceIdentity}`,
    kind: "event",
    event: {
      source: "world",
      eventType: `world.${event.eventKind}`,
    },
  }) as EventTrigger;
}

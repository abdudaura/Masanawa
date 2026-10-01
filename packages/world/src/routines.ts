import { toInstant, type CharacterId, type Instant } from "@masanawa/contracts";

const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function normalizeRoutineKey(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    throw new TypeError("routineKey is invalid");
  }
  return normalized;
}

export function normalizeIanaTimezone(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    throw new TypeError("timezone is invalid");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(0);
  } catch {
    throw new TypeError("timezone must be a supported IANA time zone");
  }
  return normalized;
}

export function normalizeLocalTime(value: string): string {
  const normalized = value.trim();
  if (!localTimePattern.test(normalized)) {
    throw new TypeError("localTime must be HH:MM");
  }
  return normalized;
}

export interface RoutineLocalOccurrence {
  readonly localDate: string;
  readonly localTime: string;
}

export function routineLocalOccurrence(
  scheduledFor: Instant,
  timezoneInput: string,
): RoutineLocalOccurrence {
  const timezone = normalizeIanaTimezone(timezoneInput);
  const instant = toInstant(scheduledFor);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));

  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (!value) throw new Error(`Missing Intl date part: ${type}`);
    return value;
  };

  return Object.freeze({
    localDate: `${part("year")}-${part("month")}-${part("day")}`,
    localTime: `${part("hour")}:${part("minute")}`,
  });
}

export function assertRoutineScheduledTime(
  scheduledFor: Instant,
  timezone: string,
  expectedLocalTime: string,
): RoutineLocalOccurrence {
  const expected = normalizeLocalTime(expectedLocalTime);
  const occurrence = routineLocalOccurrence(scheduledFor, timezone);
  if (occurrence.localTime !== expected) {
    throw new TypeError(
      `scheduledFor resolves to ${occurrence.localTime}, expected ${expected}`,
    );
  }
  return occurrence;
}

export function routineOccurrenceKey(
  characterId: CharacterId,
  routineKeyInput: string,
  localDate: string,
): string {
  const routineKey = normalizeRoutineKey(routineKeyInput);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(localDate)) {
    throw new TypeError("localDate must be YYYY-MM-DD");
  }
  return `routine:${characterId}:${routineKey}:${localDate}`;
}

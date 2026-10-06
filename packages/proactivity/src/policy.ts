export type ProactivityPrivacyScope =
  | "user-private"
  | "relationship"
  | "character-private";

export interface QuietHoursPolicy {
  readonly enabled: boolean;
  readonly startLocalTime: string;
  readonly endLocalTime: string;
  readonly timeZone: string;
}

export interface ProactivityPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly relationshipEnabled: boolean;
  readonly allowedPrivacyScopes: readonly ProactivityPrivacyScope[];
  readonly maxActionsPerHour: number;
  readonly maxActionsPerDay: number;
  readonly quietHours: QuietHoursPolicy;
}

export interface ProactivityAttempt {
  readonly privacyScope: ProactivityPrivacyScope;
  readonly now: string;
  readonly actionsLastHour: number;
  readonly actionsLastDay: number;
}

export interface ProactivityPolicyDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "relationship-disabled"
    | "privacy-scope-denied"
    | "quiet-hours"
    | "hourly-limit"
    | "daily-limit";
}

function integer(
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

function parseLocalTime(value: string, name: string): {
  readonly hour: number;
  readonly minute: number;
} {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
    throw new TypeError(`${name} must be HH:MM`);
  }
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour!, minute: minute! };
}

function validateTimeZone(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("quietHours.timeZone is invalid");
  }
  const timeZone = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new TypeError("quietHours.timeZone is invalid");
  }
  return timeZone;
}

function normalizedScopes(
  scopes: readonly ProactivityPrivacyScope[],
): readonly ProactivityPrivacyScope[] {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > 3) {
    throw new RangeError("allowedPrivacyScopes must contain 1 to 3 items");
  }
  const values = [...new Set(scopes)];
  if (
    values.some(
      (scope) =>
        scope !== "user-private" &&
        scope !== "relationship" &&
        scope !== "character-private",
    )
  ) {
    throw new TypeError("allowedPrivacyScopes contains invalid scope");
  }
  return Object.freeze(values);
}

export function normalizeProactivityPolicy(
  input: ProactivityPolicy,
): ProactivityPolicy {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported proactivity policy");
  }
  if (typeof input.relationshipEnabled !== "boolean") {
    throw new TypeError("relationshipEnabled must be boolean");
  }
  if (typeof input.quietHours.enabled !== "boolean") {
    throw new TypeError("quietHours.enabled must be boolean");
  }

  parseLocalTime(input.quietHours.startLocalTime, "quietHours.startLocalTime");
  parseLocalTime(input.quietHours.endLocalTime, "quietHours.endLocalTime");

  return Object.freeze({
    schemaVersion: 1,
    revision: integer(input.revision, "revision", 1, 2_147_483_647),
    relationshipEnabled: input.relationshipEnabled,
    allowedPrivacyScopes: normalizedScopes(input.allowedPrivacyScopes),
    maxActionsPerHour: integer(
      input.maxActionsPerHour,
      "maxActionsPerHour",
      1,
      10_000,
    ),
    maxActionsPerDay: integer(
      input.maxActionsPerDay,
      "maxActionsPerDay",
      input.maxActionsPerHour,
      100_000,
    ),
    quietHours: Object.freeze({
      enabled: input.quietHours.enabled,
      startLocalTime: input.quietHours.startLocalTime,
      endLocalTime: input.quietHours.endLocalTime,
      timeZone: validateTimeZone(input.quietHours.timeZone),
    }),
  });
}

function localMinutes(now: string, timeZone: string): number {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("now is invalid");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Could not resolve local quiet-hours time");
  }
  return hour * 60 + minute;
}

function isWithinQuietHours(
  now: string,
  quietHours: QuietHoursPolicy,
): boolean {
  if (!quietHours.enabled) return false;

  const start = parseLocalTime(
    quietHours.startLocalTime,
    "quietHours.startLocalTime",
  );
  const end = parseLocalTime(
    quietHours.endLocalTime,
    "quietHours.endLocalTime",
  );
  const current = localMinutes(now, quietHours.timeZone);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (startMinutes === endMinutes) return true;

  if (startMinutes < endMinutes) {
    return current >= startMinutes && current < endMinutes;
  }
  return current >= startMinutes || current < endMinutes;
}

export function evaluateProactivityPolicy(input: {
  readonly policy: ProactivityPolicy;
  readonly attempt: ProactivityAttempt;
}): ProactivityPolicyDecision {
  const policy = normalizeProactivityPolicy(input.policy);

  if (
    input.attempt.privacyScope !== "user-private" &&
    input.attempt.privacyScope !== "relationship" &&
    input.attempt.privacyScope !== "character-private"
  ) {
    throw new TypeError("privacyScope is invalid");
  }

  const actionsLastHour = integer(
    input.attempt.actionsLastHour,
    "actionsLastHour",
    0,
    1_000_000,
  );
  const actionsLastDay = integer(
    input.attempt.actionsLastDay,
    "actionsLastDay",
    0,
    10_000_000,
  );

  if (!policy.relationshipEnabled) {
    return { allowed: false, reason: "relationship-disabled" };
  }
  if (!policy.allowedPrivacyScopes.includes(input.attempt.privacyScope)) {
    return { allowed: false, reason: "privacy-scope-denied" };
  }
  if (isWithinQuietHours(input.attempt.now, policy.quietHours)) {
    return { allowed: false, reason: "quiet-hours" };
  }
  if (actionsLastHour >= policy.maxActionsPerHour) {
    return { allowed: false, reason: "hourly-limit" };
  }
  if (actionsLastDay >= policy.maxActionsPerDay) {
    return { allowed: false, reason: "daily-limit" };
  }

  return { allowed: true, reason: "allowed" };
}

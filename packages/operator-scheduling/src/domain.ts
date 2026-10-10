import { createHash } from "node:crypto";

export type ScheduleKind = "talk_reminder" | "lesson_followup" | "artifact_ready";
export type Frequency = "once" | "daily" | "weekly";
export type ScheduleState = "active" | "paused" | "cancelled";
export interface ScheduleSpec {
  readonly kind: ScheduleKind;
  readonly referenceId: string;
  readonly frequency: Frequency;
  readonly timezone: string;
  readonly runAt?: string;
  readonly localTime?: string;
  readonly dayOfWeek?: number;
  readonly quietStart: string;
  readonly quietEnd: string;
  readonly optedIn: true;
}
export interface ScheduleRecord extends ScheduleSpec {
  readonly id: string;
  readonly state: ScheduleState;
  readonly revision: number;
  readonly nextDueAt: string | null;
}
export class ScheduleError extends Error {
  constructor(readonly code: string, readonly statusCode = 400) {
    super(code);
    this.name = "ScheduleError";
  }
}
const MINUTE = 60_000;
const DAY = 86_400_000;
function requiredTime(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
    throw new ScheduleError(`schedule.${name}_invalid`);
  }
  return value;
}
function minuteOfDay(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
export function isQuiet(localTime: string, start: string, end: string): boolean {
  const n = minuteOfDay(localTime);
  const a = minuteOfDay(start);
  const b = minuteOfDay(end);
  return a === b ? false : a < b ? n >= a && n < b : n >= a || n < b;
}
export function timezoneParts(epochMs: number, timezone: string): {
  date: string;
  dayOfWeek: number;
  localTime: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(epochMs));
  const get = (kind: string) => parts.find((p) => p.type === kind)?.value ?? "";
  const y = +get("year"), m = +get("month"), d = +get("day");
  const isoDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    dayOfWeek: isoDay === 0 ? 7 : isoDay,
    localTime: `${get("hour")}:${get("minute")}`,
  };
}
function parseInstant(value: string): number {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) {
    throw new ScheduleError("schedule.instant_invalid");
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new ScheduleError("schedule.instant_invalid");
  return ms;
}
/** Choose earliest future minute in the requested IANA civil time.
 * Missing DST hour is skipped; repeated DST hour never runs twice per date.
 */
export function nextOccurrence(spec: ScheduleSpec, afterMs: number, excludedLocalDate?: string): string | null {
  if (spec.frequency === "once") {
    const when = parseInstant(spec.runAt!);
    return when > afterMs ? new Date(when).toISOString() : null;
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: spec.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const seen = new Set<string>();
  // A repeated fall-back civil minute is never a second daily occurrence.
  const previous = timezoneParts(afterMs, spec.timezone);
  const skipLocalDate = excludedLocalDate ??
    (previous.localTime >= spec.localTime! ? previous.date : null);
  const start = Math.floor(afterMs / MINUTE) * MINUTE + MINUTE;
  for (let t = start; t < start + 8 * DAY; t += MINUTE) {
    const parts = formatter.formatToParts(new Date(t));
    const get = (kind: string) => parts.find((p) => p.type === kind)?.value ?? "";
    if (`${get("hour")}:${get("minute")}` !== spec.localTime) continue;
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    if (date === skipLocalDate || seen.has(date)) continue;
    seen.add(date);
    if (spec.frequency === "weekly") {
      const wd = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day"))).getUTCDay();
      if ((wd || 7) !== spec.dayOfWeek) continue;
    }
    return new Date(t).toISOString();
  }
  throw new ScheduleError("schedule.next_occurrence_unavailable", 422);
}
export function validateSpec(raw: unknown, nowMs: number): ScheduleSpec {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ScheduleError("schedule.invalid");
  }
  const obj = raw as Record<string, unknown>;
  const allowed = new Set(["kind","referenceId","frequency","timezone","runAt",
    "localTime","dayOfWeek","quietStart","quietEnd","optedIn"]);
  if (Object.keys(obj).some((k) => !allowed.has(k))) {
    throw new ScheduleError("schedule.unexpected_field");
  }
  if (!["talk_reminder","lesson_followup","artifact_ready"].includes(String(obj.kind))) {
    throw new ScheduleError("schedule.kind_invalid");
  }
  if (typeof obj.referenceId !== "string" ||
      !/^[a-zA-Z0-9_:-]{5,160}$/.test(obj.referenceId)) {
    throw new ScheduleError("schedule.reference_invalid");
  }
  if (!["once","daily","weekly"].includes(String(obj.frequency))) {
    throw new ScheduleError("schedule.frequency_invalid");
  }
  if (obj.optedIn !== true) throw new ScheduleError("schedule.consent_required", 403);
  if (typeof obj.timezone !== "string" || obj.timezone.length > 80) {
    throw new ScheduleError("schedule.timezone_invalid");
  }
  try { new Intl.DateTimeFormat("en-GB", {timeZone: obj.timezone}).format(new Date()); }
  catch { throw new ScheduleError("schedule.timezone_invalid"); }
  const quietStart = requiredTime(obj.quietStart, "quiet_start");
  const quietEnd = requiredTime(obj.quietEnd, "quiet_end");
  const freq = obj.frequency as Frequency;
  const once = freq === "once";
  if (once !== (typeof obj.runAt === "string") ||
      (!once && typeof obj.localTime !== "string") ||
      (once && obj.localTime !== undefined) ||
      (freq !== "weekly" && obj.dayOfWeek !== undefined) ||
      (freq === "weekly" && (!Number.isInteger(obj.dayOfWeek) ||
        (obj.dayOfWeek as number) < 1 || (obj.dayOfWeek as number) > 7))) {
    throw new ScheduleError("schedule.cadence_invalid");
  }
  const localTime = !once ? requiredTime(obj.localTime, "local_time") : undefined;
  const runAt = once ? new Date(parseInstant(obj.runAt as string)).toISOString() : undefined;
  if (localTime && isQuiet(localTime, quietStart, quietEnd)) {
    throw new ScheduleError("schedule.time_during_quiet_hours");
  }
  const spec: ScheduleSpec = Object.freeze({
    kind: obj.kind as ScheduleKind,
    referenceId: obj.referenceId,
    frequency: freq,
    timezone: obj.timezone,
    ...(runAt ? { runAt } : {}),
    ...(localTime ? { localTime } : {}),
    ...(freq === "weekly" ? { dayOfWeek: obj.dayOfWeek as number } : {}),
    quietStart, quietEnd, optedIn: true as const,
  });
  const next = nextOccurrence(spec, nowMs);
  if (!next || Date.parse(next) < nowMs + MINUTE ||
      Date.parse(next) > nowMs + 366 * DAY) {
    throw new ScheduleError("schedule.time_out_of_bounds");
  }
  if (once && isQuiet(timezoneParts(Date.parse(next), spec.timezone).localTime,
    quietStart, quietEnd)) {
    throw new ScheduleError("schedule.time_during_quiet_hours");
  }
  return spec;
}
export function scheduleFingerprint(spec: ScheduleSpec): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}
export function publicNotification(kind: ScheduleKind): {title: string; body: string} {
  return kind === "talk_reminder"
    ? {title:"Talk reminder",body:"Your scheduled Masanawa Talk reminder is ready."}
    : kind === "lesson_followup"
      ? {title:"Lesson reminder",body:"You have a scheduled lesson follow-up in Masanawa."}
      : {title:"Artifact update",body:"Check Masanawa for your requested artifact update."};
}

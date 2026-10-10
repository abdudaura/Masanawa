/** Masanawa L-MISSIONS J12. No fan content publishing and no autonomous financial authority. */
export type MissionState = "draft" | "active" | "paused" | "archived";
export type ContentKind = "text" | "image" | "audio";
export type SlotState = "draft" | "approved" | "publishing" | "published" | "failed" | "cancelled";
export type AutonomyLevel = 0 | 1 | 2;
export interface StaffActor {
  tenantId: string;
  userId: string;
  roles: readonly string[];
}
export interface WeeklyMission {
  missionId: string;
  tenantId: string;
  characterId: string;
  weekStart: string;
  objective: string;
  topicFocus: string;
  autonomyLevel: AutonomyLevel;
  budgetMinor: string;
  spentMinor: string;
  state: MissionState;
  revision: number;
}
export interface PostingSlot {
  slotId: string;
  missionId: string;
  characterId: string;
  kind: ContentKind;
  scheduledAt: string;
  timeZone: string;
  topic: string;
  draftBody: string;
  estimatedCostMinor: string;
  state: SlotState;
  revision: number;
  publicationKey: string;
  postId: string | null;
  lastError: string | null;
}
export interface MissionInput {
  characterId: string;
  weekStart: string;
  objective: string;
  topicFocus: string;
  autonomyLevel: AutonomyLevel;
  budgetMinor: string;
}
export interface SlotInput {
  kind: ContentKind;
  scheduledAt: string;
  timeZone: string;
  topic: string;
  draftBody: string;
  estimatedCostMinor: string;
}
export class MissionError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
const unsafe = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
export function nonEmpty(input: unknown, min = 1, max = 600): string {
  if (typeof input !== "string") throw new MissionError(422, "invalid_text");
  const value = input.trim();
  if (value.length < min || value.length > max || unsafe.test(value)) throw new MissionError(422, "invalid_text");
  return value;
}
export function minorUnits(input: unknown): string {
  if (typeof input !== "string" || !/^(0|[1-9][0-9]{0,14})$/u.test(input)) throw new MissionError(422, "invalid_budget");
  return input; // exact integer string; no JS float and no payment ledger
}
export function checkedRevision(input: unknown): number {
  if (!Number.isSafeInteger(input) || Number(input) < 1) throw new MissionError(422, "revision_required");
  return Number(input);
}
export function requireEditor(actor: StaffActor): void {
  if (!actor.tenantId || !actor.userId || !actor.roles.some(r => r === "content_editor" || r === "ops_admin" || r === "super_admin"))
    throw new MissionError(403, "staff_role_required");
}
export function requireOps(actor: StaffActor): void {
  if (!actor.roles.some(r => r === "ops_admin" || r === "super_admin"))
    throw new MissionError(403, "ops_role_required");
}
export function validateMission(value: Record<string, unknown>): MissionInput {
  const characterId = nonEmpty(value.characterId, 3, 128);
  const weekStart = nonEmpty(value.weekStart, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(weekStart) || !Number.isFinite(Date.parse(weekStart + "T00:00:00Z")) ||
    new Date(weekStart + "T00:00:00Z").toISOString().slice(0, 10) !== weekStart ||
    new Date(weekStart + "T00:00:00Z").getUTCDay() !== 1) throw new MissionError(422, "monday_week_required");
  const autonomyLevel = value.autonomyLevel;
  if (autonomyLevel !== 0 && autonomyLevel !== 1 && autonomyLevel !== 2) throw new MissionError(422, "invalid_autonomy");
  return { characterId, weekStart, objective: nonEmpty(value.objective, 8, 600),
    topicFocus: nonEmpty(value.topicFocus, 2, 140), autonomyLevel,
    budgetMinor: minorUnits(value.budgetMinor) };
}
export function validateSlot(value: Record<string, unknown>): SlotInput {
  const scheduledAt = nonEmpty(value.scheduledAt, 20, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(scheduledAt)
    || Number.isNaN(Date.parse(scheduledAt))) throw new MissionError(422, "utc_schedule_required");
  const timeZone = nonEmpty(value.timeZone, 3, 64);
  try { new Intl.DateTimeFormat("en", { timeZone }); }
  catch { throw new MissionError(422, "invalid_timezone"); }
  if (value.kind !== "text" && value.kind !== "image" && value.kind !== "audio")
    throw new MissionError(422, "invalid_post_kind");
  return { kind: value.kind, scheduledAt, timeZone,
    topic: nonEmpty(value.topic, 2, 140),
    draftBody: nonEmpty(value.draftBody, 1, 6000),
    estimatedCostMinor: minorUnits(value.estimatedCostMinor) };
}
export function mayAutoPublish(input: {
  level: AutonomyLevel; kind: ContentKind; qualityScore: number;
  consecutiveApproved: number; publishedToday: number; paused: boolean; globalEnabled: boolean;
}): boolean {
  return input.globalEnabled && !input.paused && input.level === 2 && input.kind === "text" &&
    Number.isFinite(input.qualityScore) && input.qualityScore >= 0.85 &&
    Number.isSafeInteger(input.consecutiveApproved) && input.consecutiveApproved >= 20 &&
    Number.isSafeInteger(input.publishedToday) && input.publishedToday >= 0 && input.publishedToday < 2;
}

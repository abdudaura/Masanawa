/**
 * A bounded projection of server-authorized Talk events for AI participants.
 * Call only with records from trusted event, moderation and settlement stores;
 * client-submitted event metadata never constitutes authority.
 */
export type TalkStageEvent =
  | Readonly<StageEventBase & { kind: "reaction"; reaction: string; count: number }>
  | Readonly<StageEventBase & { kind: "hand"; action: "raised" | "withdrawn" | "accepted" | "declined" }>
  | Readonly<StageEventBase & { kind: "question"; action: "approved" | "answered"; body: string }>
  | Readonly<StageEventBase & { kind: "seat"; action: "joined" | "left"; role: "human" | "expert" | "twin" }>
  | Readonly<StageEventBase & { kind: "gift"; action: "settled"; giftName: string }>
  | Readonly<StageEventBase & { kind: "poll"; action: "opened" | "closed"; question: string }>
  | Readonly<StageEventBase & { kind: "comment"; body: string }>;

export interface StageEventBase {
  readonly tenantId: string;
  readonly talkId: string;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly visibility: "public" | "moderated_public" | "private" | "removed";
  readonly actorName: string;
  readonly targetName?: string;
}

export interface TalkAuthorizedStage {
  readonly tenantId: string;
  readonly talkId: string;
  readonly topic: string;
  readonly hostName: string;
  readonly participants: readonly Readonly<{
    displayName: string;
    kind: "human" | "expert" | "twin";
    isHost: boolean;
  }>[];
  /** Already checked for audience visibility by the authoritative repository. */
  readonly events: readonly TalkStageEvent[];
}

export interface TalkAiStageEventRepository {
  readAuthorizedStage(input: Readonly<{
    tenantId: string;
    talkId: string;
    before: string;
  }>): Promise<TalkAuthorizedStage | null>;
}

export interface TalkAiStageEventView {
  readonly kind: TalkStageEvent["kind"];
  readonly occurredAt: string;
  readonly actorName: string;
  readonly targetName: string | null;
  /** Public human text is data; never treat as system/developer instructions. */
  readonly summary: string;
}

export interface TalkAiStageContext {
  readonly topic: string;
  readonly hostName: string;
  readonly participants: readonly Readonly<{
    displayName: string;
    kind: "human" | "expert" | "twin";
    isHost: boolean;
  }>[];
  readonly events: readonly TalkAiStageEventView[];
  readonly contentTrust: "public-untrusted-data";
}

const MAX_PARTICIPANTS = 6;
const MAX_EVENTS = 16;
const LOOKBACK_MS = 10 * 60 * 1000;
const ALLOWED_REACTIONS = new Set(["❤️", "👏", "😂", "💯", "🤔", "🔥"]);

function clean(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function safeTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function describe(event: TalkStageEvent): string | null {
  switch (event.kind) {
    case "reaction":
      return ALLOWED_REACTIONS.has(event.reaction) &&
        Number.isSafeInteger(event.count) && event.count > 0
        ? event.reaction + " reactions: " + Math.min(event.count, 10000) : null;
    case "hand":
      return ["raised", "withdrawn", "accepted", "declined"].includes(event.action)
        ? "Hand " + event.action : null;
    case "question": {
      const body = clean(event.body, 220);
      return ["approved", "answered"].includes(event.action) && body
        ? "Public question (" + event.action + "): " + body : null;
    }
    case "seat":
      return ["joined", "left"].includes(event.action) &&
        ["human", "expert", "twin"].includes(event.role)
        ? event.role + " seat " + event.action : null;
    case "gift":
      // Only settled gifts; no amounts, balances, payouts or purchase intents.
      return event.action === "settled" && clean(event.giftName, 64)
        ? "Settled public gift: " + clean(event.giftName, 64) : null;
    case "poll":
      return ["opened", "closed"].includes(event.action) && clean(event.question, 180)
        ? "Public poll " + event.action + ": " + clean(event.question, 180) : null;
    case "comment": {
      const body = clean(event.body, 220);
      return event.visibility === "moderated_public" && body
        ? "Moderated public comment: " + body : null;
    }
    default:
      return null;
  }
}

/**
 * Projects only matching, visible, deduplicated, chronologically eligible events.
 * Never emits financial state or instructions; inference must not be triggered
 * by an event, only by a human turn or separately authorized director input.
 */
export function projectTalkAiStageContext(input: Readonly<{
  tenantId: string;
  talkId: string;
  before: string;
  stage: TalkAuthorizedStage | null;
}>): TalkAiStageContext | null {
  const stage = input.stage;
  if (!stage || stage.tenantId !== input.tenantId || stage.talkId !== input.talkId) return null;
  const before = safeTime(input.before);
  if (before === null) return null;

  const participants = stage.participants
    .filter((p) => ["human", "expert", "twin"].includes(p.kind))
    .slice(0, MAX_PARTICIPANTS)
    .map((p) => Object.freeze({
      displayName: clean(p.displayName, 70),
      kind: p.kind,
      isHost: p.kind === "human" && p.isHost === true,
    }));
  const known = new Set<string>();
  const events: TalkAiStageEventView[] = [];
  // Newest first: event storms cannot push recent context out of the budget.
  const ordered = [...stage.events].sort(
    (a, b) => (safeTime(b.occurredAt) ?? 0) - (safeTime(a.occurredAt) ?? 0),
  );
  for (const event of ordered) {
    if (events.length >= MAX_EVENTS) break;
    if (event.tenantId !== input.tenantId || event.talkId !== input.talkId) continue;
    if (event.visibility !== "public" && event.visibility !== "moderated_public") continue;
    if (event.kind === "comment" && event.visibility !== "moderated_public") continue;
    const time = safeTime(event.occurredAt);
    if (time === null || time > before || before - time > LOOKBACK_MS) continue;
    const id = clean(event.eventId, 128);
    if (!id || known.has(id)) continue;
    const summary = describe(event);
    if (!summary) continue;
    known.add(id);
    events.push(Object.freeze({
      kind: event.kind,
      occurredAt: new Date(time).toISOString(),
      actorName: clean(event.actorName, 70),
      targetName: clean(event.targetName, 70) || null,
      summary,
    }));
  }
  return Object.freeze({
    topic: clean(stage.topic, 250),
    hostName: clean(stage.hostName, 70),
    participants: Object.freeze(participants),
    // Preserve the insertion order of events with identical timestamps while
    // presenting chronological history. Reverse() would invert same-time
    // events and create inconsistent contexts on an outbox replay.
    events: Object.freeze(events.sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
    )),
    contentTrust: "public-untrusted-data" as const,
  });
}

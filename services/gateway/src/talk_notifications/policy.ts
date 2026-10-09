export type TalkNotificationEventKind =
  | "talk_invitation"
  | "raise_hand_accepted"
  | "raise_hand_declined"
  | "ai_seat_sponsored"
  | "ai_seat_accepted"
  | "ai_seat_declined"
  | "followed_host_live"
  | "replay_ready"
  | "gift_received"
  | "earning_available"
  | "platform_notice";

export interface TalkNotificationEvent {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly tenantId: string;
  readonly recipientUserId: string;
  readonly kind: TalkNotificationEventKind;
  readonly talkId: string | null;
  readonly actorDisplayName: string | null;
  readonly createdAt: string;
}

export interface TalkPushIntent {
  readonly dedupeKey: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
  readonly priority: "normal" | "high";
}

function text(value: string, name: string, max = 256): string {
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function optionalText(value: string | null, name: string, max = 160): string | null {
  return value === null ? null : text(value, name, max);
}

function timestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError("createdAt is invalid");
  return new Date(parsed).toISOString();
}

function kind(value: TalkNotificationEventKind): TalkNotificationEventKind {
  if (![
    "talk_invitation",
    "raise_hand_accepted",
    "raise_hand_declined",
    "ai_seat_sponsored",
    "ai_seat_accepted",
    "ai_seat_declined",
    "followed_host_live",
    "replay_ready",
    "gift_received",
    "earning_available",
    "platform_notice",
  ].includes(value)) {
    throw new TypeError("notification kind is invalid");
  }
  return value;
}

export function normalizeTalkNotificationEvent(
  input: TalkNotificationEvent,
): TalkNotificationEvent {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported notification schema");
  return Object.freeze({
    schemaVersion: 1,
    eventId: text(input.eventId, "eventId"),
    tenantId: text(input.tenantId, "tenantId"),
    recipientUserId: text(input.recipientUserId, "recipientUserId"),
    kind: kind(input.kind),
    talkId: optionalText(input.talkId, "talkId"),
    // Human-controlled profile names are intentionally absent from push payloads.
    // They belong only in authenticated Activity, never an OS lock-screen preview.
    actorDisplayName: null,
    createdAt: timestamp(input.createdAt),
  });
}

export function talkPushDedupeKey(event: TalkNotificationEvent): string {
  const normalized = normalizeTalkNotificationEvent(event);
  return `talk-push:v1:${encodeURIComponent(normalized.tenantId)}:${encodeURIComponent(normalized.recipientUserId)}:${encodeURIComponent(normalized.eventId)}`;
}

function talkData(event: TalkNotificationEvent): Readonly<Record<string, string>> {
  const data: Record<string, string> = {
    kind: event.kind,
    eventId: event.eventId,
  };
  if (event.talkId !== null) data.talkId = event.talkId;
  return Object.freeze(data);
}

export function createTalkPushIntent(
  input: TalkNotificationEvent,
): TalkPushIntent {
  const event = normalizeTalkNotificationEvent(input);
  let title: string;
  let body: string;
  let priority: "normal" | "high" = "normal";

  switch (event.kind) {
    case "talk_invitation":
      title = "Talk invitation";
      body = "You have a Talk invitation.";
      priority = "high";
      break;
    case "raise_hand_accepted":
      title = "You're invited to speak";
      body = "The Host accepted your request to speak.";
      priority = "high";
      break;
    case "raise_hand_declined":
      title = "Speaker request update";
      body = "The Host couldn't add you as a speaker this time.";
      break;
    case "ai_seat_sponsored":
      title = "AI Seat sponsored";
      body = "A sponsored AI Seat is waiting for your decision.";
      priority = "high";
      break;
    case "ai_seat_accepted":
      title = "AI Seat accepted";
      body = "The Host accepted your sponsored AI Seat.";
      priority = "high";
      break;
    case "ai_seat_declined":
      title = "AI Seat not admitted";
      body = "Your AI Seat invitation has an update.";
      break;
    case "followed_host_live":
      title = "A Host you follow is live";
      body = "A new Talk has started.";
      priority = "high";
      break;
    case "replay_ready":
      title = "Replay ready";
      body = "A Talk replay is now available.";
      break;
    case "gift_received":
      title = "You received a gift";
      body = "You received a gift in a Talk.";
      break;
    case "earning_available":
      title = "New earnings";
      body = "Your Talk earnings have an update.";
      break;
    case "platform_notice":
      title = "Masanawa";
      body = "There's an important update about your Talk activity.";
      priority = "high";
      break;
  }

  return Object.freeze({
    dedupeKey: talkPushDedupeKey(event),
    title,
    body,
    data: talkData(event),
    priority,
  });
}

export function shouldSendTalkPush(input: Readonly<{
  event: TalkNotificationEvent;
  pushEnabled: boolean;
  quietHours: boolean;
}>): boolean {
  const event = normalizeTalkNotificationEvent(input.event);
  if (!input.pushEnabled) return false;
  if (!input.quietHours) return true;

  return [
    "talk_invitation",
    "raise_hand_accepted",
    "ai_seat_sponsored",
    "ai_seat_accepted",
    "followed_host_live",
    "platform_notice",
  ].includes(event.kind);
}


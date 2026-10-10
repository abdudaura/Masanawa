/**
 * C08 projection handler for the EXISTING events.outbox worker.
 * AF00 injects the canonical claimed outbox event and settles the claim only
 * after this durable insert; never invoke from an untrusted HTTP route.
 * It does not send push or invent a second delivery queue.
 */
export type NotificationKind =
  | "comment_reply" | "room_answer" | "followed_post"
  | "subscription" | "wallet" | "case_update";
export type NotificationTarget =
  | "post" | "comment" | "room" | "subscription" | "wallet" | "case";

export interface VerifiedInboxEvent {
  tenantId: string; eventId: string; recipientFanId: string;
  kind: NotificationKind; targetKind: NotificationTarget; targetId: string;
}
export interface InboxProjectionStore {
  deliver(input: {
    tenantId: string; fanUserId: string; eventId: string;
    kind: NotificationKind; targetKind: NotificationTarget; targetId: string;
    title: string; body: string;
  }): Promise<void>;
}
const kinds: Record<NotificationKind, { target: NotificationTarget; title: string; body: string }> = {
  comment_reply: { target: "comment", title: "New reply", body: "Someone replied to your comment." },
  room_answer: { target: "room", title: "Your Room question", body: "A Masana answered your question." },
  followed_post: { target: "post", title: "New from a Masana", body: "A Masana you follow has shared a post." },
  subscription: { target: "subscription", title: "Subscription update", body: "Your Room subscription has an update." },
  wallet: { target: "wallet", title: "Wallet update", body: "Your Wallet has a new status update. Check the details in Wallet." },
  case_update: { target: "case", title: "Case update", body: "Your Gwani support case has an update." },
};
const safe = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_:\-.]{1,128}$/.test(v);

/** Never echo fan data, counterpart names, private financial amounts or event text into notification previews. */
export async function projectInboxEvent(
  event: VerifiedInboxEvent,
  store: InboxProjectionStore,
): Promise<void> {
  if (!safe(event.tenantId) || !safe(event.eventId) ||
    !safe(event.recipientFanId) || !safe(event.targetId) ||
    !Object.prototype.hasOwnProperty.call(kinds, event.kind)) {
    throw new TypeError("Invalid trusted inbox event");
  }
  const spec = kinds[event.kind];
  if (spec.target !== event.targetKind) throw new TypeError("Mismatched notification target");
  await store.deliver({
    tenantId: event.tenantId, fanUserId: event.recipientFanId, eventId: event.eventId,
    kind: event.kind, targetKind: event.targetKind, targetId: event.targetId,
    title: spec.title, body: spec.body,
  });
}

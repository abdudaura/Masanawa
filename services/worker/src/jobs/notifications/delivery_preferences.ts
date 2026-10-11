import type { NotificationKind } from "./inbox_projection.js";
// Reuse C08's canonical six kinds. This gate never touches its durable inbox.
type DeliveryKind = NotificationKind;
interface DeliveryActor {tenantId:string;fanUserId:string}
const allowedKinds: readonly string[] = [
  "comment_reply","room_answer","followed_post","subscription","wallet","case_update",
];
const isDeliveryKind = (kind: unknown): kind is DeliveryKind =>
  typeof kind === "string" && allowedKinds.includes(kind);

/**
 * Eligibility check ONLY for an OPTIONAL external push sender. The existing
 * events.outbox -> notifications.fan_inbox handler always persists the event,
 * including wallet/case/subscription items, independently of this preference.
 * No new queue, sender, token storage or provider writes are introduced.
 */
export async function maySendOptionalPush(
  event: DeliveryActor & {kind: DeliveryKind},
  port: { pushEnabled(actor: DeliveryActor, kind: DeliveryKind): Promise<boolean> },
): Promise<boolean> {
  if (!event.tenantId || !event.fanUserId || !isDeliveryKind(event.kind)) return false;
  try { return (await port.pushEnabled(event, event.kind)) === true; }
  catch { return false; } // database outage or missing consent must fail closed
}

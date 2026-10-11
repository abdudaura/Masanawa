import type { DeliveryActor, DeliveryKind } from "../../../../../adapters/storage/postgres/src/notifications/delivery_preferences.js";
import {isDeliveryKind} from "../../../../../adapters/storage/postgres/src/notifications/delivery_preferences.js";

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

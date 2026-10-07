import type { MobilePushSender } from "../mobile_push.js";
import {
  createTalkPushIntent,
  shouldSendTalkPush,
  type TalkNotificationEvent,
} from "./policy.js";

export interface TalkPushDedupeRepository {
  claim(input: Readonly<{
    tenantId: string;
    userId: string;
    dedupeKey: string;
    createdAt: string;
  }>): Promise<boolean>;
}

export interface TalkPushDeliveryResult {
  readonly disposition: "sent" | "skipped" | "duplicate";
  readonly attempted: number;
  readonly delivered: number;
}

export function createTalkPushDelivery(input: Readonly<{
  sender: MobilePushSender;
  dedupe: TalkPushDedupeRepository;
}>): Readonly<{
  deliver(request: Readonly<{
    event: TalkNotificationEvent;
    pushEnabled: boolean;
    quietHours: boolean;
  }>): Promise<TalkPushDeliveryResult>;
}> {
  return Object.freeze({
    async deliver(request) {
      if (!shouldSendTalkPush(request)) {
        return Object.freeze({
          disposition: "skipped" as const,
          attempted: 0,
          delivered: 0,
        });
      }

      const intent = createTalkPushIntent(request.event);
      const claimed = await input.dedupe.claim({
        tenantId: request.event.tenantId,
        userId: request.event.recipientUserId,
        dedupeKey: intent.dedupeKey,
        createdAt: request.event.createdAt,
      });
      if (!claimed) {
        return Object.freeze({
          disposition: "duplicate" as const,
          attempted: 0,
          delivered: 0,
        });
      }

      const result = await input.sender.send({
        scope: {
          tenantId: request.event.tenantId as never,
          userId: request.event.recipientUserId as never,
        },
        title: intent.title,
        body: intent.body,
        data: intent.data,
      });

      return Object.freeze({
        disposition: "sent" as const,
        attempted: result.attempted,
        delivered: result.delivered,
      });
    },
  });
}

import type { MobilePushSender } from "../mobile_push.js";
import {
  createTalkPushDelivery,
  type TalkPushDedupeRepository,
} from "./delivery.js";

export function createTalkPushDeliveryRuntime(input: Readonly<{
  sender?: MobilePushSender;
  dedupe?: TalkPushDedupeRepository;
}>): ReturnType<typeof createTalkPushDelivery> | undefined {
  if (!input.sender || !input.dedupe) return undefined;
  return createTalkPushDelivery({
    sender: input.sender,
    dedupe: input.dedupe,
  });
}

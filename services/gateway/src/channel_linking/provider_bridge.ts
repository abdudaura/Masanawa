import type { CustomerChannelRepository } from "@masanawa/security";
import type {
  CustomerChannelBridge, CustomerChannelInbound, CustomerChannelResult,
} from "../customer_channel_bridge.js";
import { LinkError, type LinkingService } from "./service.js";
import type { PersistentLinkRepository } from "./postgres_repository.js";

const linkedReply = "Your assistant channel is connected. Return to Masanawa Settings to check the status.";
const invalidReply = "This link code is not valid or has expired. Create a fresh code in Masanawa Settings.";
const notLinkedReply = "For your privacy, link this channel from Masanawa Settings before using your assistant.";

export interface LinkingAwareBridgeOptions {
  /** Existing C07 customer bridge is used only AFTER consent is proved. */
  readonly assistant: CustomerChannelBridge;
  readonly channels: CustomerChannelRepository;
  readonly linking: LinkingService;
  readonly repository: PersistentLinkRepository;
}

function completed(reply: string, duplicate: boolean): CustomerChannelResult {
  return Object.freeze({
    handled: true, duplicate, reply, requestContact: false,
    shouldDeliver: !duplicate,
  });
}

export function createLinkingAwareChannelBridge(
  options: LinkingAwareBridgeOptions,
): CustomerChannelBridge {
  /** Persists a security response using existing inbound dedupe/outbox state. */
  async function respond(
    incoming: CustomerChannelInbound,
    handler: () => Promise<string>,
  ): Promise<CustomerChannelResult> {
    const claim = await options.channels.claimMessage({
      channel: incoming.channel, messageId: incoming.messageId,
      externalUserId: incoming.externalUserId,
      receivedAt: new Date().toISOString(),
    });
    if (claim.state !== "claimed") {
      return Object.freeze({
        handled: true, duplicate: true, reply: claim.reply,
        requestContact: false, shouldDeliver: claim.state === "completed" && claim.reply !== null,
      });
    }
    try {
      const reply = await handler();
      await options.channels.completeMessage({
        channel: incoming.channel, messageId: incoming.messageId,
        reply, completedAt: new Date().toISOString(),
      });
      return completed(reply, false);
    } catch (error) {
      await options.channels.failMessage({
        channel: incoming.channel, messageId: incoming.messageId,
        failedAt: new Date().toISOString(),
      }).catch(() => undefined);
      throw error;
    }
  }

  return Object.freeze<CustomerChannelBridge>({
    async handle(incoming) {
      // This wrapper must sit behind signed WhatsApp / secret-authenticated
      // Telegram webhook routes, never as a publicly callable verification API.
      if (incoming.channel === "telegram" &&
          incoming.chatId !== incoming.externalUserId) {
        return Object.freeze({
          handled: true, duplicate: false, reply: null,
          shouldDeliver: false, requestContact: false,
        });
      }
      if (/^MN-/iu.test(incoming.text.trim())) {
        return respond(incoming, async () => {
          if (incoming.media) return invalidReply;
          try {
            const linked = await options.linking.consumeVerifiedInbound({
              channel: incoming.channel, externalUserId: incoming.externalUserId,
              chatId: incoming.chatId, messageId: incoming.messageId,
              text: incoming.text,
            });
            return linked ? linkedReply : invalidReply;
          } catch (error) {
            if (error instanceof LinkError &&
                (error.code === "LINK_CONFLICT" || error.code === "LINK_NOT_FOUND" ||
                 error.code === "LINK_EXPIRED")) return invalidReply;
            throw error;
          }
        });
      }
      // Mandatory guard against legacy phone-number automatic link provisioning.
      // A canonical link alone is not evidence that the mobile user consented.
      const link = await options.channels.readLink({
        channel: incoming.channel, externalUserId: incoming.externalUserId,
      });
      const verified = link && await options.repository.isVerifiedSender(
        { tenantId: link.tenantId, userId: link.userId },
        incoming.channel, incoming.externalUserId, incoming.chatId,
      );
      if (!verified) {
        return respond(incoming, async () => notLinkedReply);
      }
      return options.assistant.handle(incoming);
    },
    async delivered(input) {
      await options.channels.markDelivered({
        channel: input.channel, messageId: input.messageId,
        deliveredAt: new Date().toISOString(),
      });
    },
  });
}


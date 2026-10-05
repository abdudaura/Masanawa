import {
  parseCanonicalId,
  toInstant,
  type ChannelAccountId,
  type Instant,
} from "@masanawa/contracts";
import {
  normalizeChannelOutboundRequest,
  type ChannelOutboundMediaResolver,
  type ChannelOutboundRequest,
  type ChannelProviderSender,
  type ChannelProviderSendResult,
} from "./outbound.js";

export interface WhatsAppCloudApiEdge {
  /**
   * Authenticated Cloud API edge tied to Security-owned access-token custody.
   * Explicit HTTP/API rejection is returned; network/ambiguous failures throw.
   */
  call(input: {
    readonly phoneNumberId: string;
    readonly body: Readonly<Record<string, unknown>>;
  }): Promise<
    | Readonly<{ status: "accepted"; body: unknown }>
    | Readonly<{ status: "rejected"; safeCode: string }>
  >;
}

export interface WhatsAppOutboundSenderConfig {
  readonly accountId: ChannelAccountId;
  readonly phoneNumberId: string;
  readonly edge: WhatsAppCloudApiEdge;
  readonly media?: ChannelOutboundMediaResolver;
  readonly now: () => Instant;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function recipient(value: string): string {
  const normalized = bounded(value, "conversation.value", 32);
  if (!/^[1-9][0-9]{5,31}$/u.test(normalized)) {
    throw new TypeError("WhatsApp recipient is invalid");
  }
  return normalized;
}

function context(
  replyToMessageId: string | null,
): Readonly<Record<string, string>> | undefined {
  if (replyToMessageId === null) return undefined;
  return Object.freeze({
    message_id: bounded(replyToMessageId, "replyToMessageId", 512),
  });
}

function parseAccepted(
  value: unknown,
  now: () => Instant,
): ChannelProviderSendResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("WhatsApp accepted response is invalid");
  }
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length < 1) {
    throw new TypeError("WhatsApp accepted response messages are invalid");
  }
  const first = body.messages[0];
  if (first === null || typeof first !== "object" || Array.isArray(first)) {
    throw new TypeError("WhatsApp accepted response message is invalid");
  }
  const id = (first as Record<string, unknown>).id;
  if (typeof id !== "string") {
    throw new TypeError("WhatsApp accepted response message id is invalid");
  }
  return Object.freeze({
    status: "accepted" as const,
    providerMessageId: bounded(id, "providerMessageId", 512),
    acceptedAt: toInstant(now()),
  });
}

function optionBody(
  prompt: string,
  options: readonly Readonly<{ label: string; selectionId: string }>[],
): Readonly<Record<string, unknown>> | null {
  if (prompt.length > 1024) return null;

  if (
    options.length <= 3 &&
    options.every((option) => option.label.length <= 20)
  ) {
    return Object.freeze({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: prompt },
        action: {
          buttons: options.map((option) => ({
            type: "reply",
            reply: {
              id: option.selectionId,
              title: option.label,
            },
          })),
        },
      },
    });
  }

  if (
    options.length <= 10 &&
    options.every((option) => option.label.length <= 24)
  ) {
    return Object.freeze({
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: prompt },
        action: {
          button: "Choose",
          sections: [
            {
              title: "Options",
              rows: options.map((option) => ({
                id: option.selectionId,
                title: option.label,
              })),
            },
          ],
        },
      },
    });
  }

  return null;
}

export function createWhatsAppOutboundSender(
  input: WhatsAppOutboundSenderConfig,
): ChannelProviderSender {
  const accountId = parseCanonicalId("channel-account", input.accountId);
  const phoneNumberId = bounded(
    input.phoneNumberId,
    "phoneNumberId",
    128,
  );

  return Object.freeze({
    async send(requestInput: ChannelOutboundRequest): Promise<ChannelProviderSendResult> {
      const request = normalizeChannelOutboundRequest(requestInput);
      if (
        request.channel !== "whatsapp" ||
        request.accountId !== accountId ||
        request.conversation.system !== "whatsapp" ||
        request.conversation.namespace !== phoneNumberId ||
        request.conversation.conversationKind !== "direct"
      ) {
        throw new TypeError(
          "WhatsApp outbound request does not match configured account scope",
        );
      }
      const to = recipient(request.conversation.value);
      const replyContext = context(request.replyToMessageId);
      let message: Readonly<Record<string, unknown>>;

      if (request.content.kind === "text") {
        if (request.content.text.length > 4096) {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "whatsapp_text_too_long",
          });
        }
        message = Object.freeze({
          type: "text",
          text: { body: request.content.text },
        });
      } else if (request.content.kind === "options") {
        const interactive = optionBody(
          request.content.prompt,
          request.content.options,
        );
        if (interactive === null) {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "whatsapp_options_unsupported",
          });
        }
        message = interactive;
      } else {
        if (request.content.caption !== null) {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "whatsapp_audio_caption_unsupported",
          });
        }
        if (!input.media) {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "whatsapp_media_unavailable",
          });
        }
        let providerFileId: string;
        try {
          const media = await input.media.resolve({
            channel: "whatsapp",
            accountId,
            fileRef: request.content.fileRef,
            mimeType: request.content.mimeType,
          });
          providerFileId = bounded(
            media.providerFileId,
            "providerFileId",
            512,
          );
        } catch {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "whatsapp_media_unavailable",
          });
        }
        message = Object.freeze({
          type: "audio",
          audio: { id: providerFileId },
        });
      }

      const body = Object.freeze({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...message,
        ...(replyContext ? { context: replyContext } : {}),
      });

      const response = await input.edge.call({
        phoneNumberId,
        body,
      });
      if (response.status === "rejected") {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: bounded(response.safeCode, "safeCode", 128),
        });
      }
      return parseAccepted(response.body, input.now);
    },
  });
}

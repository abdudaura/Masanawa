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

export interface TelegramBotApiEdge {
  /**
   * Authenticated Bot API edge. The bot token stays inside the implementation.
   * Explicit HTTP/API rejection is returned; network/ambiguous failures throw.
   */
  call(input: {
    readonly method: "sendMessage" | "sendVoice" | "sendAudio";
    readonly body: Readonly<Record<string, unknown>>;
  }): Promise<
    | Readonly<{ status: "accepted"; body: unknown }>
    | Readonly<{ status: "rejected"; safeCode: string }>
  >;
}

export interface TelegramOutboundSenderConfig {
  readonly accountId: ChannelAccountId;
  readonly botId: string;
  readonly edge: TelegramBotApiEdge;
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

function telegramInteger(value: string, name: string): number {
  if (!/^-?[1-9][0-9]{0,18}$/u.test(value)) {
    throw new TypeError(`${name} is invalid`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`${name} is outside the supported safe integer range`);
  }
  return parsed;
}

function replyParameters(
  replyToMessageId: string | null,
): Readonly<Record<string, unknown>> | undefined {
  if (replyToMessageId === null) return undefined;
  return Object.freeze({
    message_id: telegramInteger(replyToMessageId, "replyToMessageId"),
  });
}

function parseAccepted(
  value: unknown,
  now: () => Instant,
): ChannelProviderSendResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Telegram accepted response is invalid");
  }
  const body = value as Record<string, unknown>;
  if (body.ok !== true) {
    throw new TypeError("Telegram accepted response is not successful");
  }
  const result = body.result;
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Telegram accepted response result is invalid");
  }
  const message = result as Record<string, unknown>;
  if (
    typeof message.message_id !== "number" ||
    !Number.isSafeInteger(message.message_id)
  ) {
    throw new TypeError("Telegram accepted response message_id is invalid");
  }
  let acceptedAt = toInstant(now());
  if (
    typeof message.date === "number" &&
    Number.isSafeInteger(message.date) &&
    message.date > 0
  ) {
    acceptedAt = toInstant(new Date(message.date * 1000));
  }
  return Object.freeze({
    status: "accepted" as const,
    providerMessageId: String(message.message_id),
    acceptedAt,
  });
}

export function createTelegramOutboundSender(
  input: TelegramOutboundSenderConfig,
): ChannelProviderSender {
  const accountId = parseCanonicalId("channel-account", input.accountId);
  const botId = bounded(input.botId, "botId", 32);
  telegramInteger(botId, "botId");

  return Object.freeze({
    async send(requestInput: ChannelOutboundRequest): Promise<ChannelProviderSendResult> {
      const request = normalizeChannelOutboundRequest(requestInput);
      if (
        request.channel !== "telegram" ||
        request.accountId !== accountId ||
        request.conversation.system !== "telegram" ||
        request.conversation.namespace !== botId ||
        request.conversation.conversationKind !== "direct"
      ) {
        throw new TypeError(
          "Telegram outbound request does not match configured account scope",
        );
      }
      const chatId = telegramInteger(
        request.conversation.value,
        "conversation.value",
      );
      const reply = replyParameters(request.replyToMessageId);

      let method: "sendMessage" | "sendVoice" | "sendAudio";
      let body: Record<string, unknown>;

      if (request.content.kind === "text") {
        method = "sendMessage";
        body = {
          chat_id: chatId,
          text: request.content.text,
          ...(reply ? { reply_parameters: reply } : {}),
        };
      } else if (request.content.kind === "options") {
        method = "sendMessage";
        body = {
          chat_id: chatId,
          text: request.content.prompt,
          reply_markup: {
            inline_keyboard: request.content.options.map((option) => [
              {
                text: option.label,
                callback_data: option.selectionId,
              },
            ]),
          },
          ...(reply ? { reply_parameters: reply } : {}),
        };
      } else {
        if (!input.media) {
          return Object.freeze({
            status: "rejected" as const,
            safeCode: "telegram_media_unavailable",
          });
        }
        let providerFileId: string;
        try {
          const media = await input.media.resolve({
            channel: "telegram",
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
            safeCode: "telegram_media_unavailable",
          });
        }
        const voiceLike =
          request.content.mimeType === "audio/ogg" ||
          request.content.mimeType === "audio/opus" ||
          request.content.mimeType === "audio/ogg; codecs=opus";
        method = voiceLike ? "sendVoice" : "sendAudio";
        body = {
          chat_id: chatId,
          [voiceLike ? "voice" : "audio"]: providerFileId,
          ...(request.content.caption === null
            ? {}
            : { caption: request.content.caption }),
          ...(reply ? { reply_parameters: reply } : {}),
        };
      }

      const response = await input.edge.call({
        method,
        body: Object.freeze(body),
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

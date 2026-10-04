import { parseCanonicalId, toInstant, type Instant } from "@masanawa/contracts";
import { admit } from "./admission.js";
import type { ChannelIngressConfig, InboundContent, InboundMessage } from "./model.js";
import { fail, integer, list, object, parseBody, record, secretEquals, snapshotBody, string, timestamp } from "./validation.js";

export interface TelegramIngressConfig extends ChannelIngressConfig {
  readonly botId: string;
  /** Dedicated setWebhook secret_token, never the Bot API token. */
  readonly webhookSecret: string;
}

function content(message: Record<string, unknown>): InboundContent {
  if (message.text !== undefined) return { kind: "text", text: string(message.text, 16_384) };
  for (const [key, kind] of [["voice", "audio"], ["audio", "audio"], ["document", "document"], ["video", "video"]] as const) {
    if (message[key] !== undefined) {
      const media = object(message[key]);
      return { kind: "media", mediaKind: kind, fileId: string(media.file_id),
        ...(media.mime_type === undefined ? {} : { mimeType: string(media.mime_type, 128) }),
        ...(message.caption === undefined ? {} : { caption: string(message.caption, 4096) }) };
    }
  }
  if (message.photo !== undefined) {
    const photos = list(message.photo, 16).map(object);
    if (photos.length === 0) fail("invalid_payload");
    // Provider order is not authority; select the largest valid dimensions.
    let best: Record<string, unknown> | undefined;
    let size = -1;
    for (const photo of photos) {
      string(photo.file_id);
      const area = integer(photo.width) * integer(photo.height);
      if (!Number.isSafeInteger(area)) fail("invalid_payload");
      if (area > size) { best = photo; size = area; }
    }
    return { kind: "media", mediaKind: "image", fileId: string(best!.file_id),
      ...(message.caption === undefined ? {} : { caption: string(message.caption, 4096) }) };
  }
  return { kind: "unsupported", providerType: "message" };
}

export function createTelegramIngress(input: TelegramIngressConfig) {
  const config = Object.freeze({ ...input });
  parseCanonicalId("channel-account", config.accountId);
  if (!/^[1-9][0-9]{0,15}$/u.test(config.botId) || !Number.isSafeInteger(Number(config.botId))) fail("invalid_config");
  if (!/^[A-Za-z0-9_-]{1,256}$/u.test(config.webhookSecret)) fail("invalid_config");

  return Object.freeze({
    async receive(body: Uint8Array, secretHeader: unknown, receivedAt: Instant) {
      const raw = snapshotBody(body);
      if (!secretEquals(secretHeader, config.webhookSecret)) fail("verification_failed", "authentication");
      const observedAt = toInstant(receivedAt);
      const update = parseBody(raw);
      const updateId = integer(update.update_id, true).toString();
      const supported = ["message", "edited_message", "callback_query"].filter(key => update[key] !== undefined);
      if (supported.length === 0) return admit(config.admission, [], 1);
      if (supported.length !== 1) fail("invalid_payload");
      const callback = update.callback_query === undefined ? undefined : object(update.callback_query);
      // Inline-mode/game callbacks have no authenticated private conversation.
      if (callback && (callback.message === undefined || callback.data === undefined)) return admit(config.admission, [], 1);
      const message = object(callback ? callback.message : update.message ?? update.edited_message);
      const sender = object(callback ? callback.from : message.from);
      if (sender.is_bot === true) return admit(config.admission, [], 1);
      if (sender.is_bot !== false) fail("invalid_payload");
      const senderId = integer(sender.id).toString();
      const chat = object(message.chat);
      // Groups/channels require a separate explicit policy; no DM memory leakage.
      if (chat.type !== "private") return admit(config.admission, [], 1);
      if (integer(chat.id).toString() !== senderId) fail("subject_mismatch", "authentication");
      if (callback) {
        const author = object(message.from);
        if (author.is_bot !== true || integer(author.id).toString() !== config.botId) fail("account_mismatch", "authentication");
      }
      const id = integer(message.message_id).toString();
      const edited = update.edited_message !== undefined;
      const selectionId = callback ? string(callback.data, 64) : undefined;
      if (selectionId !== undefined && Buffer.byteLength(selectionId, "utf8") > 64) fail("invalid_payload");
      const event: InboundMessage = {
        kind: "message", messageId: id, edited,
        ...(callback ? { callbackQueryId: string(callback.id, 256) } :
          { providerTimestamp: timestamp(edited ? message.edit_date : message.date, true) }),
        subject: { system: "telegram", namespace: config.botId, value: senderId,
          observedAt, accountId: config.accountId, subjectKind: "user",
          authenticationStrength: "transport-verified" },
        conversation: { system: "telegram", namespace: config.botId, value: senderId,
          observedAt, accountId: config.accountId, conversationKind: "direct" },
        ...(message.reply_to_message === undefined ? {} :
          { replyToMessageId: integer(object(message.reply_to_message).message_id).toString() }),
        content: selectionId !== undefined ? { kind: "selection", selectionId } : content(message),
      };
      return admit(config.admission, [record("telegram", config.accountId, `update:${updateId}`, observedAt, event)], 0);
    },
  });
}

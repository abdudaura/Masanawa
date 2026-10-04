import { createHmac } from "node:crypto";
import { parseCanonicalId, toInstant, type Instant } from "@masanawa/contracts";
import { admit } from "./admission.js";
import type { ChannelIngressConfig, ChannelIngressRecord, InboundContent, InboundMessage } from "./model.js";
import { fail, list, object, parseBody, record, secretEquals, snapshotBody, string, timestamp } from "./validation.js";

export interface WhatsAppIngressConfig extends ChannelIngressConfig {
  readonly businessAccountId: string;
  readonly phoneNumberId: string;
  readonly appSecret: string;
  readonly verifyToken: string;
}

function content(message: Record<string, unknown>): InboundContent {
  const type = string(message.type, 64);
  if (type === "text") return { kind: "text", text: string(object(message.text).body, 16_384) };
  if (type === "interactive") {
    const interactive = object(message.interactive);
    const reply = interactive.type === "button_reply" ? interactive.button_reply :
      interactive.type === "list_reply" ? interactive.list_reply : undefined;
    if (reply !== undefined) return { kind: "selection", selectionId: string(object(reply).id, 256) };
    return { kind: "unsupported", providerType: "interactive" };
  }
  if (type === "button") return { kind: "selection", selectionId: string(object(message.button).payload, 256) };
  if (type === "audio" || type === "image" || type === "video" || type === "document") {
    const media = object(message[type]);
    return {
      kind: "media", mediaKind: type, fileId: string(media.id),
      ...(media.mime_type === undefined ? {} : { mimeType: string(media.mime_type, 128) }),
      ...(media.caption === undefined ? {} : { caption: string(media.caption, 4096) }),
    };
  }
  return { kind: "unsupported", providerType: type };
}

export function createWhatsAppIngress(input: WhatsAppIngressConfig) {
  const config = Object.freeze({ ...input });
  parseCanonicalId("channel-account", config.accountId);
  string(config.businessAccountId, 128);
  string(config.phoneNumberId, 128);
  string(config.appSecret, 1024);
  string(config.verifyToken, 1024);

  return Object.freeze({
    verifySubscription(query: Readonly<Record<string, unknown>>): string {
      if (query["hub.mode"] !== "subscribe" || !secretEquals(query["hub.verify_token"], config.verifyToken)) {
        fail("verification_failed", "authentication");
      }
      const challenge = string(query["hub.challenge"], 512);
      if (!/^[0-9]+$/u.test(challenge)) fail("invalid_challenge");
      return challenge;
    },

    async receive(body: Uint8Array, signature: unknown, receivedAt: Instant) {
      const raw = snapshotBody(body);
      const expected = `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`;
      if (typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/u.test(signature) ||
        !secretEquals(signature, expected)) fail("verification_failed", "authentication");
      const observedAt = toInstant(receivedAt);
      const payload = parseBody(raw);
      if (payload.object !== "whatsapp_business_account") fail("invalid_payload");
      const records: ChannelIngressRecord[] = [];
      let ignored = 0;
      for (const entryValue of list(payload.entry, 32)) {
        const entry = object(entryValue);
        if (entry.id !== config.businessAccountId) fail("account_mismatch", "authentication");
        for (const changeValue of list(entry.changes, 32)) {
          const change = object(changeValue);
          if (change.field !== "messages") { ignored++; continue; }
          const value = object(change.value);
          if (value.messaging_product !== "whatsapp" ||
            object(value.metadata).phone_number_id !== config.phoneNumberId) {
            fail("account_mismatch", "authentication");
          }
          for (const item of value.messages === undefined ? [] : list(value.messages)) {
            const message = object(item);
            const sender = string(message.from, 32);
            if (!/^[1-9][0-9]{5,19}$/u.test(sender)) fail("invalid_payload");
            const id = string(message.id);
            const event: InboundMessage = {
              kind: "message", messageId: id, edited: false,
              providerTimestamp: timestamp(message.timestamp),
              subject: { system: "whatsapp", namespace: config.phoneNumberId, value: sender,
                observedAt, accountId: config.accountId, subjectKind: "user",
                authenticationStrength: "transport-verified" },
              conversation: { system: "whatsapp", namespace: config.phoneNumberId, value: sender,
                observedAt, accountId: config.accountId, conversationKind: "direct" },
              ...(message.context === undefined ? {} : { replyToMessageId: string(object(message.context).id) }),
              content: content(message),
            };
            records.push(record("whatsapp", config.accountId, `message:${id}`, observedAt, event));
            if (records.length > 128) fail("event_limit");
          }
          for (const item of value.statuses === undefined ? [] : list(value.statuses)) {
            const status = object(item);
            const state = string(status.status, 64);
            if (state !== "sent" && state !== "delivered" && state !== "read" && state !== "failed") { ignored++; continue; }
            const id = string(status.id);
            const at = timestamp(status.timestamp);
            records.push(record("whatsapp", config.accountId, `delivery:${id}:${state}:${at}`, observedAt, {
              kind: "delivery", messageId: id, recipientId: string(status.recipient_id, 32),
              status: state, providerTimestamp: at,
            }));
            if (records.length > 128) fail("event_limit");
          }
        }
      }
      return admit(config.admission, records, ignored);
    },
  });
}

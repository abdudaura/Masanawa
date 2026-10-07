import { createHmac, timingSafeEqual } from "node:crypto";
import { PassThrough } from "node:stream";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  CustomerChannelInbound,
  CustomerChannelResult,
} from "./customer_channel_bridge.js";

export interface CustomerChannelBridge {
  handle(request: CustomerChannelInbound): Promise<CustomerChannelResult>;
  delivered(input: Readonly<{
    channel: "whatsapp" | "telegram";
    messageId: string;
  }>): Promise<void>;
}

export interface WhatsAppChannelConfig {
  readonly verifyToken: string;
  readonly appSecret: string;
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly graphVersion: string;
}

export interface TelegramChannelConfig {
  readonly botToken: string;
  readonly webhookSecret: string;
}

export interface CustomerChannelOptions {
  readonly bridge: CustomerChannelBridge;
  readonly whatsapp?: WhatsAppChannelConfig;
  readonly telegram?: TelegramChannelConfig;
}

function exactHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`channels.provider_http_${response.status}`);
  }
  return body;
}

async function download(
  url: string,
  headers: Readonly<Record<string, string>>,
  maxBytes = 8 * 1024 * 1024,
): Promise<Buffer> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`channels.media_http_${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > maxBytes) {
    throw new RangeError("channels.media_too_large");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1 || data.length > maxBytes) {
    throw new RangeError("channels.media_too_large");
  }
  return data;
}

function splitText(value: string, max = 3500): readonly string[] {
  const text = value.trim();
  if (text.length <= max) return Object.freeze([text]);
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max / 2) cut = remaining.lastIndexOf(" ", max);
    if (cut < max / 2) cut = max;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return Object.freeze(chunks);
}

async function sendWhatsApp(
  config: WhatsAppChannelConfig,
  to: string,
  text: string,
): Promise<void> {
  for (const chunk of splitText(text)) {
    await fetchJson(
      `https://graph.facebook.com/${encodeURIComponent(config.graphVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: chunk },
        }),
      },
    );
  }
}

async function whatsappMedia(
  config: WhatsAppChannelConfig,
  message: Record<string, unknown>,
): Promise<CustomerChannelInbound["media"] | undefined> {
  const type = typeof message.type === "string" ? message.type : "";
  if (!["audio", "image", "document"].includes(type)) return undefined;
  const node = message[type];
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  const row = node as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return undefined;
  const meta = await fetchJson(
    `https://graph.facebook.com/${encodeURIComponent(config.graphVersion)}/${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${config.accessToken}` } },
  );
  const url = typeof meta.url === "string" ? meta.url : "";
  if (!url) throw new Error("channels.whatsapp_media_url_missing");
  const bytes = await download(url, {
    authorization: `Bearer ${config.accessToken}`,
  });
  const mimeType =
    (typeof meta.mime_type === "string" && meta.mime_type) ||
    (typeof row.mime_type === "string" && row.mime_type) ||
    (type === "audio" ? "audio/ogg" : type === "image" ? "image/jpeg" : "application/octet-stream");
  return Object.freeze({
    mimeType,
    dataBase64: bytes.toString("base64"),
    ...(typeof row.filename === "string" && row.filename
      ? { name: row.filename.slice(0, 240) }
      : {}),
  });
}

function telegramReplyChoices(text: string): readonly string[] {
  const choices: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*\d{1,2}[.)]\s+(.{1,120})\s*$/u.exec(line);
    const label = match?.[1]?.trim();
    if (!label) continue;
    const publicId = /\(@([a-z0-9][a-z0-9_-]{2,63})\)/iu.exec(label)?.[1];
    const value = publicId ? `@${publicId}` : label;
    if (!choices.includes(value)) choices.push(value);
    if (choices.length >= 6) break;
  }
  return choices.length >= 2 ? Object.freeze(choices) : Object.freeze([]);
}

async function sendTelegram(
  config: TelegramChannelConfig,
  chatId: string,
  text: string,
  requestContact: boolean,
): Promise<void> {
  const chunks = splitText(text, 3900);
  for (let index = 0; index < chunks.length; index += 1) {
    await fetchJson(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunks[index],
          ...(index === chunks.length - 1
            ? requestContact
              ? {
                  reply_markup: {
                    keyboard: [[{
                      text: "Connect my Masanawa number",
                      request_contact: true,
                    }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                  },
                }
              : telegramReplyChoices(text).length > 0
                ? {
                    reply_markup: {
                      keyboard: telegramReplyChoices(text).map((choice) => [{ text: choice }]),
                      resize_keyboard: true,
                      one_time_keyboard: true,
                    },
                  }
                : {}
            : {}),
        }),
      },
    );
  }
}

async function telegramMedia(
  config: TelegramChannelConfig,
  message: Record<string, unknown>,
): Promise<CustomerChannelInbound["media"] | undefined> {
  let fileId = "";
  let mimeType = "";
  let name: string | undefined;

  if (message.voice && typeof message.voice === "object" && !Array.isArray(message.voice)) {
    const voice = message.voice as Record<string, unknown>;
    fileId = typeof voice.file_id === "string" ? voice.file_id : "";
    mimeType = typeof voice.mime_type === "string" ? voice.mime_type : "audio/ogg";
  } else if (message.document && typeof message.document === "object" && !Array.isArray(message.document)) {
    const doc = message.document as Record<string, unknown>;
    fileId = typeof doc.file_id === "string" ? doc.file_id : "";
    mimeType = typeof doc.mime_type === "string" ? doc.mime_type : "application/octet-stream";
    name = typeof doc.file_name === "string" ? doc.file_name.slice(0, 240) : undefined;
  } else if (Array.isArray(message.photo) && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1];
    if (photo && typeof photo === "object" && !Array.isArray(photo)) {
      fileId = typeof (photo as Record<string, unknown>).file_id === "string"
        ? (photo as Record<string, unknown>).file_id as string
        : "";
      mimeType = "image/jpeg";
    }
  }
  if (!fileId) return undefined;

  const meta = await fetchJson(
    `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { method: "GET" },
  );
  const result = meta.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("channels.telegram_file_missing");
  }
  const path = (result as Record<string, unknown>).file_path;
  if (typeof path !== "string" || !path) {
    throw new Error("channels.telegram_file_missing");
  }
  const bytes = await download(
    `https://api.telegram.org/file/bot${config.botToken}/${path}`,
    {},
  );
  return Object.freeze({
    mimeType,
    dataBase64: bytes.toString("base64"),
    ...(name ? { name } : {}),
  });
}

export function registerCustomerChannelRoutes(
  app: FastifyInstance,
  options: CustomerChannelOptions,
): void {
  const rawBodies = new WeakMap<FastifyRequest, Buffer>();

  if (options.whatsapp) {
    const config = options.whatsapp;

    app.get("/channels/whatsapp/webhook", async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      if (
        query["hub.mode"] === "subscribe" &&
        typeof query["hub.verify_token"] === "string" &&
        safeEqual(query["hub.verify_token"], config.verifyToken) &&
        typeof query["hub.challenge"] === "string"
      ) {
        return reply.type("text/plain").send(query["hub.challenge"]);
      }
      return reply.code(403).send({ error: "verification_failed" });
    });

    app.post(
      "/channels/whatsapp/webhook",
      {
        preParsing: async (request, _reply, payload) => {
          const pass = new PassThrough();
          const chunks: Buffer[] = [];
          payload.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          payload.on("end", () => {
            rawBodies.set(request, Buffer.concat(chunks));
          });
          payload.pipe(pass);
          return pass;
        },
      },
      async (request, reply) => {
        const raw = rawBodies.get(request) ?? Buffer.alloc(0);
        const signature = exactHeader(request.headers["x-hub-signature-256"]);
        const expected =
          "sha256=" +
          createHmac("sha256", config.appSecret).update(raw).digest("hex");
        if (!signature || !safeEqual(signature, expected)) {
          return reply.code(401).send({ error: "invalid_signature" });
        }

        const body = request.body as Record<string, unknown>;
        const entries = Array.isArray(body.entry) ? body.entry : [];
        for (const entry of entries) {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
          const changes = Array.isArray((entry as Record<string, unknown>).changes)
            ? (entry as Record<string, unknown>).changes as unknown[]
            : [];
          for (const change of changes) {
            if (!change || typeof change !== "object" || Array.isArray(change)) continue;
            const value = (change as Record<string, unknown>).value;
            if (!value || typeof value !== "object" || Array.isArray(value)) continue;
            const messages = Array.isArray((value as Record<string, unknown>).messages)
              ? (value as Record<string, unknown>).messages as unknown[]
              : [];
            for (const rawMessage of messages) {
              if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) continue;
              const message = rawMessage as Record<string, unknown>;
              const id = typeof message.id === "string" ? message.id : "";
              const from = typeof message.from === "string" ? message.from : "";
              if (!id || !from) continue;
              const textNode =
                message.text && typeof message.text === "object" && !Array.isArray(message.text)
                  ? message.text as Record<string, unknown>
                  : {};
              const text = typeof textNode.body === "string" ? textNode.body.trim() : "";
              const media = await whatsappMedia(config, message);
              if (!text && !media) continue;
              const result = await options.bridge.handle({
                channel: "whatsapp",
                messageId: id,
                externalUserId: from,
                chatId: from,
                phone: from,
                text: text || "Please help me with this attachment.",
                ...(media ? { media } : {}),
              });
              if (result.shouldDeliver && result.reply) {
                await sendWhatsApp(config, from, result.reply);
                await options.bridge.delivered({
                  channel: "whatsapp",
                  messageId: id,
                });
              }
            }
          }
        }
        return { received: true };
      },
    );
  }

  if (options.telegram) {
    const config = options.telegram;
    app.post("/channels/telegram/webhook", async (request, reply) => {
      const secret = exactHeader(
        request.headers["x-telegram-bot-api-secret-token"],
      );
      if (!secret || !safeEqual(secret, config.webhookSecret)) {
        return reply.code(401).send({ error: "invalid_secret" });
      }
      const update = request.body as Record<string, unknown>;
      const rawMessage = update.message;
      if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) {
        return { received: true };
      }
      const message = rawMessage as Record<string, unknown>;
      const from = message.from;
      const chat = message.chat;
      if (
        !from || typeof from !== "object" || Array.isArray(from) ||
        !chat || typeof chat !== "object" || Array.isArray(chat)
      ) {
        return { received: true };
      }
      const chatType = (chat as Record<string, unknown>).type;
      if (typeof chatType === "string" && chatType !== "private") {
        return { received: true };
      }
      const fromId = String((from as Record<string, unknown>).id ?? "");
      const chatId = String((chat as Record<string, unknown>).id ?? "");
      const messageId = String(message.message_id ?? "");
      if (!fromId || !chatId || !messageId) return { received: true };

      let phone: string | undefined;
      const contact = message.contact;
      if (contact && typeof contact === "object" && !Array.isArray(contact)) {
        const row = contact as Record<string, unknown>;
        if (String(row.user_id ?? "") === fromId && typeof row.phone_number === "string") {
          phone = row.phone_number;
        }
      }
      const text =
        (typeof message.text === "string" && message.text.trim()) ||
        (typeof message.caption === "string" && message.caption.trim()) ||
        (phone ? "Connect my Telegram account." : "");
      const media = await telegramMedia(config, message);
      if (!text && !media && !phone) return { received: true };
      const result = await options.bridge.handle({
        channel: "telegram",
        messageId,
        externalUserId: fromId,
        chatId,
        ...(phone ? { phone } : {}),
        text: text || "Please help me with this attachment.",
        ...(media ? { media } : {}),
      });
      if (result.shouldDeliver && result.reply) {
        await sendTelegram(
          config,
          chatId,
          result.reply,
          result.requestContact,
        );
        await options.bridge.delivered({
          channel: "telegram",
          messageId,
        });
      }
      return { received: true };
    });
  }
}

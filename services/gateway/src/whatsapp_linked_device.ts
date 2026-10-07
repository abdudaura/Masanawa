import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type {
  CustomerChannelBridge,
  CustomerChannelInbound,
} from "./customer_channel_routes.js";

export interface LinkedWhatsAppSnapshot {
  readonly mode: "linked-device";
  readonly status: "offline" | "connecting" | "qr" | "connected" | "reconnecting" | "logged-out";
  readonly connected: boolean;
  readonly phone: string | null;
  readonly qrDataUrl: string | null;
  readonly lastEvent: string;
  readonly reconnectAttempt: number;
}

export interface LinkedWhatsAppController {
  snapshot(): LinkedWhatsAppSnapshot;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
}

export interface LinkedWhatsAppOptions {
  readonly bridge: CustomerChannelBridge;
  readonly authDir: string;
  readonly reconnectBaseMs?: number;
  readonly socketFactory?: typeof makeWASocket;
}

function phoneFromJid(jid: string): string {
  const bare = jid.split("@")[0]?.split(":")[0]?.replace(/\D/gu, "") ?? "";
  return bare ? `+${bare}` : "";
}

function textFromMessage(message: Record<string, unknown>): string {
  const conversation = typeof message.conversation === "string" ? message.conversation : "";
  const extended = message.extendedTextMessage;
  const extendedText =
    extended && typeof extended === "object" && !Array.isArray(extended) &&
    typeof (extended as Record<string, unknown>).text === "string"
      ? String((extended as Record<string, unknown>).text)
      : "";
  const image = message.imageMessage;
  const imageCaption =
    image && typeof image === "object" && !Array.isArray(image) &&
    typeof (image as Record<string, unknown>).caption === "string"
      ? String((image as Record<string, unknown>).caption)
      : "";
  const video = message.videoMessage;
  const videoCaption =
    video && typeof video === "object" && !Array.isArray(video) &&
    typeof (video as Record<string, unknown>).caption === "string"
      ? String((video as Record<string, unknown>).caption)
      : "";
  return (conversation || extendedText || imageCaption || videoCaption).trim();
}

function mediaKind(message: Record<string, unknown>): "audio" | "image" | "document" | null {
  if (message.audioMessage) return "audio";
  if (message.imageMessage) return "image";
  if (message.documentMessage) return "document";
  return null;
}

function mimeFor(message: Record<string, unknown>, kind: "audio" | "image" | "document"): string {
  const key = kind === "audio" ? "audioMessage" : kind === "image" ? "imageMessage" : "documentMessage";
  const node = message[key];
  if (node && typeof node === "object" && !Array.isArray(node)) {
    const mime = (node as Record<string, unknown>).mimetype;
    if (typeof mime === "string" && mime.trim()) return mime.trim();
  }
  return kind === "audio" ? "audio/ogg" : kind === "image" ? "image/jpeg" : "application/octet-stream";
}

function nameFor(message: Record<string, unknown>): string | undefined {
  const node = message.documentMessage;
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  const name = (node as Record<string, unknown>).fileName;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 240) : undefined;
}

export function createLinkedWhatsAppController(
  options: LinkedWhatsAppOptions,
): LinkedWhatsAppController {
  const authDir = path.resolve(options.authDir);
  const socketFactory = options.socketFactory ?? makeWASocket;
  const reconnectBaseMs = Math.max(500, options.reconnectBaseMs ?? 2_000);

  let socket: WASocket | null = null;
  let stopped = true;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let snapshot: LinkedWhatsAppSnapshot = Object.freeze({
    mode: "linked-device",
    status: "offline",
    connected: false,
    phone: null,
    qrDataUrl: null,
    lastEvent: "not-started",
    reconnectAttempt: 0,
  });

  const update = (patch: Partial<LinkedWhatsAppSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
  };

  async function processMessage(raw: any, sock: WASocket): Promise<void> {
    const key = raw?.key;
    const remoteJid = typeof key?.remoteJid === "string" ? key.remoteJid : "";
    const messageId = typeof key?.id === "string" ? key.id : "";
    if (!remoteJid || !messageId || key?.fromMe === true) return;
    if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) return;

    const phone = phoneFromJid(remoteJid);
    if (!phone) return;
    const message =
      raw?.message && typeof raw.message === "object" && !Array.isArray(raw.message)
        ? raw.message as Record<string, unknown>
        : {};
    const text = textFromMessage(message);
    const kind = mediaKind(message);

    let media: CustomerChannelInbound["media"] | undefined;
    if (kind) {
      const bytes = await downloadMediaMessage(
        raw,
        "buffer",
        {},
        {
          logger: undefined as never,
          reuploadRequest: sock.updateMediaMessage,
        },
      );
      if (Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 8 * 1024 * 1024) {
        media = Object.freeze({
          mimeType: mimeFor(message, kind),
          dataBase64: bytes.toString("base64"),
          ...(nameFor(message) ? { name: nameFor(message)! } : {}),
        });
      }
    }

    if (!text && !media) return;

    const result = await options.bridge.handle({
      channel: "whatsapp",
      messageId,
      externalUserId: phone,
      chatId: remoteJid,
      phone,
      text: text || "Please help me with this attachment.",
      ...(media ? { media } : {}),
    });

    if (result.shouldDeliver && result.reply) {
      await sock.sendMessage(remoteJid, { text: result.reply });
      await options.bridge.delivered({ channel: "whatsapp", messageId });
    }
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer) return;
    const attempt = snapshot.reconnectAttempt + 1;
    update({
      status: "reconnecting",
      connected: false,
      qrDataUrl: null,
      reconnectAttempt: attempt,
      lastEvent: "reconnect-scheduled",
    });
    const delay = Math.min(60_000, reconnectBaseMs * Math.max(1, 2 ** Math.min(attempt - 1, 5)));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect().catch(() => scheduleReconnect());
    }, delay);
  }

  async function connect(): Promise<void> {
    const myGeneration = ++generation;
    await mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    update({
      status: "connecting",
      connected: false,
      qrDataUrl: null,
      lastEvent: "connecting",
    });

    const sock = socketFactory({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
    });
    socket = sock;

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const message of messages) {
        void processMessage(message, sock).catch(() => undefined);
      }
    });
    sock.ev.on("connection.update", (event) => {
      if (stopped || myGeneration !== generation) return;
      if (event.qr) {
        void QRCode.toDataURL(event.qr).then((qrDataUrl) => {
          if (stopped || myGeneration !== generation) return;
          update({
            status: "qr",
            connected: false,
            qrDataUrl,
            lastEvent: "qr-ready",
          });
        }).catch(() => undefined);
      }

      if (event.connection === "open") {
        const id = String(sock.user?.id ?? "");
        update({
          status: "connected",
          connected: true,
          phone: phoneFromJid(id) || snapshot.phone,
          qrDataUrl: null,
          lastEvent: "connected",
          reconnectAttempt: 0,
        });
      }

      if (event.connection === "close") {
        socket = null;
        const code = new Boom(event.lastDisconnect?.error).output.statusCode;
        if (code === DisconnectReason.loggedOut) {
          update({
            status: "logged-out",
            connected: false,
            qrDataUrl: null,
            lastEvent: "logged-out",
          });
          return;
        }
        scheduleReconnect();
      }
    });
  }

  return Object.freeze({
    snapshot: () => snapshot,

    async start() {
      if (!stopped) return;
      stopped = false;
      await connect();
    },

    async stop() {
      stopped = true;
      generation += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socket?.end(undefined);
      socket = null;
      update({
        status: "offline",
        connected: false,
        qrDataUrl: null,
        lastEvent: "stopped",
      });
    },

    async reset() {
      stopped = true;
      generation += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      try { await socket?.logout(); } catch { /* already disconnected */ }
      socket?.end(undefined);
      socket = null;
      await rm(authDir, { recursive: true, force: true });
      await mkdir(authDir, { recursive: true });
      update({
        status: "offline",
        connected: false,
        phone: null,
        qrDataUrl: null,
        lastEvent: "session-reset",
        reconnectAttempt: 0,
      });
      stopped = false;
      await connect();
    },
  });
}

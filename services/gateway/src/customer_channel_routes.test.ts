import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { CustomerChannelBridge } from "./customer_channel_bridge.js";
import { registerCustomerChannelRoutes } from "./customer_channel_routes.js";

function bridge() {
  return {
    handle: vi.fn<CustomerChannelBridge["handle"]>(async () => ({
      handled: true,
      duplicate: false,
      reply: "",
      shouldDeliver: false,
      requestContact: false,
    })),
    delivered: vi.fn<CustomerChannelBridge["delivered"]>(async () => undefined),
  };
}

function whatsappPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "business",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          messages: [{
            id: "wamid.1",
            from: "2348012345678",
            type: "text",
            text: { body: "Hello Gwani" },
          }],
        },
      }],
    }],
  };
}

describe("customer channel webhook routes", () => {
  it("verifies WhatsApp GET challenge with the configured token", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      whatsapp: {
        verifyToken: "verify-secret",
        appSecret: "app-secret",
        accessToken: "access-token",
        phoneNumberId: "phone-id",
        graphVersion: "v23.0",
      },
    });

    const accepted = await app.inject({
      method: "GET",
      url: "/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=12345",
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.body).toBe("12345");

    const rejected = await app.inject({
      method: "GET",
      url: "/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",
    });
    expect(rejected.statusCode).toBe(403);
    await app.close();
  });

  it("rejects a WhatsApp POST before execution when the raw-body signature is invalid", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      whatsapp: {
        verifyToken: "verify-secret",
        appSecret: "app-secret",
        accessToken: "access-token",
        phoneNumberId: "phone-id",
        graphVersion: "v23.0",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/whatsapp/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      payload: JSON.stringify(whatsappPayload()),
    });

    expect(response.statusCode).toBe(401);
    expect(channelBridge.handle).not.toHaveBeenCalled();
    await app.close();
  });

  it("accepts an exactly signed WhatsApp message and preserves provider identity", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    const raw = JSON.stringify(whatsappPayload());
    const signature =
      "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");

    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      whatsapp: {
        verifyToken: "verify-secret",
        appSecret: "app-secret",
        accessToken: "access-token",
        phoneNumberId: "phone-id",
        graphVersion: "v23.0",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/whatsapp/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      payload: raw,
    });

    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledTimes(1);
    expect(channelBridge.handle.mock.calls[0]![0]).toEqual({
      channel: "whatsapp",
      messageId: "wamid.1",
      externalUserId: "2348012345678",
      chatId: "2348012345678",
      phone: "2348012345678",
      text: "Hello Gwani",
    });
    await app.close();
  });

  it("rejects Telegram updates with the wrong webhook secret before execution", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: {
        botToken: "bot-token",
        webhookSecret: "telegram-secret",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong",
      },
      payload: {
        update_id: 1,
        message: {
          message_id: 9,
          from: { id: 123 },
          chat: { id: 123 },
          text: "Hello",
        },
      },
    });

    expect(response.statusCode).toBe(401);
    expect(channelBridge.handle).not.toHaveBeenCalled();
    await app.close();
  });

  it("accepts Telegram text with the configured secret and canonical provider IDs", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: {
        botToken: "bot-token",
        webhookSecret: "telegram-secret",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 1,
        message: {
          message_id: 9,
          from: { id: 123 },
          chat: { id: 123, type: "private" },
          text: "Teach me algebra",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledWith({
      channel: "telegram",
      messageId: "9",
      externalUserId: "123",
      chatId: "123",
      text: "Teach me algebra",
    });
    await app.close();
  });

  it("never trusts a Telegram contact phone unless contact.user_id matches the sender", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: {
        botToken: "bot-token",
        webhookSecret: "telegram-secret",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 2,
        message: {
          message_id: 10,
          from: { id: 123 },
          chat: { id: 123, type: "private" },
          text: "Connect this number",
          contact: {
            user_id: 999,
            phone_number: "+2348000000000",
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledTimes(1);
    expect(channelBridge.handle.mock.calls[0]![0]).toEqual({
      channel: "telegram",
      messageId: "10",
      externalUserId: "123",
      chatId: "123",
      text: "Connect this number",
    });
    await app.close();
  });

  it("ignores Telegram group and supergroup messages before Agent execution", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: {
        botToken: "bot-token",
        webhookSecret: "telegram-secret",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 3,
        message: {
          message_id: 11,
          from: { id: 123 },
          chat: { id: -100123, type: "supergroup" },
          text: "buy airtime for me",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).not.toHaveBeenCalled();
    await app.close();
  });


  it("renders Telegram Twin choices as tappable @publicId reply buttons", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    channelBridge.handle.mockResolvedValueOnce({
      handled: true,
      duplicate: false,
      reply: "I found several public Twins. Tell me the name or @ID you want:\n1. Aisha Bello (@aisha-one)\n2. Aisha Musa (@aisha-two)",
      shouldDeliver: true,
      requestContact: false,
    });
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit | undefined) =>
        new Response(JSON.stringify({ ok: true, result: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: {
        botToken: "bot-token",
        webhookSecret: "telegram-secret",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 4,
        message: {
          message_id: 12,
          from: { id: 123 },
          chat: { id: 123, type: "private" },
          text: "talk to Aisha twin",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.reply_markup).toEqual({
      keyboard: [[{ text: "@aisha-one" }], [{ text: "@aisha-two" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
    expect(channelBridge.delivered).toHaveBeenCalledWith({
      channel: "telegram",
      messageId: "12",
    });
    vi.unstubAllGlobals();
    await app.close();
  });


  it("rejects oversized WhatsApp raw webhook envelopes before signature or agent execution", async () => {
    const app = Fastify({ bodyLimit: 2_097_152 });
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      whatsapp: {
        verifyToken: "verify-secret",
        appSecret: "app-secret",
        accessToken: "access-token",
        phoneNumberId: "phone-id",
        graphVersion: "v23.0",
      },
    });
    const raw = JSON.stringify({ ...whatsappPayload(), padding: "x".repeat(1_048_576) });
    const signature = "sha256=" + createHmac("sha256", "app-secret")
      .update(raw).digest("hex");
    const result = await app.inject({
      method: "POST",
      url: "/channels/whatsapp/webhook",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      payload: raw,
    });
    expect(result.statusCode).toBe(413);
    expect(channelBridge.handle).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ["missing private chat type", { id: 123 }],
    ["sender/chat mismatch", { id: 456, type: "private" }],
    ["string chat ID", { id: "123", type: "private" }],
    ["group chat", { id: 123, type: "group" }],
  ])("ignores Telegram messages with %s before any account activity", async (_reason, chat) => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 6,
        message: {
          message_id: 16,
          from: { id: 123 },
          chat,
          text: "my balance is confidential",
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not link Telegram contact numbers using untrusted textual user IDs", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 7,
        message: {
          message_id: 17,
          from: { id: 123 },
          chat: { id: 123, type: "private" },
          contact: { user_id: "123", phone_number: "+2348000000000" },
          text: "Connect this contact",
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledWith({
      channel: "telegram",
      messageId: "17",
      externalUserId: "123",
      chatId: "123",
      text: "Connect this contact",
    });
    await app.close();
  });

  it("allows a verified private Telegram contact from the actual sender", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    registerCustomerChannelRoutes(app, {
      bridge: channelBridge,
      telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/channels/telegram/webhook",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "telegram-secret",
      },
      payload: {
        update_id: 8,
        message: {
          message_id: 18,
          from: { id: 123 },
          chat: { id: 123, type: "private" },
          contact: { user_id: 123, phone_number: "+2348000000000" },
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledWith({
      channel: "telegram",
      messageId: "18",
      externalUserId: "123",
      chatId: "123",
      phone: "+2348000000000",
      text: "Connect my Telegram account.",
    });
    await app.close();
  });

  it("caps provider media streaming despite a falsely small Content-Length header", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    let streamedChunks = 0;
    const largeStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        streamedChunks += 1;
        controller.enqueue(new Uint8Array(1_048_576));
      },
    });
    const fetchMock = vi.fn(async (target: RequestInfo | URL) => {
      const url = String(target);
      if (url.includes("/getFile?")) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: "voice/file.ogg" },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(largeStream, {
        status: 200,
        headers: { "content-length": "1", "content-type": "audio/ogg" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      registerCustomerChannelRoutes(app, {
        bridge: channelBridge,
        telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
      });
      const response = await app.inject({
        method: "POST",
        url: "/channels/telegram/webhook",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "telegram-secret",
        },
        payload: {
          update_id: 10,
          message: {
            message_id: 20,
            from: { id: 123 },
            chat: { id: 123, type: "private" },
            voice: { file_id: "file-1", mime_type: "audio/ogg" },
          },
        },
      });
      // Current channel transport treats oversized provider media as retryable.
      // It must never deliver an oversized buffer to model inference.
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(channelBridge.handle).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(streamedChunks).toBeLessThanOrEqual(11);
    } finally {
      vi.unstubAllGlobals();
      await app.close();
    }
  });


  it("bounds untrusted provider JSON streams and cancels before private agent execution", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    let cancelled = 0;
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new Uint8Array(128 * 1024));
      },
      cancel() { cancelled += 1; },
    });
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit | undefined) =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "2" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      registerCustomerChannelRoutes(app, {
        bridge: channelBridge,
        telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
      });
      const response = await app.inject({
        method: "POST", url: "/channels/telegram/webhook",
        headers: { "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "telegram-secret" },
        payload: { update_id: 32, message: {
          message_id: 52, from: { id: 123 }, chat: { id: 123, type: "private" },
          voice: { file_id: "voice-123" },
        } },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(chunks).toBeLessThanOrEqual(5);
      expect(cancelled).toBe(1);
      expect(channelBridge.handle).not.toHaveBeenCalled();
      const init = fetchMock.mock.calls[0]![1];
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
      await app.close();
    }
  });

  it("allows qualified small provider JSON and media with separate deadline signals", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    const fetchMock = vi.fn(async (target: RequestInfo | URL, _init?: RequestInit | undefined) =>
      String(target).includes("/getFile?")
        ? new Response(JSON.stringify({ ok: true, result: { file_path: "voice/sample.ogg" } }),
          { status: 200, headers: { "content-type": "application/json" } })
        : new Response(new Uint8Array([1, 2]), {
          status: 200, headers: { "content-type": "audio/ogg" },
        }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      registerCustomerChannelRoutes(app, {
        bridge: channelBridge,
        telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
      });
      const response = await app.inject({
        method: "POST", url: "/channels/telegram/webhook",
        headers: { "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "telegram-secret" },
        payload: { update_id: 33, message: {
          message_id: 53, from: { id: 123 }, chat: { id: 123, type: "private" },
          voice: { file_id: "voice-123", mime_type: "audio/ogg" },
        } },
      });
      expect(response.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const call of fetchMock.mock.calls) {
        expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
      }
      expect(channelBridge.handle).toHaveBeenCalledWith({
        channel: "telegram", messageId: "53", externalUserId: "123",
        chatId: "123", text: "Please help me with this attachment.",
        media: { mimeType: "audio/ogg", dataBase64: "AQI=" },
      });
    } finally {
      vi.unstubAllGlobals();
      await app.close();
    }
  });

  it("fails closed on malformed provider metadata without processing attachments", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response('{"result":', { status: 200,
        headers: { "content-type": "application/json" } })));
    try {
      registerCustomerChannelRoutes(app, {
        bridge: channelBridge,
        telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
      });
      const response = await app.inject({
        method: "POST", url: "/channels/telegram/webhook",
        headers: { "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "telegram-secret" },
        payload: { update_id: 34, message: {
          message_id: 54, from: { id: 123 }, chat: { id: 123, type: "private" },
          voice: { file_id: "voice-123" },
        } },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(channelBridge.handle).not.toHaveBeenCalled();
      expect(channelBridge.delivered).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      await app.close();
    }
  });

  it("never marks a channel reply delivered after an oversized outbound provider JSON reply", async () => {
    const app = Fastify();
    const channelBridge = bridge();
    channelBridge.handle.mockResolvedValueOnce({
      handled: true,
      duplicate: false, reply: "Hello", shouldDeliver: true, requestContact: false,
    });
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array(300 * 1024), {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "307200" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      registerCustomerChannelRoutes(app, {
        bridge: channelBridge,
        telegram: { botToken: "bot-token", webhookSecret: "telegram-secret" },
      });
      const response = await app.inject({
        method: "POST", url: "/channels/telegram/webhook",
        headers: { "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "telegram-secret" },
        payload: { update_id: 35, message: {
          message_id: 55, from: { id: 123 }, chat: { id: 123, type: "private" },
          text: "Hello",
        } },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(channelBridge.handle).toHaveBeenCalledTimes(1);
      expect(channelBridge.delivered).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      await app.close();
    }
  });

});


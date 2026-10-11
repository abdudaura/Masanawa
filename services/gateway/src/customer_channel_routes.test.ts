import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerCustomerChannelRoutes } from "./customer_channel_routes.js";
import type { CustomerChannelInbound } from "./customer_channel_bridge.js";

function bridge() {
  return {
    handle: vi.fn(async (_request: CustomerChannelInbound) => ({
      handled: true,
      duplicate: false,
      reply: "",
      shouldDeliver: false,
      requestContact: false,
    })),
    delivered: vi.fn(async () => undefined),
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
          chat: { id: 456 },
          text: "Teach me algebra",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(channelBridge.handle).toHaveBeenCalledWith({
      channel: "telegram",
      messageId: "9",
      externalUserId: "123",
      chatId: "456",
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
          chat: { id: 123 },
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
      async (_input: Request | URL | string, _init?: RequestInit) =>
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

});

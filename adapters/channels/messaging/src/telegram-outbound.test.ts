import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createTelegramOutboundSender,
  type ChannelOutboundRequest,
} from "./index.js";

const accountId = createCanonicalId("channel-account");
const requestId = createCanonicalId("request");
const now = toInstant("2026-10-05T20:00:00.000Z");

function request(
  content: ChannelOutboundRequest["content"],
  replyToMessageId: string | null = null,
): ChannelOutboundRequest {
  return {
    schemaVersion: 1,
    requestId,
    channel: "telegram",
    accountId,
    conversation: {
      system: "telegram",
      namespace: "9001",
      value: "123",
      conversationKind: "direct",
    },
    replyToMessageId,
    content,
  };
}

describe("Telegram outbound provider translation", () => {
  it("translates opaque options into inline callback buttons", async () => {
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: {
        ok: true,
        result: {
          message_id: 77,
          date: 1791230400,
        },
      },
    }));
    const sender = createTelegramOutboundSender({
      accountId,
      botId: "9001",
      edge: { call },
      now: () => now,
    });

    await expect(
      sender.send(
        request({
          kind: "options",
          prompt: "Choose all that apply.",
          options: [
            { label: "2/4", selectionId: "stage_two_fourths" },
            { label: "3/6", selectionId: "stage_three_sixths" },
          ],
        }),
      ),
    ).resolves.toEqual({
      status: "accepted",
      providerMessageId: "77",
      acceptedAt: toInstant("2026-10-05T20:00:00.000Z"),
    });

    expect(call).toHaveBeenCalledWith({
      method: "sendMessage",
      body: {
        chat_id: 123,
        text: "Choose all that apply.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "2/4", callback_data: "stage_two_fourths" }],
            [{ text: "3/6", callback_data: "stage_three_sixths" }],
          ],
        },
      },
    });
  });

  it("uses Telegram reply_parameters without trusting arbitrary chat scope", async () => {
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { ok: true, result: { message_id: 78 } },
    }));
    const sender = createTelegramOutboundSender({
      accountId,
      botId: "9001",
      edge: { call },
      now: () => now,
    });
    await sender.send(
      request({ kind: "text", text: "Hello" }, "15"),
    );
    expect(call).toHaveBeenCalledWith({
      method: "sendMessage",
      body: {
        chat_id: 123,
        text: "Hello",
        reply_parameters: { message_id: 15 },
      },
    });

    await expect(
      sender.send({
        ...request({ kind: "text", text: "No" }),
        conversation: {
          system: "telegram",
          namespace: "other-bot",
          value: "123",
          conversationKind: "direct",
        },
      }),
    ).rejects.toThrow(/configured account scope/);
  });

  it("resolves authorized audio media before provider send and never exposes platform file refs", async () => {
    const resolve = vi.fn(async () => ({
      providerFileId: "telegram-file-id",
    }));
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { ok: true, result: { message_id: 79 } },
    }));
    const sender = createTelegramOutboundSender({
      accountId,
      botId: "9001",
      edge: { call },
      media: { resolve },
      now: () => now,
    });

    await sender.send(
      request({
        kind: "audio",
        fileRef: "artifact://private/audio/1",
        mimeType: "audio/ogg",
        caption: null,
      }),
    );
    expect(resolve).toHaveBeenCalledWith({
      channel: "telegram",
      accountId,
      fileRef: "artifact://private/audio/1",
      mimeType: "audio/ogg",
    });
    expect(call).toHaveBeenCalledWith({
      method: "sendVoice",
      body: {
        chat_id: 123,
        voice: "telegram-file-id",
      },
    });
    expect(JSON.stringify(call.mock.calls)).not.toContain(
      "artifact://private/audio/1",
    );
  });

  it("converts explicit provider rejection to safe rejected evidence", async () => {
    const sender = createTelegramOutboundSender({
      accountId,
      botId: "9001",
      edge: {
        async call() {
          return {
            status: "rejected" as const,
            safeCode: "telegram_recipient_blocked",
          };
        },
      },
      now: () => now,
    });
    await expect(
      sender.send(request({ kind: "text", text: "Hello" })),
    ).resolves.toEqual({
      status: "rejected",
      safeCode: "telegram_recipient_blocked",
    });
  });

  it("throws on malformed accepted response so the durable dispatcher treats the outcome as ambiguous", async () => {
    const sender = createTelegramOutboundSender({
      accountId,
      botId: "9001",
      edge: {
        async call() {
          return {
            status: "accepted" as const,
            body: { ok: true, result: {} },
          };
        },
      },
      now: () => now,
    });
    await expect(
      sender.send(request({ kind: "text", text: "Hello" })),
    ).rejects.toThrow(/message_id/);
  });
});

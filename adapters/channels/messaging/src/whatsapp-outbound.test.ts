import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createWhatsAppOutboundSender,
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
    channel: "whatsapp",
    accountId,
    conversation: {
      system: "whatsapp",
      namespace: "phone-1",
      value: "2348012345678",
      conversationKind: "direct",
    },
    replyToMessageId,
    content,
  };
}

describe("WhatsApp outbound provider translation", () => {
  it("uses reply buttons for up to three short opaque options", async () => {
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { messages: [{ id: "wamid.outbound-1" }] },
    }));
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
      edge: { call },
      now: () => now,
    });

    await expect(
      sender.send(
        request({
          kind: "options",
          prompt: "Choose one.",
          options: [
            { label: "Yes", selectionId: "opaque_yes" },
            { label: "No", selectionId: "opaque_no" },
          ],
        }),
      ),
    ).resolves.toEqual({
      status: "accepted",
      providerMessageId: "wamid.outbound-1",
      acceptedAt: now,
    });

    expect(call).toHaveBeenCalledWith({
      phoneNumberId: "phone-1",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "2348012345678",
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Choose one." },
          action: {
            buttons: [
              {
                type: "reply",
                reply: { id: "opaque_yes", title: "Yes" },
              },
              {
                type: "reply",
                reply: { id: "opaque_no", title: "No" },
              },
            ],
          },
        },
      },
    });
  });

  it("uses a list for larger option sets and preserves opaque row IDs", async () => {
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { messages: [{ id: "wamid.list" }] },
    }));
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
      edge: { call },
      now: () => now,
    });
    await sender.send(
      request({
        kind: "options",
        prompt: "Choose a fraction.",
        options: [
          { label: "One half", selectionId: "fraction_1_2" },
          { label: "Two fourths", selectionId: "fraction_2_4" },
          { label: "Three sixths", selectionId: "fraction_3_6" },
          { label: "Two thirds", selectionId: "fraction_2_3" },
        ],
      }),
    );
    const sent = call.mock.calls[0]![0].body as Record<string, unknown>;
    expect(sent).toMatchObject({
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Choose a fraction." },
      },
    });
    expect(JSON.stringify(sent)).toContain("fraction_3_6");
  });

  it("keeps reply context and exact account/recipient scope", async () => {
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { messages: [{ id: "wamid.reply" }] },
    }));
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
      edge: { call },
      now: () => now,
    });
    await sender.send(
      request({ kind: "text", text: "Reply" }, "wamid.inbound"),
    );
    expect(call).toHaveBeenCalledWith({
      phoneNumberId: "phone-1",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "2348012345678",
        type: "text",
        text: { body: "Reply" },
        context: { message_id: "wamid.inbound" },
      },
    });

    await expect(
      sender.send({
        ...request({ kind: "text", text: "No" }),
        conversation: {
          system: "whatsapp",
          namespace: "other-phone",
          value: "2348012345678",
          conversationKind: "direct",
        },
      }),
    ).rejects.toThrow(/configured account scope/);
  });

  it("resolves authorized audio to provider media id without exposing platform file refs", async () => {
    const resolve = vi.fn(async () => ({
      providerFileId: "whatsapp-media-id",
    }));
    const call = vi.fn(async () => ({
      status: "accepted" as const,
      body: { messages: [{ id: "wamid.audio" }] },
    }));
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
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
      channel: "whatsapp",
      accountId,
      fileRef: "artifact://private/audio/1",
      mimeType: "audio/ogg",
    });
    expect(call).toHaveBeenCalledWith({
      phoneNumberId: "phone-1",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "2348012345678",
        type: "audio",
        audio: { id: "whatsapp-media-id" },
      },
    });
    expect(JSON.stringify(call.mock.calls)).not.toContain(
      "artifact://private/audio/1",
    );
  });

  it("fails safely on unsupported provider presentation without calling the edge", async () => {
    const call = vi.fn();
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
      edge: { call: call as never },
      now: () => now,
    });
    await expect(
      sender.send(
        request({
          kind: "options",
          prompt: "Choose",
          options: [
            {
              label: "This option label is much too long for a WhatsApp row",
              selectionId: "opaque_long",
            },
          ],
        }),
      ),
    ).resolves.toEqual({
      status: "rejected",
      safeCode: "whatsapp_options_unsupported",
    });
    expect(call).not.toHaveBeenCalled();
  });

  it("throws on malformed accepted response so the durable dispatcher requires reconciliation", async () => {
    const sender = createWhatsAppOutboundSender({
      accountId,
      phoneNumberId: "phone-1",
      edge: {
        async call() {
          return {
            status: "accepted" as const,
            body: { messages: [] },
          };
        },
      },
      now: () => now,
    });
    await expect(
      sender.send(request({ kind: "text", text: "Hello" })),
    ).rejects.toThrow(/messages/);
  });
});

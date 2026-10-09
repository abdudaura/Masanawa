import { describe, expect, it, vi } from "vitest";
import type { CustomerChannelBridge, CustomerChannelInbound } from "../customer_channel_bridge.js";
import { createLinkingAwareChannelBridge } from "./provider_bridge.js";

const text = (messageId: string, value: string): CustomerChannelInbound => ({
  channel: "telegram", messageId,
  externalUserId: "150", chatId: "150", text: value,
});

describe("U26 opt-in provider ingress", () => {
  function setup() {
    const stored = new Map<string, { state: string; reply: string | null }>();
    let linked: { channel: string; externalUserId: string; tenantId: string; userId: string; chatId: string } | null = null;
    let verified = false;
    const channels = {
      readLink: vi.fn(async () => linked),
      claimMessage: vi.fn(async ({ messageId }: { messageId: string }) => {
        const current = stored.get(messageId);
        if (current) return { state: current.state, reply: current.reply };
        stored.set(messageId, { state: "processing", reply: null });
        return { state: "claimed", reply: null };
      }),
      completeMessage: vi.fn(async ({ messageId, reply }: { messageId: string; reply: string }) => {
        stored.set(messageId, { state: "completed", reply });
      }),
      markDelivered: vi.fn(async ({ messageId }: { messageId: string }) => {
        const previous = stored.get(messageId);
        if (previous) stored.set(messageId, { ...previous, state: "delivered" });
      }),
      failMessage: vi.fn(async () => undefined),
    };
    const assistant = { handle: vi.fn(async () => ({
      handled: true, duplicate: false, reply: "Assistant reply",
      requestContact: false, shouldDeliver: true,
    })), delivered: vi.fn() } satisfies CustomerChannelBridge;
    const linking = {
      consumeVerifiedInbound: vi.fn(async (incoming: CustomerChannelInbound) => {
        if (incoming.text !== "MN-AAAAAAAAAAAAAAAAAAAAAAAA") return false;
        linked = { channel: "telegram", externalUserId: "150", chatId: "150",
          tenantId: "tenant-A", userId: "user-A" };
        verified = true;
        return true;
      }),
    };
    const repository = {
      isVerifiedSender: vi.fn(async () => verified),
    };
    const bridge = createLinkingAwareChannelBridge({
      assistant,
      channels: channels as never,
      linking: linking as never,
      repository: repository as never,
    });
    return { bridge, channels, assistant, linking, repository, revoke: () => { verified = false; } };
  }

  it("never sends a non-consenting sender to legacy phone-autolinking bridge", async () => {
    const state = setup();
    const reply = await state.bridge.handle(text("a", "Hello Gwani"));
    expect(reply.reply).toMatch(/link this channel/i);
    expect(state.assistant.handle).not.toHaveBeenCalled();
    const repeated = await state.bridge.handle(text("a", "Hello Gwani"));
    expect(repeated.duplicate).toBe(true);
    expect(repeated.shouldDeliver).toBe(true);
    await state.bridge.delivered({ channel: "telegram", messageId: "a" });
    expect((await state.bridge.handle(text("a", "Hello Gwani"))).shouldDeliver).toBe(false);
  });

  it("keeps invalid codes private and only authorizes verified binding", async () => {
    const state = setup();
    await state.bridge.handle(text("1", "MN-BBBBBBBBBBBBBBBBBBBBBBBB"));
    expect(state.assistant.handle).not.toHaveBeenCalled();
    const linked = await state.bridge.handle(text("2", "MN-AAAAAAAAAAAAAAAAAAAAAAAA"));
    expect(linked.reply).toMatch(/connected/i);
    const normal = await state.bridge.handle(text("3", "Please explain data plans"));
    expect(normal.reply).toBe("Assistant reply");
    expect(state.assistant.handle).toHaveBeenCalledTimes(1);
    state.revoke();
    await state.bridge.handle(text("4", "What is my balance?"));
    expect(state.assistant.handle).toHaveBeenCalledTimes(1);
  });

  it("rejects non-private Telegram identities", async () => {
    const state = setup();
    const reply = await state.bridge.handle({
      channel: "telegram", externalUserId: "150", chatId: "-999",
      messageId: "10", text: "MN-AAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(reply.shouldDeliver).toBe(false);
    expect(state.linking.consumeVerifiedInbound).not.toHaveBeenCalled();
  });
});


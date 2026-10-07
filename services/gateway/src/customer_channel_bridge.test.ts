import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type {
  CustomerChannelRepository,
  PlatformSessionRepository,
} from "@masanawa/security";
import type {
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import { createCustomerChannelBridge } from "./customer_channel_bridge.js";

describe("Customer channel bridge", () => {
  it("does not re-execute a provider retry whose message id already completed", async () => {
    const conversationOpen = vi.fn();
    const channels = {
      async claimMessage() {
        return { state: "completed" as const, reply: "Stored reply" };
      },
    } as unknown as CustomerChannelRepository;
    const bridge = createCustomerChannelBridge({
      tenantId: createCanonicalId("tenant"),
      sessions: {} as PlatformSessionRepository,
      channels,
      platformProfiles: {} as PlatformAgentProfileRepository,
      userPreferences: {} as UserAgentPreferenceRepository,
      conversation: { open: conversationOpen } as unknown as AgentConversationService,
    });

    const result = await bridge.handle({
      channel: "whatsapp",
      messageId: "wamid.retry",
      externalUserId: "2348012345678",
      chatId: "2348012345678",
      phone: "2348012345678",
      text: "buy airtime",
    });

    expect(result.duplicate).toBe(true);
    expect(result.reply).toBe("Stored reply");
    expect(result.shouldDeliver).toBe(true);
    expect(conversationOpen).not.toHaveBeenCalled();
  });

  it("does not redeliver a provider retry after outbound delivery was acknowledged", async () => {
    const conversationOpen = vi.fn();
    const channels = {
      async claimMessage() {
        return { state: "delivered" as const, reply: "Stored reply" };
      },
    } as unknown as CustomerChannelRepository;
    const bridge = createCustomerChannelBridge({
      tenantId: createCanonicalId("tenant"),
      sessions: {} as PlatformSessionRepository,
      channels,
      platformProfiles: {} as PlatformAgentProfileRepository,
      conversation: { open: conversationOpen } as unknown as AgentConversationService,
    });

    const result = await bridge.handle({
      channel: "telegram",
      messageId: "901",
      externalUserId: "12345",
      chatId: "12345",
      text: "hello",
    });

    expect(result.duplicate).toBe(true);
    expect(result.shouldDeliver).toBe(false);
    expect(conversationOpen).not.toHaveBeenCalled();
  });

  it("records outbound delivery acknowledgement separately from Agent completion", async () => {
    const markDelivered = vi.fn(async (_input: unknown) => undefined);
    const channels = { markDelivered } as unknown as CustomerChannelRepository;
    const bridge = createCustomerChannelBridge({
      tenantId: createCanonicalId("tenant"),
      sessions: {} as PlatformSessionRepository,
      channels,
      platformProfiles: {} as PlatformAgentProfileRepository,
      conversation: {} as AgentConversationService,
    });

    await bridge.delivered({
      channel: "whatsapp",
      messageId: "wamid.done",
    });

    expect(markDelivered).toHaveBeenCalledTimes(1);
    expect(markDelivered.mock.calls[0]![0]).toMatchObject({
      channel: "whatsapp",
      messageId: "wamid.done",
    });
  });
});

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
    expect(conversationOpen).not.toHaveBeenCalled();
  });
});

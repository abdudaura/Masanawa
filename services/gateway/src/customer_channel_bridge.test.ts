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
  it("creates a canonical Masanawa customer on first WhatsApp contact and routes directly to Gwani", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const profile = {
      tenantId,
      userId,
      name: "WhatsApp customer",
      email: null,
      phone: "+2348012345678",
      locale: "ng",
      createdAt: "2026-10-07T00:00:00.000Z",
    };
    const createProfile = vi.fn(async () => profile);
    const issueSession = vi.fn(async () => undefined);
    const revokeAccess = vi.fn(async () => undefined);
    const sessions = {
      async resolveProfile() {
        return null;
      },
      createProfile,
      issueSession,
      revokeAccess,
    } as unknown as PlatformSessionRepository;

    let link: any = null;
    const channels = {
      async claimMessage() {
        return { state: "claimed" as const };
      },
      async readLink() {
        return null;
      },
      async putLink(value: unknown) {
        link = value;
      },
      async setCharacterSession(value: unknown) {
        link = { ...link, ...(value as object) };
      },
      async completeMessage() {},
      async failMessage() {},
    } as unknown as CustomerChannelRepository;

    const platformProfiles = {
      async listSupportAgents() {
        return [{
          characterId,
          supportAgent: true,
          defaultForNewUsers: true,
          voiceName: "Bodi",
        }];
      },
      async readForCharacter() {
        return {
          characterId,
          supportAgent: true,
          defaultForNewUsers: true,
          voiceName: "Bodi",
        };
      },
    } as unknown as PlatformAgentProfileRepository;

    const conversation = {
      async open() {
        return { characterSessionId: createCanonicalId("character-session") };
      },
      async turn() {
        return {
          reply: "Welcome to Masanawa. How can I help?",
          agentRunId: createCanonicalId("agent-run"),
          parts: [],
        };
      },
    } as unknown as AgentConversationService;

    const bridge = createCustomerChannelBridge({
      tenantId,
      sessions,
      channels,
      platformProfiles,
      conversation,
    });

    const result = await bridge.handle({
      channel: "whatsapp",
      messageId: "wamid.first",
      externalUserId: "+2348012345678",
      chatId: "2348012345678@s.whatsapp.net",
      phone: "+2348012345678",
      text: "Hello",
    });

    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      channel: "sms",
      identifier: "+2348012345678",
      name: "WhatsApp customer",
    }));
    expect(link).toMatchObject({
      channel: "whatsapp",
      externalUserId: "+2348012345678",
      userId,
      characterId,
    });
    expect(issueSession).toHaveBeenCalledTimes(1);
    expect(revokeAccess).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      handled: true,
      duplicate: false,
      reply: "Welcome to Masanawa. How can I help?",
      shouldDeliver: true,
    });
  });


  it("creates a canonical customer when Telegram supplies the sender's verified contact", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const profile = {
      tenantId,
      userId,
      name: "Telegram customer",
      email: null,
      phone: "+2348012345678",
      locale: "ng",
      createdAt: "2026-10-07T00:00:00.000Z",
    };
    const createProfile = vi.fn(async () => profile);
    const sessions = {
      async resolveProfile() { return null; },
      createProfile,
      async issueSession() {},
      async revokeAccess() {},
    } as unknown as PlatformSessionRepository;
    let link: any = null;
    const channels = {
      async claimMessage() { return { state: "claimed" as const }; },
      async readLink() { return null; },
      async putLink(value: unknown) { link = value; },
      async setCharacterSession(value: unknown) { link = { ...link, ...(value as object) }; },
      async completeMessage() {},
      async failMessage() {},
    } as unknown as CustomerChannelRepository;
    const platformProfiles = {
      async listSupportAgents() {
        return [{ characterId, supportAgent: true, defaultForNewUsers: true, voiceName: "Bodi" }];
      },
      async readForCharacter() {
        return { characterId, supportAgent: true, defaultForNewUsers: true, voiceName: "Bodi" };
      },
    } as unknown as PlatformAgentProfileRepository;
    const conversation = {
      async open() { return { characterSessionId: createCanonicalId("character-session") }; },
      async turn() {
        return { reply: "Connected.", agentRunId: createCanonicalId("agent-run"), parts: [] };
      },
    } as unknown as AgentConversationService;

    const bridge = createCustomerChannelBridge({
      tenantId,
      sessions,
      channels,
      platformProfiles,
      conversation,
    });

    const result = await bridge.handle({
      channel: "telegram",
      messageId: "12",
      externalUserId: "123",
      chatId: "123",
      phone: "+2348012345678",
      text: "Connect my Telegram account.",
    });

    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      identifier: "+2348012345678",
      name: "Telegram customer",
    }));
    expect(link).toMatchObject({ userId, characterId, channel: "telegram" });
    expect(result.reply).toBe("Connected.");
  });


  it("rejects a newly shared contact that resolves to a different account than the durable channel link", async () => {
    const tenantId = createCanonicalId("tenant");
    const linkedUserId = createCanonicalId("user");
    const otherUserId = createCanonicalId("user");
    const link = {
      tenantId,
      userId: linkedUserId,
      channel: "telegram" as const,
      externalUserId: "123",
      chatId: "123",
      characterId: createCanonicalId("character"),
      characterSessionId: null,
      updatedAt: "2026-10-09T00:00:00Z",
    };
    const issueSession = vi.fn(async () => undefined);
    const resolveProfile = vi.fn(async () => ({
      tenantId,
      userId: otherUserId,
      name: "Other customer",
      email: null,
      phone: "+2348012345678",
      locale: "ng",
      createdAt: "2026-10-08T00:00:00Z",
    }));
    const failMessage = vi.fn(async () => undefined);
    const conversationOpen = vi.fn();
    const bridge = createCustomerChannelBridge({
      tenantId,
      sessions: {
        resolveProfile,
        issueSession,
      } as unknown as PlatformSessionRepository,
      channels: {
        async claimMessage() { return { state: "claimed" as const }; },
        async readLink() { return link; },
        failMessage,
      } as unknown as CustomerChannelRepository,
      platformProfiles: {} as PlatformAgentProfileRepository,
      conversation: { open: conversationOpen } as unknown as AgentConversationService,
    });
    await expect(bridge.handle({
      channel: "telegram",
      externalUserId: "123",
      chatId: "123",
      messageId: "contact-cross-link",
      phone: "+2348012345678",
      text: "hello",
    })).rejects.toThrow("channels.link_identity_mismatch");
    expect(resolveProfile).toHaveBeenCalledTimes(1);
    expect(issueSession).not.toHaveBeenCalled();
    expect(conversationOpen).not.toHaveBeenCalled();
    expect(failMessage).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an earlier Telegram contact phone in later messages without phone evidence", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const link = {
      tenantId,
      userId,
      channel: "telegram" as const,
      externalUserId: "777",
      chatId: "777",
      characterId,
      characterSessionId: null,
      updatedAt: "2026-10-09T00:00:00Z",
    };
    const resolveProfile = vi.fn(async () => null);
    const issueSession = vi.fn(async (_input: unknown) => undefined);
    const bridge = createCustomerChannelBridge({
      tenantId,
      sessions: {
        resolveProfile,
        issueSession,
        async revokeAccess() {},
      } as unknown as PlatformSessionRepository,
      channels: {
        async claimMessage() { return { state: "claimed" as const }; },
        async readLink() { return link; },
        async setCharacterSession() {},
        async completeMessage() {},
        async failMessage() {},
      } as unknown as CustomerChannelRepository,
      platformProfiles: {
        async readForCharacter() { return { supportAgent: true }; },
      } as unknown as PlatformAgentProfileRepository,
      conversation: {
        async open() { return { characterSessionId: createCanonicalId("character-session") }; },
        async turn() { return { reply: "Ready", parts: [], agentRunId: createCanonicalId("agent-run") }; },
      } as unknown as AgentConversationService,
    });
    const base = {
      channel: "telegram" as const,
      externalUserId: "777",
      chatId: "777",
      text: "Hello",
    };
    const first = await bridge.handle({ ...base, messageId: "first", phone: "+2348012345678" });
    expect(first.reply).toBe("Ready");
    expect(resolveProfile).toHaveBeenCalledTimes(1);
    const second = await bridge.handle({ ...base, messageId: "second" });
    expect(second.reply).toBe("Ready");
    expect(resolveProfile).toHaveBeenCalledTimes(1);
    expect(issueSession).toHaveBeenCalledTimes(2);
    expect(issueSession.mock.calls[1]![0]).toMatchObject({
      identity: { tenantId, userId },
    });
  });

});

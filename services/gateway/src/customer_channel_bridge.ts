import {
  createCanonicalId,
  type CharacterId,
} from "@masanawa/contracts";
import type {
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import {
  hashPlatformSessionToken,
  mintPlatformSessionToken,
  normalizePlatformAuthIdentifier,
  type CustomerChannel,
  type CustomerChannelRepository,
  type PlatformAuthProfile,
  type PlatformSessionRepository,
} from "@masanawa/security";
import type { AgentConversationService } from "./agent_conversation_contract.js";

export interface CustomerChannelInbound {
  readonly channel: CustomerChannel;
  readonly messageId: string;
  readonly externalUserId: string;
  readonly chatId: string;
  readonly text: string;
  readonly phone?: string;
  readonly media?: Readonly<{
    mimeType: string;
    dataBase64: string;
    name?: string;
  }>;
}

export interface CustomerChannelResult {
  readonly handled: boolean;
  readonly duplicate: boolean;
  readonly reply: string | null;
  readonly requestContact: boolean;
}

function instant(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/gu, "");
  const international = compact.startsWith("+") ? compact : `+${compact}`;
  return normalizePlatformAuthIdentifier({ phone: international }).identifier;
}

export function createCustomerChannelBridge(input: Readonly<{
  tenantId: string;
  sessions: PlatformSessionRepository;
  channels: CustomerChannelRepository;
  platformProfiles: PlatformAgentProfileRepository;
  userPreferences?: UserAgentPreferenceRepository;
  conversation: AgentConversationService;
}>): Readonly<{
  handle(request: CustomerChannelInbound): Promise<CustomerChannelResult>;
}> {
  async function chooseCharacter(
    profile: PlatformAuthProfile,
  ): Promise<CharacterId> {
    const preference = await input.userPreferences?.readForUser({
      tenantId: profile.tenantId,
      userId: profile.userId,
    });
    if (preference) {
      const selected = await input.platformProfiles.readForCharacter({
        tenantId: profile.tenantId,
        characterId: preference.defaultPlatformCharacterId,
      });
      if (selected?.supportAgent) return selected.characterId;
    }
    const support = await input.platformProfiles.listSupportAgents({
      tenantId: profile.tenantId,
    });
    const preferred =
      support.find((agent) => agent.defaultForNewUsers) ??
      support.find((agent) => agent.voiceName.trim().toLowerCase() === "bodi") ??
      support[0];
    if (!preferred) throw new Error("channels.support_agent_unavailable");
    return preferred.characterId;
  }

  async function resolveOrLink(
    request: CustomerChannelInbound,
  ) {
    const existing = await input.channels.readLink({
      channel: request.channel,
      externalUserId: request.externalUserId,
    });
    if (existing) return existing;

    let phone: string | undefined;
    if (request.channel === "whatsapp") {
      phone = normalizePhone(request.phone ?? request.externalUserId);
    } else if (request.phone) {
      phone = normalizePhone(request.phone);
    }
    if (!phone) return null;

    const profile = await input.sessions.resolveProfile({
      tenantId: input.tenantId as never,
      channel: "sms",
      identifier: phone,
      observedAt: instant(),
    });
    if (!profile) return null;
    const characterId = await chooseCharacter(profile);
    const link = Object.freeze({
      channel: request.channel,
      externalUserId: request.externalUserId,
      chatId: request.chatId,
      tenantId: profile.tenantId,
      userId: profile.userId,
      characterId,
      characterSessionId: null,
      updatedAt: instant(),
    });
    await input.channels.putLink(link);
    return link;
  }

  async function withInternalSession<T>(
    link: NonNullable<Awaited<ReturnType<typeof resolveOrLink>>>,
    run: (authorizationHeader: string) => Promise<T>,
  ): Promise<T> {
    const profile = await input.sessions.resolveProfile({
      tenantId: link.tenantId,
      channel: "sms",
      identifier:
        requestPhoneCache.get(`${link.channel}:${link.externalUserId}`) ?? "",
      observedAt: instant(),
    }).catch(() => null);

    // Channel links are already foreign-keyed to an existing platform profile.
    // Resolve the durable profile directly from the link when a phone lookup is
    // unavailable by using a tiny synthetic identity only for issuing this
    // short-lived internal access session.
    const identity = profile
      ? { tenantId: profile.tenantId, userId: profile.userId, profile }
      : {
          tenantId: link.tenantId,
          userId: link.userId,
          profile: {
            tenantId: link.tenantId,
            userId: link.userId,
            name: "Masanawa customer",
            email: null,
            phone: null,
            locale: "ng",
            createdAt: instant(),
          },
        };

    const accessToken = mintPlatformSessionToken("access");
    const refreshToken = mintPlatformSessionToken("refresh");
    const issuedAt = instant();
    await input.sessions.issueSession({
      identity: identity as never,
      accessHash: hashPlatformSessionToken(accessToken),
      refreshHash: hashPlatformSessionToken(refreshToken),
      accessExpiresAt: instant(5 * 60 * 1000),
      refreshExpiresAt: instant(10 * 60 * 1000),
      issuedAt,
    });
    try {
      return await run(`Bearer ${accessToken}`);
    } finally {
      await input.sessions.revokeAccess({
        accessHash: hashPlatformSessionToken(accessToken),
        revokedAt: instant(),
      }).catch(() => undefined);
    }
  }

  const requestPhoneCache = new Map<string, string>();

  return Object.freeze({
    async handle(request) {
      const messageId = request.messageId.trim();
      const externalUserId = request.externalUserId.trim();
      const chatId = request.chatId.trim();
      if (!messageId || !externalUserId || !chatId) {
        throw new TypeError("channels.inbound_invalid");
      }
      if (request.phone) {
        requestPhoneCache.set(
          `${request.channel}:${externalUserId}`,
          normalizePhone(request.phone),
        );
      } else if (request.channel === "whatsapp") {
        requestPhoneCache.set(
          `${request.channel}:${externalUserId}`,
          normalizePhone(externalUserId),
        );
      }

      const claim = await input.channels.claimMessage({
        channel: request.channel,
        messageId,
        externalUserId,
        receivedAt: instant(),
      });
      if (claim.state !== "claimed") {
        return Object.freeze({
          handled: true,
          duplicate: true,
          reply: claim.state === "completed" ? claim.reply : null,
          requestContact: false,
        });
      }

      try {
        const link = await resolveOrLink(request);
        if (!link) {
          const reply = request.channel === "telegram"
            ? "To connect Telegram securely, share the same phone number you use for your Masanawa account."
            : "Sign in to Masanawa with this WhatsApp phone number first, then message me again.";
          await input.channels.completeMessage({
            channel: request.channel,
            messageId,
            reply,
            completedAt: instant(),
          });
          return Object.freeze({
            handled: true,
            duplicate: false,
            reply,
            requestContact: request.channel === "telegram",
          });
        }

        const requestId = createCanonicalId("request");
        const correlationId = createCanonicalId("correlation");

        const result = await withInternalSession(link, async (authorizationHeader) => {
          let characterSessionId = link.characterSessionId;
          const open = async () => {
            const created = await input.conversation.open({
              authorizationHeader,
              characterId: link.characterId,
            });
            characterSessionId = created.characterSessionId;
            await input.channels.setCharacterSession({
              channel: link.channel,
              externalUserId: link.externalUserId,
              characterId: link.characterId,
              characterSessionId,
              updatedAt: instant(),
            });
          };
          if (!characterSessionId) await open();

          const turn = async () => {
            if (!characterSessionId) throw new Error("channels.session_missing");
            if (request.media) {
              return input.conversation.mediaTurn({
                authorizationHeader,
                characterSessionId,
                characterId: link.characterId,
                caption: request.text,
                mimeType: request.media.mimeType,
                dataBase64: request.media.dataBase64,
                requestId,
                correlationId,
              });
            }
            return input.conversation.turn({
              authorizationHeader,
              characterSessionId,
              characterId: link.characterId,
              text: request.text,
              requestId,
              correlationId,
            });
          };

          try {
            return await turn();
          } catch {
            await open();
            return turn();
          }
        });

        await input.channels.completeMessage({
          channel: request.channel,
          messageId,
          reply: result.reply,
          completedAt: instant(),
        });
        return Object.freeze({
          handled: true,
          duplicate: false,
          reply: result.reply,
          requestContact: false,
        });
      } catch (error) {
        await input.channels.failMessage({
          channel: request.channel,
          messageId,
          failedAt: instant(),
        }).catch(() => undefined);
        throw error;
      }
    },
  });
}

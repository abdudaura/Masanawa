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
  type PlatformSessionRepository,
} from "@masanawa/security";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import type {
  PublicTwinDirectoryItem,
  TwinDirectoryService,
} from "./twin_directory.js";

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
  readonly shouldDeliver: boolean;
}

export interface CustomerChannelBridge {
  handle(request: CustomerChannelInbound): Promise<CustomerChannelResult>;
  delivered(input: Readonly<{
    channel: CustomerChannel;
    messageId: string;
  }>): Promise<void>;
}

function instant(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}


function recoverableSessionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "agents.session_not_found" || code === "agents.session_closed";
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
  twinDirectory?: TwinDirectoryService;
}>): Readonly<{
  handle(request: CustomerChannelInbound): Promise<CustomerChannelResult>;
  delivered(input: Readonly<{
    channel: CustomerChannel;
    messageId: string;
  }>): Promise<void>;
}> {
  async function chooseCharacter(
    identity: Readonly<{ tenantId: string; userId: string }>,
    requested?: "gwani" | "gwana",
  ): Promise<CharacterId> {
    const support = await input.platformProfiles.listSupportAgents({
      tenantId: identity.tenantId as never,
    });
    if (requested) {
      const voice = requested === "gwana" ? "sulafat" : "bodi";
      const named = support.find(
        (agent) => agent.voiceName.trim().toLowerCase() === voice,
      );
      if (named) return named.characterId;
    }
    const preference = await input.userPreferences?.readForUser({
      tenantId: identity.tenantId as never,
      userId: identity.userId as never,
    });
    if (preference) {
      const selected = await input.platformProfiles.readForCharacter({
        tenantId: identity.tenantId as never,
        characterId: preference.defaultPlatformCharacterId,
      });
      if (selected?.supportAgent) return selected.characterId;
    }
    const preferred =
      support.find((agent) => agent.defaultForNewUsers) ??
      support.find((agent) => agent.voiceName.trim().toLowerCase() === "bodi") ??
      support[0];
    if (!preferred) throw new Error("channels.support_agent_unavailable");
    return preferred.characterId;
  }

  type ChannelNavigation =
    | Readonly<{ kind: "support"; requested?: "gwani" | "gwana" }>
    | Readonly<{ kind: "twin"; query: string }>;

  function navigationIntent(text: string): ChannelNavigation | null {
    const value = text.trim().replace(/\s+/gu, " ");
    if (!value || value.length > 240) return null;
    const lower = value.toLowerCase();
    if (
      /^(?:go\s+)?back\s+to\s+(?:gwani|masanawa|support)[.!?]?$/iu.test(value) ||
      /^(?:talk|chat|switch)(?:\s+me)?\s+(?:to|with)\s+gwani[.!?]?$/iu.test(value)
    ) {
      return Object.freeze({ kind: "support", requested: "gwani" as const });
    }
    if (
      /^(?:talk|chat|switch)(?:\s+me)?\s+(?:to|with)\s+gwana[.!?]?$/iu.test(value)
    ) {
      return Object.freeze({ kind: "support", requested: "gwana" as const });
    }
    if (/^(?:go\s+)?back\s+to\s+(?:my\s+)?(?:assistant|agent)[.!?]?$/iu.test(value)) {
      return Object.freeze({ kind: "support" });
    }

    const url = /\/twin\/([a-z0-9][a-z0-9_-]{2,63})/iu.exec(value);
    if (url?.[1]) return Object.freeze({ kind: "twin", query: url[1] });

    const patterns = [
      /^(?:talk|chat|switch)(?:\s+me)?\s+(?:to|with)\s+(.+?)(?:['’]s)?\s+twin[.!?]?$/iu,
      /^(?:talk|chat|switch)(?:\s+me)?\s+(?:to|with)\s+(?:the\s+)?twin\s+(?:of\s+)?(.+?)[.!?]?$/iu,
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(value);
      const query = match?.[1]?.trim();
      if (query && !["gwani","gwana","masanawa","support"].includes(query.toLowerCase())) {
        return Object.freeze({ kind: "twin", query });
      }
    }
    if (lower.startsWith("@") && /^[a-z0-9@_-]{4,65}$/iu.test(lower)) {
      return Object.freeze({ kind: "twin", query: value.slice(1) });
    }
    return null;
  }

  function normalizeLookup(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
  }

  function chooseTwin(
    query: string,
    candidates: readonly PublicTwinDirectoryItem[],
  ): PublicTwinDirectoryItem | null {
    const wanted = normalizeLookup(query);
    const exact = candidates.filter(
      (item) =>
        normalizeLookup(item.displayName) === wanted ||
        normalizeLookup(item.publicId) === wanted,
    );
    if (exact.length === 1) return exact[0]!;
    return candidates.length === 1 ? candidates[0]! : null;
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

    let profile = await input.sessions.resolveProfile({
      tenantId: input.tenantId as never,
      channel: "sms",
      identifier: phone,
      observedAt: instant(),
    });

    // A direct WhatsApp sender has already proven control of this phone number
    // to the linked WhatsApp account. Treat WhatsApp as a first-class Masanawa
    // signup surface instead of forcing the customer to install the mobile app
    // before Gwani can help them.
    if (
      !profile &&
      (request.channel === "whatsapp" ||
        (request.channel === "telegram" && request.phone))
    ) {
      try {
        profile = await input.sessions.createProfile({
          tenantId: input.tenantId as never,
          channel: "sms",
          identifier: phone,
          name:
            request.channel === "whatsapp"
              ? "WhatsApp customer"
              : "Telegram customer",
          locale: "ng",
          createdAt: instant(),
        });
      } catch {
        // Concurrent first messages may race profile creation. Resolve the
        // canonical row once more and only fail closed if it still does not exist.
        profile = await input.sessions.resolveProfile({
          tenantId: input.tenantId as never,
          channel: "sms",
          identifier: phone,
          observedAt: instant(),
        });
      }
    }
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
    phoneForRequest?: string,
  ): Promise<T> {
    // Resolve a phone only from this authenticated provider message. Never
    // retain PII in process memory or reuse another message's contact value.
    const profile = phoneForRequest
      ? await input.sessions.resolveProfile({
          tenantId: link.tenantId,
          channel: "sms",
          identifier: phoneForRequest,
          observedAt: instant(),
        }).catch(() => null)
      : null;

    // The durable channel link, not a subsequently shared phone number, owns
    // the principal. Refuse a contact pointing at somebody else's account.
    if (profile && (profile.tenantId !== link.tenantId || profile.userId !== link.userId)) {
      throw new Error("channels.link_identity_mismatch");
    }

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

  return Object.freeze({
    async handle(request) {
      const messageId = request.messageId.trim();
      const externalUserId = request.externalUserId.trim();
      const chatId = request.chatId.trim();
      if (!messageId || !externalUserId || !chatId) {
        throw new TypeError("channels.inbound_invalid");
      }
      const phoneForRequest = request.phone
        ? normalizePhone(request.phone)
        : request.channel === "whatsapp"
          ? normalizePhone(externalUserId)
          : undefined;

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
          reply:
            claim.state === "completed" || claim.state === "delivered"
              ? claim.reply
              : null,
          requestContact:
            request.channel === "telegram" &&
            claim.state === "completed" &&
            claim.reply ===
              "To connect Telegram securely, share the same phone number you use for your Masanawa account.",
          shouldDeliver: claim.state === "completed" && claim.reply !== null,
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
            shouldDeliver: true,
          });
        }

        const navigation = request.media ? null : navigationIntent(request.text);
        if (navigation) {
          const navigationReply = await withInternalSession(
            link,
            async (authorizationHeader) => {
              if (navigation.kind === "support") {
                if (link.characterSessionId) {
                  await input.conversation.close({
                    authorizationHeader,
                    characterSessionId: link.characterSessionId,
                    characterId: link.characterId,
                  }).catch(() => undefined);
                }
                const characterId = await chooseCharacter(
                  { tenantId: link.tenantId, userId: link.userId },
                  navigation.requested,
                );
                await input.channels.putLink({
                  ...link,
                  characterId,
                  characterSessionId: null,
                  updatedAt: instant(),
                });
                const label =
                  navigation.requested === "gwana"
                    ? "Gwana"
                    : navigation.requested === "gwani"
                      ? "Gwani"
                      : "your Masanawa assistant";
                return `You're back with ${label}. How can I help?`;
              }

              if (!input.twinDirectory) {
                return "Public Twin chat is not available on this channel right now.";
              }
              let selected: PublicTwinDirectoryItem | null = null;
              if (/^[a-z0-9][a-z0-9_-]{2,63}$/iu.test(navigation.query)) {
                selected = await input.twinDirectory.resolve({
                  authorizationHeader,
                  publicId: navigation.query,
                }).catch(() => null);
              }
              const candidates = selected
                ? [selected]
                : await input.twinDirectory.search({
                    authorizationHeader,
                    query: navigation.query,
                    limit: 8,
                  });
              selected ??= chooseTwin(navigation.query, candidates);
              if (!selected) {
                if (candidates.length === 0) {
                  return `I couldn't find a public Twin matching "${navigation.query}". Try the person's Twin name or share link.`;
                }
                const choices = candidates
                  .slice(0, 5)
                  .map((item, index) => `${index + 1}. ${item.displayName} (@${item.publicId})`)
                  .join("\n");
                return `I found several public Twins. Tell me the name or @ID you want:\n${choices}`;
              }
              if (link.characterSessionId) {
                await input.conversation.close({
                  authorizationHeader,
                  characterSessionId: link.characterSessionId,
                  characterId: link.characterId,
                }).catch(() => undefined);
              }
              await input.channels.putLink({
                ...link,
                characterId: selected.characterId as never,
                characterSessionId: null,
                updatedAt: instant(),
              });
              return `You're now chatting with ${selected.displayName}'s AI Twin. Text chat here is free. The real owner is not present.\n\nSend your message, or say "back to Gwani" anytime.`;
            },
            phoneForRequest,
          );
          await input.channels.completeMessage({
            channel: request.channel,
            messageId,
            reply: navigationReply,
            completedAt: instant(),
          });
          return Object.freeze({
            handled: true,
            duplicate: false,
            reply: navigationReply,
            requestContact: false,
            shouldDeliver: true,
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
            const activeProfile = await input.platformProfiles.readForCharacter({
              tenantId: link.tenantId,
              characterId: link.characterId,
            });
            const representation =
              activeProfile?.supportAgent === true
                ? ("platform-agent" as const)
                : ("public-twin" as const);
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
                surface: request.channel,
                representation,
              });
            }
            return input.conversation.turn({
              authorizationHeader,
              characterSessionId,
              characterId: link.characterId,
              text: request.text,
              requestId,
              correlationId,
              surface: request.channel,
              representation,
            });
          };

          try {
            return await turn();
          } catch (error) {
            if (!recoverableSessionFailure(error)) throw error;
            await open();
            return turn();
          }
        }, phoneForRequest);

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
          shouldDeliver: true,
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

    async delivered(delivery) {
      await input.channels.markDelivered({
        channel: delivery.channel,
        messageId: delivery.messageId,
        deliveredAt: instant(),
      });
    },
  });
}

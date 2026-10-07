import {
  parseCanonicalId,
  type CharacterId,
  type CharacterSessionId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type CustomerChannel = "whatsapp" | "telegram";

export interface CustomerChannelLink {
  readonly channel: CustomerChannel;
  readonly externalUserId: string;
  readonly chatId: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly characterSessionId: CharacterSessionId | null;
  readonly updatedAt: string;
}

export interface CustomerChannelMessageClaim {
  readonly state: "claimed" | "completed" | "processing";
  readonly reply: string | null;
}

export interface CustomerChannelRepository {
  readLink(input: Readonly<{
    channel: CustomerChannel;
    externalUserId: string;
  }>): Promise<CustomerChannelLink | null>;

  putLink(link: CustomerChannelLink): Promise<void>;

  setCharacterSession(input: Readonly<{
    channel: CustomerChannel;
    externalUserId: string;
    characterId: CharacterId;
    characterSessionId: CharacterSessionId;
    updatedAt: string;
  }>): Promise<void>;

  claimMessage(input: Readonly<{
    channel: CustomerChannel;
    messageId: string;
    externalUserId: string;
    receivedAt: string;
  }>): Promise<CustomerChannelMessageClaim>;

  completeMessage(input: Readonly<{
    channel: CustomerChannel;
    messageId: string;
    reply: string;
    completedAt: string;
  }>): Promise<void>;

  failMessage(input: Readonly<{
    channel: CustomerChannel;
    messageId: string;
    failedAt: string;
  }>): Promise<void>;
}

export function normalizeCustomerChannelLink(
  input: CustomerChannelLink,
): CustomerChannelLink {
  const externalUserId = input.externalUserId.trim();
  const chatId = input.chatId.trim();
  if (!externalUserId || externalUserId.length > 256) {
    throw new TypeError("channel.external_user_invalid");
  }
  if (!chatId || chatId.length > 256) {
    throw new TypeError("channel.chat_invalid");
  }
  return Object.freeze({
    channel: input.channel,
    externalUserId,
    chatId,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    characterSessionId:
      input.characterSessionId === null
        ? null
        : parseCanonicalId("character-session", input.characterSessionId),
    updatedAt: input.updatedAt,
  });
}

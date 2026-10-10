import { createHash, randomBytes } from "node:crypto";
import type { CustomerChannel } from "@masanawa/security";

export type LinkChannel = CustomerChannel;
export type LinkIdentity = Readonly<{ tenantId: string; userId: string }>;
export type LinkState = Readonly<{
  channel: LinkChannel;
  linked: boolean;
  preferred: boolean;
  linkedAt: string | null;
  pendingUntil: string | null;
}>;
export type VerifiedProviderSender = Readonly<{
  /** Only constructed *after* R15's webhook signature/private-chat checks. */
  channel: LinkChannel;
  externalUserId: string;
  chatId: string;
  text: string;
  messageId: string;
}>;
export type LinkErrorCode =
  | "UNAUTHORIZED" | "INVALID_CHANNEL" | "LINK_COOLDOWN" | "LINK_RATE_LIMITED"
  | "LINK_NOT_FOUND" | "LINK_EXPIRED" | "LINK_CONFLICT"
  | "CHANNEL_UNAVAILABLE" | "CHANNEL_STORAGE_UNAVAILABLE";

export class LinkError extends Error {
  constructor(readonly code: LinkErrorCode, readonly status: number) {
    super(code);
    this.name = "LinkError";
  }
}

export interface LinkRepository {
  resolveChallengeOwner(channel: LinkChannel, hash: string, at: Date): Promise<LinkIdentity | null>;
  list(owner: LinkIdentity, now: Date): Promise<readonly LinkState[]>;
  begin(input: Readonly<{
    owner: LinkIdentity; channel: LinkChannel; codeHash: string;
    now: Date; expiresAt: Date;
  }>): Promise<void>;
  /** Atomic code consume + owner lock + canonical link create; no account replacement. */
  confirm(input: Readonly<{
    channel: LinkChannel; codeHash: string; externalUserId: string;
    chatId: string; characterId: string; at: Date;
  }>): Promise<boolean>;
  unlink(owner: LinkIdentity, channel: LinkChannel, at: Date): Promise<void>;
  setPreferred(owner: LinkIdentity, channel: LinkChannel, at: Date): Promise<void>;
}

export function parseLinkChannel(raw: unknown): LinkChannel {
  if (raw === "whatsapp" || raw === "telegram") return raw;
  throw new LinkError("INVALID_CHANNEL", 400);
}

const codePattern = /^MN-[A-F0-9]{24}$/u;
const codeHash = (code: string): string =>
  createHash("sha256").update("masanawa.channel-link.v1:").update(code).digest("hex");

export interface LinkingService {
  status(owner: LinkIdentity): Promise<readonly LinkState[]>;
  begin(owner: LinkIdentity, channel: LinkChannel): Promise<Readonly<{
    code: string; expiresAt: string; destination: string | null;
  }>>;
  unlink(owner: LinkIdentity, channel: LinkChannel): Promise<void>;
  prefer(owner: LinkIdentity, channel: LinkChannel): Promise<void>;
  /** NOT an HTTP route. Only invoke after cryptographically authenticated provider ingress. */
  consumeVerifiedInbound(sender: VerifiedProviderSender): Promise<boolean>;
}

export function createLinkingService(input: Readonly<{
  repository: LinkRepository;
  /** Server-owned provider deployment availability, never client-provided. */
  destinations: Partial<Record<LinkChannel, string>>;
  /** Resolve configured default agent at verification time (not from a user body). */
  resolveDefaultCharacter: (owner: LinkIdentity) => Promise<string>;
  now?: () => Date;
}>): LinkingService {
  const now = input.now ?? (() => new Date());
  const destination = (channel: LinkChannel): string | null => {
    const value = input.destinations[channel];
    if (!value) return null;
    const uri = new URL(value);
    const safeAuthority = !uri.username && !uri.password && !uri.port;
    const valid = safeAuthority && (channel === "telegram"
      ? uri.protocol === "https:" && uri.hostname === "t.me"
        && /^\/[a-zA-Z0-9_]{5,32}$/u.test(uri.pathname) && !uri.search && !uri.hash
      : uri.protocol === "https:" && uri.hostname === "wa.me"
        && /^\/[1-9][0-9]{6,14}$/u.test(uri.pathname) && !uri.search && !uri.hash);
    if (!valid) throw new LinkError("CHANNEL_UNAVAILABLE", 503);
    return value;
  };
  return Object.freeze({
    status: (owner) => input.repository.list(owner, now()),
    async begin(owner, channel) {
      const to = destination(channel);
      if (!to) throw new LinkError("CHANNEL_UNAVAILABLE", 503);
      // 96 bits entropy, valid only five minutes, never logged or stored in plaintext.
      const code = "MN-" + randomBytes(12).toString("hex").toUpperCase();
      const at = now();
      const expiresAt = new Date(at.getTime() + 5 * 60_000);
      await input.repository.begin({
        owner, channel, codeHash: codeHash(code), now: at, expiresAt,
      });
      return Object.freeze({ code, expiresAt: expiresAt.toISOString(), destination: to });
    },
    unlink: (owner, channel) => input.repository.unlink(owner, channel, now()),
    prefer: (owner, channel) => input.repository.setPreferred(owner, channel, now()),
    async consumeVerifiedInbound(sender) {
      if (!/^[a-zA-Z0-9:_+.-]{1,256}$/u.test(sender.externalUserId) ||
          !/^[a-zA-Z0-9:_+@.-]{1,256}$/u.test(sender.chatId) ||
          !/^[a-zA-Z0-9:_+.-]{1,512}$/u.test(sender.messageId)) return false;
      const code = sender.text.trim().toUpperCase();
      if (!codePattern.test(code)) return false;
      // Only provider-authenticated sender identity is passed here. Code alone
      // is never accepted from an app request, unauthenticated webhook or LLM.
      const at = now();
      const hash = codeHash(code);
      const owner = await input.repository.resolveChallengeOwner(sender.channel, hash, at);
      if (!owner) return false; // Not a current link code; normal assistant ingress may continue.
      const characterId = await input.resolveDefaultCharacter(owner);
      return input.repository.confirm({
        channel: sender.channel,
        codeHash: hash,
        externalUserId: sender.externalUserId,
        chatId: sender.chatId,
        characterId,
        at,
      });
    },
  });
}

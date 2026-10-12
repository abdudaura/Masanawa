/** Social identity boundary. Public links and automation permissions are separate. */
export const providers = ["whatsapp", "telegram", "instagram", "facebook", "youtube", "tiktok", "x"] as const;
export type SocialProvider = typeof providers[number];
export type ConnectionMode = "disabled" | "profile_link_only" | "manual_operator" | "verified_automation_eligible";
export type PublishState = "draft" | "published" | "revoked";
export interface SocialIdentity {
  readonly identityId: string;
  readonly tenantId: string;
  readonly characterId: string;
  readonly provider: SocialProvider;
  readonly providerAccountId: string;
  readonly handle: string;
  readonly publicUrl: string;
  readonly verifiedAt: string | null;
  readonly publishState: PublishState;
  readonly mode: ConnectionMode;
  readonly paused: boolean;
  readonly revision: number;
}
export interface PublicSocialLink {
  readonly provider: SocialProvider;
  readonly handle: string;
  readonly publicUrl: string;
  readonly mode: "profile_link_only" | "manual_operator" | "verified_automation_eligible";
  readonly availability: "link_only" | "manual_operator" | "available";
}
const hosts: Record<Exclude<SocialProvider,"whatsapp">,readonly string[]> = {
  telegram: ["t.me", "telegram.me"], instagram:["instagram.com","www.instagram.com"],
  facebook:["facebook.com","www.facebook.com","m.facebook.com"],
  youtube:["youtube.com","www.youtube.com","youtu.be"],
  tiktok:["tiktok.com","www.tiktok.com"], x:["x.com","www.x.com","twitter.com","www.twitter.com"],
};
export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === "string" && (providers as readonly string[]).includes(value);
}
export class SocialPolicyError extends Error {
  constructor(readonly code: "invalid_social_identity" | "not_verified" | "automation_not_permitted" | "stale_revision", message: string) {
    super(message);
  }
}
export function approvedPublicUrl(provider: SocialProvider, accountId: string, input: string): string {
  if (!accountId || accountId.length > 160 || !input || input.length > 400) {
    throw new SocialPolicyError("invalid_social_identity", "Invalid account or URL");
  }
  if (provider === "whatsapp") {
    if (!/^[1-9][0-9]{7,14}$/.test(accountId)) {
      throw new SocialPolicyError("invalid_social_identity", "WhatsApp must use verified international digits");
    }
    if (input !== "https://wa.me/" + accountId) {
      throw new SocialPolicyError("invalid_social_identity", "Only the official wa.me number is allowed");
    }
    return input;
  }
  let url: URL;
  try { url = new URL(input); } catch {
    throw new SocialPolicyError("invalid_social_identity", "Malformed social URL");
  }
  if (url.protocol !== "https:" || !!url.username || !!url.password || !!url.port ||
      !hosts[provider].includes(url.hostname.toLowerCase()) ||
      !!url.hash || !!url.search || /%2f|%5c|\\|\.{2}/i.test(url.pathname)) {
    throw new SocialPolicyError("invalid_social_identity", "External link must be an approved canonical HTTPS URL");
  }
  if (url.pathname.length < 2 || url.pathname === "/" || url.pathname.includes("//")) {
    throw new SocialPolicyError("invalid_social_identity", "A provider account path is required");
  }
  // Never follow redirects or accept arbitrary external domains from a client.
  return url.href;
}
export function publicLink(identity: SocialIdentity): PublicSocialLink | null {
  if (!identity.verifiedAt || identity.publishState !== "published" || identity.paused ||
      identity.mode === "disabled") return null;
  try {
    const url = approvedPublicUrl(identity.provider, identity.providerAccountId, identity.publicUrl);
    return {
      provider: identity.provider, handle: identity.handle, publicUrl: url,
      mode: identity.provider === "whatsapp" ? "profile_link_only" : identity.mode,
      availability: identity.provider === "whatsapp" ? "link_only" :
        identity.mode === "verified_automation_eligible" ? "available" :
        identity.mode === "manual_operator" ? "manual_operator" : "link_only",
    };
  } catch { return null; }
}
export interface DeliveryPermission {
  readonly provider: SocialProvider;
  readonly mode: ConnectionMode;
  readonly paused: boolean;
  readonly verifiedAt: string | null;
  readonly authorizationRef: string | null;
  readonly authorizationExpiresAt: string | null;
  readonly permittedActions: readonly string[];
  readonly fanConsented: boolean;
}
export function canDeliver(permission: DeliveryPermission, action: string, now: Date): boolean {
  // Official personal WhatsApp devices have no public message automation API.
  if (permission.provider === "whatsapp" || !permission.fanConsented ||
      permission.paused || !permission.verifiedAt ||
      permission.mode !== "verified_automation_eligible" ||
      !permission.authorizationRef || !permission.authorizationExpiresAt ||
      !permission.permittedActions.includes(action)) return false;
  const expiry = Date.parse(permission.authorizationExpiresAt);
  return Number.isFinite(expiry) && expiry > now.getTime();
}

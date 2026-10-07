import type {
  TalkSafetyCustomerAuthorizer,
  TalkSafetyPlatformAuthority,
} from "./service.js";

export function createPrincipalTalkSafetyPlatformAuthority(input: Readonly<{
  sessions: TalkSafetyCustomerAuthorizer;
  adminPrincipals: ReadonlySet<string>;
}>): TalkSafetyPlatformAuthority {
  return Object.freeze({
    async authorize(request) {
      const identity = await input.sessions.authorize(request);
      const candidates = [
        identity.userId,
        identity.profile.email?.trim().toLowerCase() ?? "",
        identity.profile.phone?.trim() ?? "",
      ].filter(Boolean);

      if (!candidates.some((candidate) => input.adminPrincipals.has(candidate))) {
        throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
      }

      return Object.freeze({
        tenantId: identity.tenantId,
        actorId: identity.userId,
      });
    },
  });
}

import { CustomerAuthError, type PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import type { TalkSafetyPlatformAuthority } from "./service.js";

export function parseTalkSafetyAdminUserIds(
  value: string | undefined,
): readonly string[] {
  if (!value?.trim()) return Object.freeze([]);
  const ids = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const id of ids) {
    if (id.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/u.test(id)) {
      throw new TypeError("MASANAWA_TALK_SAFETY_ADMIN_USER_IDS is invalid");
    }
  }
  return Object.freeze([...new Set(ids)].sort());
}

export function createTalkSafetyPlatformAuthority(input: Readonly<{
  sessions: PlatformCustomerSessionAuthorizer;
  allowedUserIds: readonly string[];
}>): TalkSafetyPlatformAuthority {
  const allowed = new Set(input.allowedUserIds);
  return Object.freeze({
    async authorize(request) {
      const identity = await input.sessions.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      if (!allowed.has(identity.userId)) {
        throw new CustomerAuthError("FORBIDDEN", 403);
      }
      return Object.freeze({
        tenantId: identity.tenantId,
        actorId: identity.userId,
      });
    },
  });
}

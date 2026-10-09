import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import type { TalkProfileService } from "../talk_profiles/service.js";
import { inviteUrl, issueInviteToken, readInviteToken } from "./token.js";

export class InviteServiceError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "InviteServiceError";
  }
}

/** Implement with C01/R15 canonical owner visibility, never a client flag. */
export interface InvitePrivacyAuthority {
  mayShare(input: Readonly<{ tenantId: string; userId: string; handle: string }>): Promise<boolean>;
  mayResolve(input: Readonly<{ tenantId: string; userId: string; handle: string }>): Promise<boolean>;
}
export interface InvitationQuota {
  consume(input: Readonly<{ tenantId: string; userId: string; now: Date }>): Promise<boolean>;
}
export interface InvitationService {
  create(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<Readonly<{
    url: string; expiresAt: string;
  }>>;
  resolve(token: string): Promise<Readonly<{ suggestedHandle: string }>>;
}

export function createInvitationService(input: Readonly<{
  authorizer: PlatformCustomerSessionAuthorizer;
  profiles: TalkProfileService;
  privacy: InvitePrivacyAuthority;
  quota: InvitationQuota;
  secret: string;
  now?: () => Date;
}>): InvitationService {
  if (Buffer.byteLength(input.secret, "utf8") < 32) {
    throw new TypeError("Invitations disabled: no valid signing secret");
  }
  const now = input.now ?? (() => new Date());
  return {
    async create(request) {
      const identity = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      // Resolve owner handle via the canonical authenticated profile service.
      const profile = await input.profiles.self({
        authorizationHeader: request.authorizationHeader,
      });
      const subject = {
        tenantId: String(identity.tenantId),
        userId: String(identity.userId),
        handle: profile.handle,
      };
      if (!await input.privacy.mayShare(subject)) {
        throw new InviteServiceError("INVITE_NOT_AVAILABLE", 403);
      }
      const createdAt = now();
      if (!Number.isFinite(createdAt.getTime())) throw new TypeError("Invalid clock");
      if (!await input.quota.consume({
        tenantId: subject.tenantId, userId: subject.userId, now: createdAt,
      })) throw new InviteServiceError("INVITE_RATE_LIMITED", 429);
      const nowSeconds = Math.floor(createdAt.getTime() / 1000);
      return {
        url: inviteUrl(issueInviteToken({
          ...subject, secret: input.secret,
          nowSeconds, ttlSeconds: 86400,
        })),
        expiresAt: new Date((nowSeconds + 86400) * 1000).toISOString(),
      };
    },
    async resolve(token) {
      const claims = readInviteToken({
        secret: input.secret, token,
        nowSeconds: Math.floor(now().getTime() / 1000),
      });
      if (!claims || !await input.privacy.mayResolve({
        tenantId: claims.tenantId,
        userId: claims.userId,
        handle: claims.handle,
      })) {
        throw new InviteServiceError("INVITE_UNAVAILABLE", 404);
      }
      // Not contact consent, payment attribution, or proof of current identity.
      return { suggestedHandle: claims.handle };
    },
  };
}


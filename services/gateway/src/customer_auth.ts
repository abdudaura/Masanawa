import {
  createOtpCode,
  hashOtpCode,
  hashPlatformSessionToken,
  mintPlatformSessionToken,
  normalizePlatformAuthIdentifier,
  createAuthorityContext,
  type PlatformAuthChannel,
  type PlatformAuthProfile,
  type PlatformSessionIdentity,
  type PlatformSessionRepository,
} from "@masanawa/security";
import {
  createCanonicalId,
  nowInstant,
  parseCanonicalId,
  type CharacterId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import type {
  UserRelationshipProvisioner,
  UserRelationshipReader,
} from "@masanawa/identity";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type { AgentDirectoryAuthorizer } from "./agent_directory.js";
import type { CreatorCloneAuthorizer } from "./creator_clone.js";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";

export class CustomerAuthError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, statusCode: number) {
    super(code);
    this.name = "CustomerAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface OtpDelivery {
  send(input: Readonly<{ identifier: string; code: string }>): Promise<void>;
}

export interface PlatformCustomerSessionAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export interface PlatformFinancialAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<Readonly<{ tenantId: TenantId; userId: UserId }>>;
}

export interface CustomerAuthService {
  capabilities(): Readonly<{
    otpChannels: readonly PlatformAuthChannel[];
  }>;
  sendOtp(input: Readonly<{ phone?: string; email?: string }>): Promise<Readonly<{
    phone?: string;
    email?: string;
    resendInSeconds: number;
  }>>;
  verifyOtp(input: Readonly<{
    phone?: string;
    email?: string;
    code: string;
    name?: string;
  }>): Promise<AuthTokensView>;
  refresh(input: Readonly<{ refreshToken: string }>): Promise<AuthTokensView>;
  logout(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<void>;
}

export interface AuthUserView {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly locale: string;
  readonly status: "ACTIVE";
  readonly role: "CITIZEN";
  readonly isNewUser: boolean;
  readonly communityId: null;
  readonly stateId: null;
  readonly createdAt: string;
}

export interface AuthTokensView {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresIn: number;
  readonly user: AuthUserView;
}

function authUser(profile: PlatformAuthProfile, isNewUser: boolean): AuthUserView {
  return Object.freeze({
    id: profile.userId,
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    locale: profile.locale,
    status: "ACTIVE" as const,
    role: "CITIZEN" as const,
    isNewUser,
    communityId: null,
    stateId: null,
    createdAt: profile.createdAt,
  });
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function plusSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

function assertTtl(value: number, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

export function createCustomerAuthService(input: Readonly<{
  repository: PlatformSessionRepository;
  tenantId: TenantId;
  otpPepper: string;
  emailDelivery?: OtpDelivery;
  smsDelivery?: OtpDelivery;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  otpTtlSeconds?: number;
  resendSeconds?: number;
  now?: () => string;
}>): CustomerAuthService {
  const accessTtlSeconds = assertTtl(input.accessTtlSeconds ?? 900, "accessTtlSeconds", 60, 86_400);
  const refreshTtlSeconds = assertTtl(input.refreshTtlSeconds ?? 30 * 24 * 60 * 60, "refreshTtlSeconds", 3600, 365 * 24 * 60 * 60);
  const otpTtlSeconds = assertTtl(input.otpTtlSeconds ?? 600, "otpTtlSeconds", 60, 3600);
  const resendSeconds = assertTtl(input.resendSeconds ?? 60, "resendSeconds", 30, 3600);
  if (refreshTtlSeconds <= accessTtlSeconds) throw new TypeError("refreshTtlSeconds must exceed accessTtlSeconds");
  if (input.otpPepper.length < 32) throw new TypeError("MASANAWA_AUTH_OTP_PEPPER must be at least 32 characters");
  const now = input.now ?? (() => new Date().toISOString());

  function delivery(channel: PlatformAuthChannel): OtpDelivery {
    const result = channel === "email" ? input.emailDelivery : input.smsDelivery;
    if (!result) throw new CustomerAuthError("OTP_CHANNEL_UNAVAILABLE", 503);
    return result;
  }

  async function issueTokens(identity: PlatformSessionIdentity, isNewUser: boolean): Promise<AuthTokensView> {
    const issuedAt = now();
    const accessToken = mintPlatformSessionToken("access");
    const refreshToken = mintPlatformSessionToken("refresh");
    try {
      await input.repository.issueSession({
        identity,
        accessHash: hashPlatformSessionToken(accessToken),
        refreshHash: hashPlatformSessionToken(refreshToken),
        accessExpiresAt: plusSeconds(issuedAt, accessTtlSeconds),
        refreshExpiresAt: plusSeconds(issuedAt, refreshTtlSeconds),
        issuedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "auth.account_inactive") {
        throw new CustomerAuthError("ACCOUNT_INACTIVE", 403);
      }
      throw error;
    }
    return Object.freeze({
      accessToken,
      refreshToken,
      accessExpiresIn: accessTtlSeconds,
      user: authUser(identity.profile, isNewUser),
    });
  }

  const otpChannels = Object.freeze([
    ...(input.emailDelivery ? ["email" as const] : []),
    ...(input.smsDelivery ? ["sms" as const] : []),
  ]);

  return Object.freeze<CustomerAuthService>({
    capabilities() {
      return Object.freeze({ otpChannels });
    },

    async sendOtp(request) {
      let normalized;
      try {
        normalized = normalizePlatformAuthIdentifier(request);
      } catch {
        throw new CustomerAuthError("VALIDATION_FAILED", 400);
      }
      // Reject unsupported channels before creating a persistent OTP challenge.
      // An unavailable SMS adapter must not leave a ghost cooldown or challenge.
      const channelDelivery = delivery(normalized.channel);
      const code = createOtpCode();
      const createdAt = now();
      const codeHash = hashOtpCode({
        pepper: input.otpPepper,
        tenantId: input.tenantId,
        channel: normalized.channel,
        identifier: normalized.identifier,
        code,
      });
      try {
        await input.repository.putOtpChallenge({
          tenantId: input.tenantId,
          channel: normalized.channel,
          identifier: normalized.identifier,
          codeHash,
          createdAt,
          expiresAt: plusSeconds(createdAt, otpTtlSeconds),
          resendAfter: plusSeconds(createdAt, resendSeconds),
          maxAttempts: 5,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "auth.otp.cooldown") {
          throw new CustomerAuthError("OTP_RATE_LIMITED", 429);
        }
        throw error;
      }
      try {
        await channelDelivery.send({ identifier: normalized.identifier, code });
      } catch {
        await input.repository.cancelOtpChallenge({
          tenantId: input.tenantId,
          channel: normalized.channel,
          identifier: normalized.identifier,
          codeHash,
        }).catch(() => undefined);
        throw new CustomerAuthError("OTP_DELIVERY_UNAVAILABLE", 503);
      }
      return Object.freeze({
        ...(normalized.channel === "email"
          ? { email: normalized.identifier }
          : { phone: normalized.identifier }),
        resendInSeconds: resendSeconds,
      });
    },

    async verifyOtp(request) {
      let normalized;
      try {
        normalized = normalizePlatformAuthIdentifier(request);
      } catch {
        throw new CustomerAuthError("VALIDATION_FAILED", 400);
      }
      if (!/^\d{6}$/u.test(request.code)) throw new CustomerAuthError("OTP_INVALID", 400);
      const verifiedAt = now();
      const codeHash = hashOtpCode({
        pepper: input.otpPepper,
        tenantId: input.tenantId,
        channel: normalized.channel,
        identifier: normalized.identifier,
        code: request.code,
      });
      // Prove possession first without burning the one-time challenge. A new
      // user may need to supply a name in a second request from the existing
      // mobile onboarding flow.
      const validation = await input.repository.consumeOtpChallenge({
        tenantId: input.tenantId,
        channel: normalized.channel,
        identifier: normalized.identifier,
        codeHash,
        consumedAt: verifiedAt,
        consume: false,
      });
      if (validation === "locked") throw new CustomerAuthError("OTP_LOCKED", 429);
      if (validation !== "accepted") throw new CustomerAuthError("OTP_INVALID", 400);

      let profile = await input.repository.resolveProfile({
        tenantId: input.tenantId,
        channel: normalized.channel,
        identifier: normalized.identifier,
        observedAt: verifiedAt,
      });
      const name = request.name?.trim();
      if (!profile && !name) throw new CustomerAuthError("NAME_REQUIRED_ON_SIGNUP", 400);

      // Consume atomically only when this request can actually complete sign-in.
      const consumed = await input.repository.consumeOtpChallenge({
        tenantId: input.tenantId,
        channel: normalized.channel,
        identifier: normalized.identifier,
        codeHash,
        consumedAt: verifiedAt,
      });
      if (consumed === "locked") throw new CustomerAuthError("OTP_LOCKED", 429);
      if (consumed !== "accepted") throw new CustomerAuthError("OTP_INVALID", 400);

      if (!profile) {
        profile = await input.repository.createProfile({
          tenantId: input.tenantId,
          channel: normalized.channel,
          identifier: normalized.identifier,
          name: name!,
          locale: "en-NG",
          createdAt: verifiedAt,
        });
      }
      return issueTokens(
        Object.freeze({ tenantId: profile.tenantId, userId: profile.userId, profile }),
        false,
      );
    },

    async refresh(request) {
      let refreshHash: string;
      try {
        refreshHash = hashPlatformSessionToken(request.refreshToken);
      } catch {
        throw new CustomerAuthError("SESSION_NOT_FOUND", 401);
      }
      const rotatedAt = now();
      const accessToken = mintPlatformSessionToken("access");
      const refreshToken = mintPlatformSessionToken("refresh");
      let identity: PlatformSessionIdentity | null;
      try {
        identity = await input.repository.rotateRefresh({
          refreshHash,
          nextAccessHash: hashPlatformSessionToken(accessToken),
          nextRefreshHash: hashPlatformSessionToken(refreshToken),
          accessExpiresAt: plusSeconds(rotatedAt, accessTtlSeconds),
          refreshExpiresAt: plusSeconds(rotatedAt, refreshTtlSeconds),
          rotatedAt,
        });
      } catch {
        // A storage outage is not an invalid credential and may be retried.
        // Do not disclose repository exceptions or token material.
        throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
      }
      if (!identity) throw new CustomerAuthError("SESSION_NOT_FOUND", 401);
      return Object.freeze({
        accessToken,
        refreshToken,
        accessExpiresIn: accessTtlSeconds,
        user: authUser(identity.profile, false),
      });
    },

    async logout(request) {
      const token = bearer(request.authorizationHeader);
      if (!token) return;
      let accessHash: string;
      try {
        accessHash = hashPlatformSessionToken(token);
      } catch {
        throw new CustomerAuthError("UNAUTHORIZED", 401);
      }
      try {
        await input.repository.revokeAccess({
          accessHash,
          revokedAt: now(),
        });
      } catch {
        // Never claim a server logout succeeded while a session may remain valid.
        throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
      }
    },
  });
}

export function createPlatformCustomerSessionAuthorizer(input: Readonly<{
  repository: PlatformSessionRepository;
  now?: () => string;
}>): PlatformCustomerSessionAuthorizer {
  const now = input.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async authorize(request: Parameters<PlatformCustomerSessionAuthorizer["authorize"]>[0]) {
      const token = bearer(request.authorizationHeader);
      if (!token) throw new CustomerAuthError("UNAUTHORIZED", 401);
      let accessHash: string;
      try {
        accessHash = hashPlatformSessionToken(token);
      } catch {
        throw new CustomerAuthError("UNAUTHORIZED", 401);
      }
      let identity: PlatformSessionIdentity | null;
      try {
        identity = await input.repository.resolveAccess({ accessHash, at: now() });
      } catch {
        throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
      }
      if (!identity) throw new CustomerAuthError("UNAUTHORIZED", 401);
      return identity;
    },
  });
}

export function createPlatformSessionFinancialAuthorizer(input: Readonly<{
  repository: PlatformSessionRepository;
  now?: () => string;
}>): PlatformFinancialAuthorizer {
  const now = input.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async authorize(request: Parameters<PlatformFinancialAuthorizer["authorize"]>[0]) {
      const token = bearer(request.authorizationHeader);
      if (!token) throw new Error("financial.auth.unauthorized");
      let accessHash: string;
      try {
        accessHash = hashPlatformSessionToken(token);
      } catch {
        throw new Error("financial.auth.unauthorized");
      }
      const identity = await input.repository.resolveAccess({ accessHash, at: now() });
      if (!identity) throw new Error("financial.auth.unauthorized");
      return Object.freeze({ tenantId: identity.tenantId, userId: identity.userId });
    },
  });
}

export function renderMasanawaOtpEmail(code: string): Readonly<{
  subject: string;
  text: string;
  html: string;
}> {
  if (!/^\d{6}$/u.test(code)) {
    throw new TypeError("OTP code must contain exactly six digits");
  }

  const subject = "Your Masanawa sign-in code";
  const text =
    "Your Masanawa sign-in code is " +
    code +
    ". It expires in 10 minutes. If you did not request this code, you can safely ignore this email.";

  const html = [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<title>" + subject + "</title></head>",
    "<body style=\"margin:0;padding:0;background:#F6FAFF;font-family:Arial,Helvetica,sans-serif;color:#06132C;\">",
    "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"background:#F6FAFF;padding:32px 16px;\">",
    "<tr><td align=\"center\">",
    "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"max-width:560px;background:#FFFFFF;border:1px solid #DDEBFF;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(1,33,210,.08);\">",
    "<tr><td style=\"background:#0121D2;background-image:linear-gradient(135deg,#0121D2,#1DA4FD);padding:28px 32px;text-align:center;\">",
    "<div style=\"font-size:30px;font-weight:800;letter-spacing:-.6px;color:#FFFFFF;\">Masanawa</div>",
    "<div style=\"margin-top:6px;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#EAF4FF;\">Secure sign-in</div>",
    "</td></tr>",
    "<tr><td style=\"padding:36px 32px 14px;text-align:center;\">",
    "<h1 style=\"margin:0;font-size:26px;line-height:1.25;color:#06132C;\">Verify your email</h1>",
    "<p style=\"margin:12px auto 0;max-width:420px;font-size:15px;line-height:1.65;color:#53647A;\">Use this one-time code to finish signing in to Masanawa.</p>",
    "</td></tr>",
    "<tr><td style=\"padding:12px 32px 20px;text-align:center;\">",
    "<div style=\"display:inline-block;min-width:260px;padding:18px 24px;border-radius:16px;background:#EEF6FF;border:1px solid #CFE4FF;font-size:34px;line-height:1;font-weight:800;letter-spacing:10px;color:#0121D2;\">" + code + "</div>",
    "<p style=\"margin:14px 0 0;font-size:13px;line-height:1.5;color:#6E7D90;\">This code expires in 10 minutes.</p>",
    "</td></tr>",
    "<tr><td style=\"padding:8px 32px 34px;\">",
    "<div style=\"border-radius:14px;background:#F8FBFF;padding:16px 18px;font-size:13px;line-height:1.6;color:#607086;\"><strong style=\"color:#06132C;\">Security note:</strong> Masanawa will never ask you to share this code in chat or by phone. If you did not request it, no action is needed.</div>",
    "</td></tr>",
    "<tr><td style=\"border-top:1px solid #E7EFFA;padding:20px 32px;text-align:center;font-size:12px;line-height:1.6;color:#8190A3;\">Masanawa · Your AI agents, ready to help<br><span style=\"color:#0A6FFA;\">masanawa.com</span></td></tr>",
    "</table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("");

  return Object.freeze({ subject, text, html });
}

export function createResendOtpDelivery(input: Readonly<{
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}>): OtpDelivery {
  const apiKey = input.apiKey.trim();
  const from = input.from.trim();
  if (!apiKey || !from) throw new TypeError("Resend OTP delivery configuration is incomplete");
  const fetchImpl = input.fetchImpl ?? fetch;
  return Object.freeze({
    async send(request: Parameters<OtpDelivery["send"]>[0]) {
      const message = renderMasanawaOtpEmail(request.code);
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          from,
          to: [request.identifier],
          subject: message.subject,
          text: message.text,
          html: message.html,
          tags: [{ name: "category", value: "authentication_otp" }],
        }),
      });
      if (!response.ok) throw new Error("auth.resend_delivery_failed");
    },
  });
}

export function createHttpSmsOtpDelivery(input: Readonly<{
  endpoint: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
}>): OtpDelivery {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:") throw new TypeError("SMS OTP endpoint must use HTTPS");
  const token = input.bearerToken.trim();
  if (!token) throw new TypeError("SMS OTP bearer token is required");
  const fetchImpl = input.fetchImpl ?? fetch;
  return Object.freeze({
    async send(request: Parameters<OtpDelivery["send"]>[0]) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          to: request.identifier,
          message: `Your Masanawa sign-in code is ${request.code}. It expires in 10 minutes.`,
        }),
      });
      if (!response.ok) throw new Error("auth.sms_delivery_failed");
    },
  });
}


export function createPlatformCustomerAuthorizers(input: Readonly<{
  sessions: PlatformCustomerSessionAuthorizer;
  presentations: AgentPresentationRepository;
  skillAssignments: CharacterSkillAssignmentRepository;
  relationships: UserRelationshipReader;
  relationshipProvisioner: UserRelationshipProvisioner;
  platformProfiles: PlatformAgentProfileRepository;
  policyRevision: string;
  publicTwinAdmission?: {
    canChat(input: Readonly<{
      tenantId: TenantId;
      userId: UserId;
      characterId: CharacterId;
    }>): Promise<boolean>;
    canContinue?(input: Readonly<{
      tenantId: TenantId;
      userId: UserId;
      characterId: CharacterId;
    }>): Promise<boolean>;
  };
}>): Readonly<{
  directory: AgentDirectoryAuthorizer;
  conversation: AgentConversationAuthorizer;
  creator: CreatorCloneAuthorizer;
  commerce: CommerceUserAuthorizer;
}> {
  const policyRevision = input.policyRevision.trim();
  if (!policyRevision || policyRevision.length > 160) {
    throw new TypeError("Platform policy revision is invalid");
  }

  async function session(authorizationHeader: string | undefined) {
    try {
      return await input.sessions.authorize({ authorizationHeader });
    } catch {
      throw new CustomerAuthError("UNAUTHORIZED", 401);
    }
  }

  async function admittedCharacterIds(
    tenantId: Parameters<UserRelationshipReader["listForUser"]>[0]["tenantId"],
    userId: Parameters<UserRelationshipReader["listForUser"]>[0]["userId"],
  ): Promise<readonly CharacterId[]> {
    const [relationships, supportAgents] = await Promise.all([
      input.relationships.listForUser({ tenantId, userId }),
      input.platformProfiles.listSupportAgents({ tenantId }),
    ]);
    const characterIds = new Set<CharacterId>();
    for (const relationship of relationships) {
      characterIds.add(relationship.characterId);
    }
    for (const profile of supportAgents) {
      characterIds.add(profile.characterId);
    }
    return Object.freeze([...characterIds]);
  }

  const directory: AgentDirectoryAuthorizer = Object.freeze({
    async authorize(request: Parameters<AgentDirectoryAuthorizer["authorize"]>[0]) {
      const identity = await session(request.authorizationHeader);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
        characterIds: await admittedCharacterIds(
          identity.tenantId,
          identity.userId,
        ),
      });
    },
  });

  const conversation: AgentConversationAuthorizer = Object.freeze({
    async authorize(request: Parameters<AgentConversationAuthorizer["authorize"]>[0]): Promise<AgentConversationAdmission> {
      const identity = await session(request.authorizationHeader);
      const characterId = parseCanonicalId("character", request.characterId);
      const presentation = await input.presentations.readForCharacter({
        tenantId: identity.tenantId,
        characterId,
      });
      if (!presentation?.visibleInUserApp) {
        throw new CustomerAuthError("FORBIDDEN", 403);
      }

      let relationship = await input.relationships.readForUserCharacter({
        tenantId: identity.tenantId,
        userId: identity.userId,
        characterId,
      });
      if (!relationship) {
        const platform = await input.platformProfiles.readForCharacter({
          tenantId: identity.tenantId,
          characterId,
        });
        if (!platform?.supportAgent) {
          const publicTwinAllowed =
            input.publicTwinAdmission
              ? await input.publicTwinAdmission.canChat({
                  tenantId: identity.tenantId,
                  userId: identity.userId,
                  characterId,
                })
              : false;
          if (!publicTwinAllowed) {
            throw new CustomerAuthError("FORBIDDEN", 403);
          }
        }
        relationship = await input.relationshipProvisioner.getOrCreateForUserCharacter({
          tenantId: identity.tenantId,
          userId: identity.userId,
          characterId,
          createdAt: nowInstant(),
        });
      }

      if (
        input.publicTwinAdmission?.canContinue &&
        !(await input.publicTwinAdmission.canContinue({
          tenantId: identity.tenantId,
          userId: identity.userId,
          characterId,
        }))
      ) {
        throw new CustomerAuthError("FORBIDDEN", 403);
      }

      const assignment = await input.skillAssignments.readForCharacter({
        tenantId: identity.tenantId,
        characterId,
      });
      const requestId = createCanonicalId("request");
      const correlationId = createCanonicalId("correlation");
      return Object.freeze({
        scope: Object.freeze({
          tenantId: identity.tenantId,
          userId: identity.userId,
          characterId,
          relationshipId: relationship.relationshipId,
        }),
        characterVersionId: presentation.characterVersionId,
        bindings: Object.freeze({
          channelSessionId: null,
          presenceSessionId: null,
          skillVersionIds: Object.freeze([...(assignment?.skillVersionIds ?? [])]),
          taskIds: Object.freeze([]),
          workflowRunIds: Object.freeze([]),
        }),
        presentation: Object.freeze({
          displayName: presentation.displayName,
          roleLabel: presentation.roleLabel,
          about: presentation.about,
        }),
        authority: createAuthorityContext({
          tenantId: identity.tenantId,
          principal: Object.freeze({
            kind: "user" as const,
            userId: identity.userId,
          }),
          scopes: Object.freeze(["mobile.production"]),
          capabilities: Object.freeze([
            "agents.session.create",
            "agents.session.read",
            "agents.session.close",
            "agents.run.create",
            "agents.run.read",
            "agents.run.finish",
          ]),
          resourceScope: Object.freeze({
            relationshipIds: Object.freeze([relationship.relationshipId]),
          }),
          policyRevision,
          approvalIds: Object.freeze([]),
          delegationChain: Object.freeze([]),
          requestId,
          correlationId,
        }),
      });
    },
  });

  const creator: CreatorCloneAuthorizer = Object.freeze({
    async authorize(request: Parameters<CreatorCloneAuthorizer["authorize"]>[0]) {
      const identity = await session(request.authorizationHeader);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
    },
  });

  const commerce: CommerceUserAuthorizer = Object.freeze({
    async authorize(request: Parameters<CommerceUserAuthorizer["authorize"]>[0]) {
      const identity = await session(request.authorizationHeader);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
    },
  });

  return Object.freeze({ directory, conversation, creator, commerce });
}

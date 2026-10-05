import {
  createOtpCode,
  hashOtpCode,
  hashPlatformSessionToken,
  mintPlatformSessionToken,
  normalizePlatformAuthIdentifier,
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
import { createAuthorityContext } from "@masanawa/security";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type { AgentDirectoryAuthorizer } from "./agent_directory.js";
import type { CreatorCloneAuthorizer } from "./creator_clone.js";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";
import type { FinancialAuthorizer } from "./financial_service.js";

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
    await input.repository.issueSession({
      identity,
      accessHash: hashPlatformSessionToken(accessToken),
      refreshHash: hashPlatformSessionToken(refreshToken),
      accessExpiresAt: plusSeconds(issuedAt, accessTtlSeconds),
      refreshExpiresAt: plusSeconds(issuedAt, refreshTtlSeconds),
      issuedAt,
    });
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
        await delivery(normalized.channel).send({ identifier: normalized.identifier, code });
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
      const isNewUser = profile === null;
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
        isNewUser,
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
      const identity = await input.repository.rotateRefresh({
        refreshHash,
        nextAccessHash: hashPlatformSessionToken(accessToken),
        nextRefreshHash: hashPlatformSessionToken(refreshToken),
        accessExpiresAt: plusSeconds(rotatedAt, accessTtlSeconds),
        refreshExpiresAt: plusSeconds(rotatedAt, refreshTtlSeconds),
        rotatedAt,
      });
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
      try {
        await input.repository.revokeAccess({
          accessHash: hashPlatformSessionToken(token),
          revokedAt: now(),
        });
      } catch {
        return;
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
      if (!token) throw new Error("financial.auth.unauthorized");
      let accessHash: string;
      try {
        accessHash = hashPlatformSessionToken(token);
      } catch {
        throw new Error("financial.auth.unauthorized");
      }
      const identity = await input.repository.resolveAccess({ accessHash, at: now() });
      if (!identity) throw new Error("financial.auth.unauthorized");
      return identity;
    },
  });
}

export function createPlatformSessionFinancialAuthorizer(input: Readonly<{
  repository: PlatformSessionRepository;
  now?: () => string;
}>): FinancialAuthorizer {
  const now = input.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async authorize(request: Parameters<FinancialAuthorizer["authorize"]>[0]) {
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
          subject: "Your Masanawa sign-in code",
          text: `Your Masanawa sign-in code is ${request.code}. It expires in 10 minutes. If you did not request this code, ignore this message.`,
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
    async authorize(request) {
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
    async authorize(request): Promise<AgentConversationAdmission> {
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
          throw new CustomerAuthError("FORBIDDEN", 403);
        }
        relationship = await input.relationshipProvisioner.getOrCreateForUserCharacter({
          tenantId: identity.tenantId,
          userId: identity.userId,
          characterId,
          createdAt: nowInstant(),
        });
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
    async authorize(request) {
      const identity = await session(request.authorizationHeader);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
    },
  });

  const commerce: CommerceUserAuthorizer = Object.freeze({
    async authorize(request) {
      const identity = await session(request.authorizationHeader);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
    },
  });

  return Object.freeze({ directory, conversation, creator, commerce });
}

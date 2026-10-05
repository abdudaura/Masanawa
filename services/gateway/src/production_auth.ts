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
import type { UserRelationshipReader } from "@masanawa/identity";
import { createAuthorityContext } from "@masanawa/security";
import type { ProductionUserIdentityRepository } from "@masanawa/postgres";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type { AgentDirectoryAuthorizer } from "./agent_directory.js";
import type { CreatorCloneAuthorizer } from "./creator_clone.js";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";

export class ProductionAuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ProductionAuthError";
  }
}

interface SupabaseUser {
  readonly id: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly created_at?: string;
  readonly user_metadata?: Readonly<Record<string, unknown>>;
}

interface SupabaseSessionResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly user?: SupabaseUser;
}

export interface ProductionMobileUser {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly locale: string;
  readonly status: "ACTIVE";
  readonly role: "USER";
  readonly isNewUser: boolean;
  readonly communityId: null;
  readonly stateId: null;
  readonly createdAt: string;
}

export interface ProductionAuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresIn: number;
  readonly user: ProductionMobileUser;
}

export interface ProductionAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly subject: string;
}

export interface ProductionAuthService {
  sendOtp(input: {
    readonly phone?: string;
    readonly email?: string;
  }): Promise<{ readonly phone?: string; readonly email?: string; readonly resendInSeconds: number }>;
  verifyOtp(input: {
    readonly phone?: string;
    readonly email?: string;
    readonly code: string;
  }): Promise<ProductionAuthSession>;
  refresh(refreshToken: string): Promise<ProductionAuthSession>;
  logout(authorizationHeader: string | undefined): Promise<void>;
  updateProfile(input: {
    readonly authorizationHeader: string | undefined;
    readonly name: string;
  }): Promise<ProductionMobileUser>;
  authenticate(authorizationHeader: string | undefined): Promise<ProductionAuthority>;
}

function bounded(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new ProductionAuthError("VALIDATION_FAILED", 400, `${name} is invalid`);
  }
  return normalized;
}

function bearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new ProductionAuthError("UNAUTHORIZED", 401, "Authentication required");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) {
    throw new ProductionAuthError("UNAUTHORIZED", 401, "Authentication required");
  }
  return token;
}

function normalizeEmail(value: string): string {
  const email = bounded(value, "email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new ProductionAuthError("VALIDATION_FAILED", 400, "Email is invalid");
  }
  return email;
}

function normalizePhone(value: string): string {
  const phone = bounded(value, "phone", 24).replace(/[\s()-]/gu, "");
  if (!/^\+[1-9]\d{6,14}$/u.test(phone)) {
    throw new ProductionAuthError("VALIDATION_FAILED", 400, "Phone is invalid");
  }
  return phone;
}

function normalizeName(value: string): string {
  const name = bounded(value, "name", 120).replace(/\s+/gu, " ");
  if (name.length < 2) {
    throw new ProductionAuthError("VALIDATION_FAILED", 400, "Name is invalid");
  }
  return name;
}

function projectRefFromUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new TypeError("SUPABASE_URL must be a hosted Supabase HTTPS origin");
  }
  const ref = parsed.hostname.slice(0, -".supabase.co".length);
  if (!/^[a-z0-9]{8,64}$/u.test(ref)) throw new TypeError("Invalid Supabase project URL");
  return ref;
}

function userName(user: SupabaseUser): string {
  const value = user.user_metadata?.["name"];
  return typeof value === "string" && value.trim().length <= 120
    ? value.trim().replace(/\s+/gu, " ")
    : "";
}

function supabaseError(status: number, operation: "otp" | "verify" | "refresh" | "user"): ProductionAuthError {
  if (status === 429) {
    return new ProductionAuthError("OTP_RATE_LIMITED", 429, "Too many authentication attempts");
  }
  if (operation === "verify" && (status === 400 || status === 401 || status === 403)) {
    return new ProductionAuthError("OTP_INVALID", 400, "The verification code is invalid or expired");
  }
  if ((operation === "refresh" || operation === "user") && (status === 400 || status === 401 || status === 403)) {
    return new ProductionAuthError("UNAUTHORIZED", 401, "Session is no longer valid");
  }
  if (operation === "otp" && status >= 400 && status < 500) {
    return new ProductionAuthError("VALIDATION_FAILED", 400, "This sign-in method is unavailable");
  }
  return new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable");
}

async function jsonResponse<T>(
  response: Response,
  operation: "otp" | "verify" | "refresh" | "user",
): Promise<T> {
  if (!response.ok) throw supabaseError(response.status, operation);
  try {
    return await response.json() as T;
  } catch {
    throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication returned an invalid response");
  }
}

export function createProductionAuthService(input: {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly tenantId: TenantId;
  readonly identities: ProductionUserIdentityRepository;
  readonly fetchImpl?: typeof fetch;
}): ProductionAuthService {
  const supabaseUrl = input.supabaseUrl.replace(/\/+$/u, "");
  const projectRef = projectRefFromUrl(supabaseUrl);
  const publishableKey = bounded(input.publishableKey, "Supabase publishable key", 1024);
  const fetchImpl = input.fetchImpl ?? fetch;

  const headers = (authorization?: string) => ({
    apikey: publishableKey,
    "content-type": "application/json",
    ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
  });

  async function resolveUser(user: SupabaseUser): Promise<{ readonly authority: ProductionAuthority; readonly mobile: ProductionMobileUser }> {
    const subject = bounded(user.id, "Supabase user id", 128);
    const observedAt = nowInstant();
    const userId = await input.identities.resolveOrCreateSupabaseUser({
      tenantId: input.tenantId,
      projectRef,
      subject,
      observedAt,
    });
    const name = userName(user);
    return Object.freeze({
      authority: Object.freeze({
        tenantId: input.tenantId,
        userId,
        subject,
      }),
      mobile: Object.freeze({
        id: userId,
        name,
        phone: typeof user.phone === "string" && user.phone ? user.phone : null,
        email: typeof user.email === "string" && user.email ? user.email : null,
        locale: "en",
        status: "ACTIVE" as const,
        role: "USER" as const,
        isNewUser: name.length === 0,
        communityId: null,
        stateId: null,
        createdAt:
          typeof user.created_at === "string" && user.created_at
            ? user.created_at
            : new Date().toISOString(),
      }),
    });
  }

  async function sessionFrom(payload: SupabaseSessionResponse): Promise<ProductionAuthSession> {
    if (
      typeof payload.access_token !== "string" ||
      typeof payload.refresh_token !== "string" ||
      typeof payload.expires_in !== "number" ||
      !payload.user
    ) {
      throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication returned no session");
    }
    const resolved = await resolveUser(payload.user);
    return Object.freeze({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      accessExpiresIn: Math.max(60, Math.floor(payload.expires_in)),
      user: resolved.mobile,
    });
  }

  async function currentUser(token: string): Promise<SupabaseUser> {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: headers(token),
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    }).catch(() => {
      throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable");
    });
    return jsonResponse<SupabaseUser>(response, "user");
  }

  return Object.freeze({
    async sendOtp(request) {
      const hasPhone = typeof request.phone === "string";
      const hasEmail = typeof request.email === "string";
      if (hasPhone === hasEmail) {
        throw new ProductionAuthError("VALIDATION_FAILED", 400, "Choose one sign-in method");
      }
      const body = hasPhone
        ? { phone: normalizePhone(request.phone!) }
        : { email: normalizeEmail(request.email!) };
      const response = await fetchImpl(`${supabaseUrl}/auth/v1/otp`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      }).catch(() => {
        throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable");
      });
      if (!response.ok) throw supabaseError(response.status, "otp");
      return Object.freeze({
        ...body,
        resendInSeconds: 60,
      });
    },

    async verifyOtp(request) {
      const hasPhone = typeof request.phone === "string";
      const hasEmail = typeof request.email === "string";
      if (hasPhone === hasEmail) {
        throw new ProductionAuthError("VALIDATION_FAILED", 400, "Choose one sign-in method");
      }
      const body = hasPhone
        ? {
            type: "sms",
            phone: normalizePhone(request.phone!),
            token: bounded(request.code, "code", 12),
          }
        : {
            type: "email",
            email: normalizeEmail(request.email!),
            token: bounded(request.code, "code", 12),
          };
      const response = await fetchImpl(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      }).catch(() => {
        throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable");
      });
      return sessionFrom(await jsonResponse<SupabaseSessionResponse>(response, "verify"));
    },

    async refresh(refreshToken) {
      const token = bounded(refreshToken, "refresh token", 4096);
      const response = await fetchImpl(
        `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ refresh_token: token }),
          redirect: "error",
          signal: AbortSignal.timeout(12_000),
        },
      ).catch(() => {
        throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Authentication is temporarily unavailable");
      });
      return sessionFrom(await jsonResponse<SupabaseSessionResponse>(response, "refresh"));
    },

    async logout(authorizationHeader) {
      const token = bearerToken(authorizationHeader);
      const response = await fetchImpl(`${supabaseUrl}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: headers(token),
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      }).catch(() => null);
      if (response && response.status >= 500) {
        throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Sign out could not be confirmed");
      }
    },

    async updateProfile(request) {
      const token = bearerToken(request.authorizationHeader);
      const name = normalizeName(request.name);
      await currentUser(token);
      const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify({ data: { name } }),
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      }).catch(() => {
        throw new ProductionAuthError("AUTH_UNAVAILABLE", 503, "Profile update is temporarily unavailable");
      });
      const user = await jsonResponse<SupabaseUser>(response, "user");
      return (await resolveUser(user)).mobile;
    },

    async authenticate(authorizationHeader) {
      const token = bearerToken(authorizationHeader);
      const user = await currentUser(token);
      return (await resolveUser(user)).authority;
    },
  });
}

export function createProductionAuthorizers(input: {
  readonly auth: ProductionAuthService;
  readonly identities: ProductionUserIdentityRepository;
  readonly presentations: AgentPresentationRepository;
  readonly skillAssignments: CharacterSkillAssignmentRepository;
  readonly relationships: UserRelationshipReader;
  readonly platformProfiles: PlatformAgentProfileRepository;
  readonly policyRevision: string;
}): {
  readonly directory: AgentDirectoryAuthorizer;
  readonly conversation: AgentConversationAuthorizer;
  readonly creator: CreatorCloneAuthorizer;
  readonly commerce: CommerceUserAuthorizer;
} {
  const policyRevision = bounded(input.policyRevision, "policy revision", 160);

  const directory: AgentDirectoryAuthorizer = Object.freeze({
    async authorize(request) {
      const authority = await input.auth.authenticate(request.authorizationHeader);
      const [relationships, supportAgents] = await Promise.all([
        input.relationships.listForUser({
          tenantId: authority.tenantId,
          userId: authority.userId,
        }),
        input.platformProfiles.listSupportAgents({
          tenantId: authority.tenantId,
        }),
      ]);
      const characterIds = new Set<CharacterId>();
      for (const relationship of relationships) characterIds.add(relationship.characterId);
      for (const profile of supportAgents) characterIds.add(profile.characterId);
      return Object.freeze({
        tenantId: authority.tenantId,
        userId: authority.userId,
        characterIds: Object.freeze([...characterIds]),
      });
    },
  });

  const conversation: AgentConversationAuthorizer = Object.freeze({
    async authorize(request): Promise<AgentConversationAdmission> {
      const authority = await input.auth.authenticate(request.authorizationHeader);
      const characterId = parseCanonicalId("character", request.characterId);
      const presentation = await input.presentations.readForCharacter({
        tenantId: authority.tenantId,
        characterId,
      });
      if (!presentation?.visibleInUserApp) {
        throw new ProductionAuthError("FORBIDDEN", 403, "Character is not available");
      }

      let relationship = await input.relationships.readForUserCharacter({
        tenantId: authority.tenantId,
        userId: authority.userId,
        characterId,
      });
      if (!relationship) {
        const platform = await input.platformProfiles.readForCharacter({
          tenantId: authority.tenantId,
          characterId,
        });
        if (!platform?.supportAgent) {
          throw new ProductionAuthError("FORBIDDEN", 403, "Character is not available");
        }
        const relationshipId = await input.identities.getOrCreateRelationship({
          tenantId: authority.tenantId,
          userId: authority.userId,
          characterId,
          createdAt: nowInstant(),
        });
        relationship = Object.freeze({
          tenantId: authority.tenantId,
          relationshipId,
          userId: authority.userId,
          characterId,
          state: "active" as const,
          stage: null,
          tone: null,
          preferences: Object.freeze({}),
          disclosures: Object.freeze({}),
          permissions: Object.freeze({}),
          revision: 1,
          createdAt: nowInstant(),
          updatedAt: nowInstant(),
        });
      }

      const assignment = await input.skillAssignments.readForCharacter({
        tenantId: authority.tenantId,
        characterId,
      });
      const requestId = createCanonicalId("request");
      const correlationId = createCanonicalId("correlation");
      return Object.freeze({
        scope: Object.freeze({
          tenantId: authority.tenantId,
          userId: authority.userId,
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
          tenantId: authority.tenantId,
          principal: Object.freeze({ kind: "user" as const, userId: authority.userId }),
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
      const authority = await input.auth.authenticate(request.authorizationHeader);
      return Object.freeze({ tenantId: authority.tenantId, userId: authority.userId });
    },
  });

  const commerce: CommerceUserAuthorizer = Object.freeze({
    async authorize(request) {
      const authority = await input.auth.authenticate(request.authorizationHeader);
      return Object.freeze({ tenantId: authority.tenantId, userId: authority.userId });
    },
  });

  return Object.freeze({ directory, conversation, creator, commerce });
}

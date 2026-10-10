import {
  hashPlatformSessionToken, mintPlatformSessionToken,
  type PlatformAuthProfile, type PlatformSessionRepository,
} from "@masanawa/security";
import type { TenantId } from "@masanawa/contracts";
import { CustomerAuthError, type AuthTokensView } from "../customer_auth.js";
import {
  assertNumericPassword, hashNumericPassword, normalizePasswordPhone, verifyNumericPassword,
} from "./phone_password_policy.js";

/**
 * Same canonical identity.users, security.platform_user_profiles and platform_sessions
 * as email OTP. This credential authenticates an account, NOT phone possession.
 * DB implementation owns registration uniqueness and atomic login lockout.
 */
export interface PhonePasswordCredentialRepository {
  register(input: Readonly<{
    tenantId: TenantId; phone: string; name: string; locale: string;
    passwordHash: string; at: string;
  }>): Promise<PlatformAuthProfile>;
  authenticate(input: Readonly<{
    tenantId: TenantId; phone: string; at: string;
    verify: (storedHash: string | null) => Promise<boolean>;
  }>): Promise<PlatformAuthProfile | null>;
}

export interface PhonePasswordAuthService {
  register(input: Readonly<{ phone: string; password: string; name: string }>): Promise<AuthTokensView>;
  login(input: Readonly<{ phone: string; password: string }>): Promise<AuthTokensView>;
}

export function createPhonePasswordAuthService(input: Readonly<{
  credentials: PhonePasswordCredentialRepository;
  sessions: PlatformSessionRepository;
  tenantId: TenantId;
  pepper: string;
  now?: () => string;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
}>): PhonePasswordAuthService {
  if (typeof input.pepper !== "string" || input.pepper.length < 32) {
    throw new TypeError("MASANAWA_AUTH_PASSWORD_PEPPER must be at least 32 characters");
  }
  const accessTtlSeconds = input.accessTtlSeconds ?? 900;
  const refreshTtlSeconds = input.refreshTtlSeconds ?? 30 * 24 * 60 * 60;
  if (!Number.isSafeInteger(accessTtlSeconds) || accessTtlSeconds < 60 ||
      !Number.isSafeInteger(refreshTtlSeconds) || refreshTtlSeconds <= accessTtlSeconds ||
      refreshTtlSeconds > 365 * 24 * 60 * 60) {
    throw new TypeError("phone password token TTL configuration is invalid");
  }
  const now = input.now ?? (() => new Date().toISOString());

  function phone(value: string): string {
    try { return normalizePasswordPhone(value); }
    catch { throw new CustomerAuthError("PHONE_INVALID", 400); }
  }
  function password(value: string, number: string): string {
    try { return assertNumericPassword(value, number); }
    catch { throw new CustomerAuthError("PASSWORD_INVALID", 400); }
  }
  async function issue(profile: PlatformAuthProfile): Promise<AuthTokensView> {
    const issuedAt = now();
    const accessToken = mintPlatformSessionToken("access");
    const refreshToken = mintPlatformSessionToken("refresh");
    try {
      await input.sessions.issueSession({
        identity: Object.freeze({ tenantId: profile.tenantId, userId: profile.userId, profile }),
        accessHash: hashPlatformSessionToken(accessToken),
        refreshHash: hashPlatformSessionToken(refreshToken),
        accessExpiresAt: new Date(Date.parse(issuedAt) + accessTtlSeconds * 1000).toISOString(),
        refreshExpiresAt: new Date(Date.parse(issuedAt) + refreshTtlSeconds * 1000).toISOString(),
        issuedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "auth.account_inactive") {
        throw new CustomerAuthError("ACCOUNT_INACTIVE", 403);
      }
      throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
    }
    return Object.freeze({
      accessToken,
      refreshToken,
      accessExpiresIn: accessTtlSeconds,
      user: Object.freeze({
        id: profile.userId, name: profile.name,
        phone: profile.phone, email: profile.email, locale: profile.locale,
        status: "ACTIVE" as const, role: "CITIZEN" as const,
        isNewUser: false, communityId: null, stateId: null,
        createdAt: profile.createdAt,
        // Distinguish account authentication from phone-number ownership proof.
        phoneVerified: false,
      }),
    });
  }
  return Object.freeze({
    async register(request) {
      const normalizedPhone = phone(request.phone);
      const numericPassword = password(request.password, normalizedPhone);
      const name = request.name?.trim();
      if (!name || name.length > 160) throw new CustomerAuthError("NAME_REQUIRED_ON_SIGNUP", 400);
      const passwordHash = await hashNumericPassword(numericPassword, input.pepper);
      let profile: PlatformAuthProfile;
      try {
        profile = await input.credentials.register({
          tenantId: input.tenantId, phone: normalizedPhone, name,
          locale: "en-NG", passwordHash, at: now(),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "auth.phone.duplicate") {
          throw new CustomerAuthError("PHONE_ALREADY_REGISTERED", 409);
        }
        throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
      }
      return issue(profile);
    },
    async login(request) {
      const normalizedPhone = phone(request.phone);
      const numericPassword = password(request.password, normalizedPhone);
      let profile: PlatformAuthProfile | null;
      try {
        profile = await input.credentials.authenticate({
          tenantId: input.tenantId, phone: normalizedPhone, at: now(),
          verify: (hash) => verifyNumericPassword(numericPassword, hash, input.pepper),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "auth.phone.locked") {
          throw new CustomerAuthError("PASSWORD_RATE_LIMITED", 429);
        }
        throw new CustomerAuthError("AUTH_UNAVAILABLE", 503);
      }
      if (!profile) throw new CustomerAuthError("INVALID_CREDENTIALS", 401);
      return issue(profile);
    },
  });
}

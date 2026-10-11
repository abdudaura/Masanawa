import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import type { TenantId, UserId } from "@masanawa/contracts";

export type PlatformAuthChannel = "email" | "sms";

export interface PlatformAuthProfile {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly locale: string;
  readonly createdAt: string;
}

export interface PlatformSessionIdentity {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly profile: PlatformAuthProfile;
}

export type OtpConsumeResult = "accepted" | "invalid" | "expired" | "locked" | "missing";

export type PasswordVerifyResult = "accepted" | "invalid" | "locked" | "missing";

export interface PlatformSessionRepository {
  putOtpChallenge(input: Readonly<{
    tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; codeHash: string;
    createdAt: string; expiresAt: string; resendAfter: string; maxAttempts: number;
  }>): Promise<void>;
  cancelOtpChallenge(input: Readonly<{
    tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; codeHash: string;
  }>): Promise<void>;
  consumeOtpChallenge(input: Readonly<{
    tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; codeHash: string; consumedAt: string;
    /** Validate without consuming when false; used by signup name capture. Defaults to true. */
    consume?: boolean;
  }>): Promise<OtpConsumeResult>;
  resolveProfile(input: Readonly<{
    tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; observedAt: string;
  }>): Promise<PlatformAuthProfile | null>;
  createProfile(input: Readonly<{
    tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; name: string; locale: string; createdAt: string;
  }>): Promise<PlatformAuthProfile>;
  setPasswordCredential(input: Readonly<{
    tenantId: TenantId; userId: UserId; passwordHash: string; createdAt: string;
  }>): Promise<void>;
  verifyPasswordCredential(input: Readonly<{
    tenantId: TenantId; userId: UserId; passwordHash: string; at: string;
  }>): Promise<PasswordVerifyResult>;
  registerDevice(input: Readonly<{
    tenantId: TenantId; userId: UserId; deviceId: string; at: string;
  }>): Promise<void>;
  isDeviceKnown(input: Readonly<{
    tenantId: TenantId; userId: UserId; deviceId: string;
  }>): Promise<boolean>;
  attachIdentity(input: Readonly<{
    tenantId: TenantId; userId: UserId; channel: PlatformAuthChannel; identifier: string; linkedAt: string;
  }>): Promise<PlatformAuthProfile | null>;
  issueSession(input: Readonly<{
    identity: PlatformSessionIdentity; accessHash: string; refreshHash: string;
    accessExpiresAt: string; refreshExpiresAt: string; issuedAt: string;
  }>): Promise<void>;
  resolveAccess(input: Readonly<{ accessHash: string; at: string }>): Promise<PlatformSessionIdentity | null>;
  rotateRefresh(input: Readonly<{
    refreshHash: string; nextAccessHash: string; nextRefreshHash: string;
    accessExpiresAt: string; refreshExpiresAt: string; rotatedAt: string;
  }>): Promise<PlatformSessionIdentity | null>;
  revokeAccess(input: Readonly<{ accessHash: string; revokedAt: string }>): Promise<void>;
}

export function normalizePlatformAuthIdentifier(input: Readonly<{
  email?: string; phone?: string;
}>): Readonly<{ channel: PlatformAuthChannel; identifier: string }> {
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  if (Boolean(email) === Boolean(phone)) throw new TypeError("auth.exactly_one_identifier_required");
  if (email) {
    const normalized = email.toLowerCase();
    if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) throw new TypeError("auth.email_invalid");
    return Object.freeze({ channel: "email" as const, identifier: normalized });
  }
  const normalized = phone!.replace(/[\s()-]/gu, "");
  if (!/^\+[1-9]\d{6,14}$/u.test(normalized)) throw new TypeError("auth.phone_invalid");
  return Object.freeze({ channel: "sms" as const, identifier: normalized });
}

export function createOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(input: Readonly<{
  pepper: string; tenantId: TenantId; channel: PlatformAuthChannel; identifier: string; code: string;
}>): string {
  if (!/^\d{6}$/u.test(input.code)) throw new TypeError("auth.otp_invalid");
  if (input.pepper.length < 32) throw new TypeError("auth.otp_pepper_too_short");
  return createHmac("sha256", input.pepper)
    .update(`${input.tenantId}\0${input.channel}\0${input.identifier}\0${input.code}`, "utf8")
    .digest("hex");
}

export function hashDevicePassword(input: Readonly<{
  pepper: string; tenantId: TenantId; userId: UserId; password: string;
}>): string {
  if (!/^\d{6}$/u.test(input.password)) throw new TypeError("auth.password_invalid");
  if (input.pepper.length < 32) throw new TypeError("auth.password_pepper_too_short");
  // Domain-separated from OTP hashes by construction (tenant\0user\0password
  // vs tenant\0channel\0identifier\0code), so sharing the pepper is sound.
  return createHmac("sha256", input.pepper)
    .update(`${input.tenantId}\0${input.userId}\0${input.password}`, "utf8")
    .digest("hex");
}

export function mintPlatformSessionToken(kind: "access" | "refresh"): string {
  return `msw_${kind}_${randomBytes(32).toString("base64url")}`;
}

export function hashPlatformSessionToken(token: string): string {
  const normalized = token.trim();
  if (!/^msw_(?:access|refresh)_[A-Za-z0-9_-]{40,80}$/u.test(normalized)) throw new TypeError("auth.session_token_invalid");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

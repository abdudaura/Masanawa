import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated-encrypted invitation. Public URLs MUST NOT expose internal
 * tenant/user identifiers through reversible base64-encoded JSON.
 * This is a suggestion only: never contact admission or referral authority.
 */
export interface InviteClaims {
  readonly v: 1;
  readonly tenantId: string;
  readonly userId: string;
  readonly handle: string;
  readonly expiresAt: number;
}

const HANDLE = /^[a-z0-9_][a-z0-9_.-]{1,39}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u;
const B64 = /^[A-Za-z0-9_-]+$/u;
const AAD = Buffer.from("masanawa:invite:aes256gcm:v1", "utf8");
const MAX_LENGTH = 1024;
export const MAX_INVITE_AGE_SECONDS = 7 * 86400;

function secretKey(secret: string): Buffer {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Invite encryption secret requires at least 32 bytes");
  }
  return createHash("sha256").update(AAD).update(secret, "utf8").digest();
}

function decodeCanonical(value: string, maximum: number): Buffer | null {
  if (!B64.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length > maximum || bytes.toString("base64url") !== value ? null : bytes;
}

export function issueInviteToken(input: Readonly<{
  secret: string;
  tenantId: string;
  userId: string;
  handle: string;
  nowSeconds: number;
  ttlSeconds?: number;
}>): string {
  const ttl = input.ttlSeconds ?? 86400;
  if (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > MAX_INVITE_AGE_SECONDS ||
      !Number.isSafeInteger(input.nowSeconds) || input.nowSeconds <= 0 ||
      !ID.test(input.tenantId) || !ID.test(input.userId) ||
      !HANDLE.test(input.handle)) throw new TypeError("Invalid invitation claim");
  const claims: InviteClaims = {
    v: 1, tenantId: input.tenantId, userId: input.userId,
    handle: input.handle, expiresAt: input.nowSeconds + ttl,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(input.secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"), cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"),
    tag.toString("base64url")].join(".");
}

/** Identical null response for bad tag, expiry, parser or unknown future version. */
export function readInviteToken(input: Readonly<{
  secret: string; token: string; nowSeconds: number;
}>): InviteClaims | null {
  const key = secretKey(input.secret);
  const { token, nowSeconds } = input;
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0 ||
      typeof token !== "string" || token.length > MAX_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const iv = decodeCanonical(parts[1] ?? "", 12);
  const data = decodeCanonical(parts[2] ?? "", 600);
  const tag = decodeCanonical(parts[3] ?? "", 16);
  if (!iv || iv.length !== 12 || !data || !tag || tag.length !== 16) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const raw: unknown = JSON.parse(Buffer.concat([
      decipher.update(data), decipher.final(),
    ]).toString("utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const c = raw as Record<string, unknown>;
    if (Object.keys(c).sort().join(",") !== "expiresAt,handle,tenantId,userId,v") return null;
    if (c.v !== 1 || typeof c.tenantId !== "string" ||
        typeof c.userId !== "string" || typeof c.handle !== "string" ||
        !ID.test(c.tenantId) || !ID.test(c.userId) || !HANDLE.test(c.handle) ||
        typeof c.expiresAt !== "number" || !Number.isSafeInteger(c.expiresAt) ||
        c.expiresAt <= nowSeconds ||
        c.expiresAt > nowSeconds + MAX_INVITE_AGE_SECONDS) return null;
    return c as unknown as InviteClaims;
  } catch { return null; }
}

export function inviteUrl(token: string): string {
  const parts = token.split(".");
  if (token.length > MAX_LENGTH || parts.length !== 4 || parts[0] !== "v1" ||
      !parts.slice(1).every((part) => part && B64.test(part))) {
    throw new TypeError("Invalid invitation token");
  }
  return "https://masanawa.com/invite/" + encodeURIComponent(token);
}


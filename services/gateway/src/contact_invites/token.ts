import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Signed, short-lived *suggestion* only: never contact admission or rewards. */
export interface InviteClaims {
  readonly v: 1;
  readonly tenantId: string;
  readonly userId: string;
  readonly handle: string;
  readonly expiresAt: number;
  readonly nonce: string;
}

const HANDLE = /^[a-z0-9_][a-z0-9_.-]{1,39}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const MAX_LENGTH = 1024;
export const MAX_INVITE_AGE_SECONDS = 7 * 86400;

function checkSecret(secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Invite HMAC secret requires at least 32 bytes");
  }
  return secret;
}

function signature(secret: string, encoded: string): Buffer {
  return createHmac("sha256", checkSecret(secret))
    .update("masanawa:invitation:v1:", "utf8")
    .update(encoded, "utf8")
    .digest();
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
    nonce: randomBytes(16).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return payload + "." + signature(input.secret, payload).toString("base64url");
}

/** One indistinguishable public error for tamper, expiration, and bad formats. */
export function readInviteToken(input: Readonly<{
  secret: string; token: string; nowSeconds: number;
}>): InviteClaims | null {
  checkSecret(input.secret);
  const { token, nowSeconds } = input;
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0 ||
      typeof token !== "string" || token.length > MAX_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts.every((part) => part && BASE64URL.test(part))) return null;
  const [encoded, signed] = parts;
  if (!encoded || !signed) return null;
  try {
    const sig = Buffer.from(signed, "base64url");
    if (sig.length !== 32 || !timingSafeEqual(sig, signature(input.secret, encoded))) return null;
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded || bytes.length > 600) return null;
    const raw: unknown = JSON.parse(bytes.toString("utf8"));
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const c = raw as Record<string, unknown>;
    if (Object.keys(c).sort().join(",") !== "expiresAt,handle,nonce,tenantId,userId,v") return null;
    if (c.v !== 1 || typeof c.tenantId !== "string" || typeof c.userId !== "string" ||
        typeof c.handle !== "string" || !ID.test(c.tenantId) || !ID.test(c.userId) ||
        !HANDLE.test(c.handle) || typeof c.nonce !== "string" ||
        c.nonce.length !== 22 || !BASE64URL.test(c.nonce) ||
        typeof c.expiresAt !== "number" || !Number.isSafeInteger(c.expiresAt) ||
        c.expiresAt <= nowSeconds || c.expiresAt > nowSeconds + MAX_INVITE_AGE_SECONDS) return null;
    return c as unknown as InviteClaims;
  } catch { return null; }
}

export function inviteUrl(token: string): string {
  const parts = token.split(".");
  if (token.length > MAX_LENGTH || parts.length !== 2 ||
      !parts.every((part) => part && BASE64URL.test(part))) {
    throw new TypeError("Invalid invitation token");
  }
  return "https://masanawa.com/invite/" + encodeURIComponent(token);
}

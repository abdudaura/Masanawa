import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** U11 is a read-only adapter, never an alternative human-message authority. */
export interface SearchScope { readonly tenantId: string; readonly userId: string }
export interface SearchAnchor { readonly createdAtUs: string; readonly messageId: string }
export interface SearchHit extends SearchAnchor {
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly sequence: string;
  readonly body: string;
  readonly editedAt: string | null;
}
export interface SearchPage {
  readonly hits: readonly SearchHit[];
  readonly next: string | null;
}
export interface SearchRepository {
  search(input: SearchScope & {
    readonly text: string;
    readonly conversationId: string | null;
    readonly before: SearchAnchor | null;
    readonly limit: number;
  }): Promise<readonly SearchHit[]>;
}
export class HumanSearchError extends Error {
  constructor(readonly code: "invalid_query" | "invalid_cursor" | "unauthorized" |
    "rate_limited" | "unavailable", readonly status: number) {
    super(code);
    this.name = "HumanSearchError";
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const microtime = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
export interface SearchDependencies {
  /** Existing customer-session authenticator: verifies active token, device, user, tenant. */
  readonly authenticate: (authorizationHeader: string | undefined) => Promise<SearchScope | null>;
  /** Shared persistent tenant/user throttler. No in-process-only fallback. */
  readonly admit: (scope: SearchScope) => Promise<boolean>;
  readonly repository: SearchRepository;
  readonly cursorSecret: Uint8Array;
  readonly clock?: () => number;
}
function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
function hmac(payload: string, secret: Uint8Array): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function normalize(text: unknown): string {
  if (typeof text !== "string") throw new HumanSearchError("invalid_query", 400);
  const q = text.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (Array.from(q).length < 2 || Array.from(q).length > 128 ||
      /[\u0000-\u001f\u007f]/u.test(q)) {
    throw new HumanSearchError("invalid_query", 400);
  }
  return q;
}
function cursorBinding(scope: SearchScope, text: string, conversationId: string | null) {
  return digest(JSON.stringify([scope.tenantId, scope.userId, text, conversationId]));
}
function parseCursor(token: string, binding: string, secret: Uint8Array, now: number): SearchAnchor {
  if (token.length > 800 || token.length < 20) throw new HumanSearchError("invalid_cursor", 400);
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]!) ||
      !/^[A-Za-z0-9_-]+$/.test(parts[1]!)) throw new HumanSearchError("invalid_cursor", 400);
  const signature = Buffer.from(parts[1]!, "base64url");
  const expected = Buffer.from(hmac(parts[0]!, secret), "base64url");
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new HumanSearchError("invalid_cursor", 400);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")); }
  catch { throw new HumanSearchError("invalid_cursor", 400); }
  if (!parsed || typeof parsed !== "object") throw new HumanSearchError("invalid_cursor", 400);
  const v = parsed as Record<string, unknown>;
  if (v.v !== 1 || v.b !== binding || typeof v.e !== "number" ||
      !Number.isSafeInteger(v.e) || v.e <= now || v.e > now + 300_000 ||
      typeof v.t !== "string" || !microtime.test(v.t) || typeof v.m !== "string" ||
      !uuid.test(v.m) || !Number.isFinite(Date.parse(v.t))) {
    throw new HumanSearchError("invalid_cursor", 400);
  }
  return {createdAtUs: v.t, messageId: v.m};
}
function signCursor(anchor: SearchAnchor, binding: string, secret: Uint8Array, now: number) {
  const payload = Buffer.from(JSON.stringify({
    v: 1, b: binding, e: now + 300_000, t: anchor.createdAtUs, m: anchor.messageId,
  })).toString("base64url");
  return payload + "." + hmac(payload, secret);
}
export function createHumanDmSearchService(deps: SearchDependencies) {
  if (deps.cursorSecret.byteLength < 32) throw new Error("U11 cursor key must be >=32 bytes");
  return Object.freeze({
    async search(input: {
      authorizationHeader?: string;
      text: string;
      conversationId?: string;
      limit?: number;
      after?: string;
    }): Promise<SearchPage> {
      // A caller cannot pass account/tenant IDs; both are always resolved from a current session.
      const scope = await deps.authenticate(input.authorizationHeader);
      if (!scope || !scope.tenantId || !scope.userId) {
        throw new HumanSearchError("unauthorized", 401);
      }
      const text = normalize(input.text);
      const conversationId = input.conversationId ?? null;
      if (conversationId !== null && !uuid.test(conversationId)) {
        throw new HumanSearchError("invalid_query", 400);
      }
      const limit = input.limit ?? 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
        throw new HumanSearchError("invalid_query", 400);
      }
      const now = (deps.clock ?? Date.now)();
      const binding = cursorBinding(scope, text, conversationId);
      const before = input.after === undefined ? null :
        parseCursor(input.after, binding, deps.cursorSecret, now);
      let allowed: boolean;
      try { allowed = await deps.admit(scope); }
      catch { throw new HumanSearchError("unavailable", 503); }
      if (!allowed) throw new HumanSearchError("rate_limited", 429);
      let rows: readonly SearchHit[];
      try {
        rows = await deps.repository.search({ ...scope, text, conversationId, before, limit: limit + 1 });
      } catch {
        // Never surface SQL, membership facts or user text to callers/logs.
        throw new HumanSearchError("unavailable", 503);
      }
      // A repository with a faulty limiter must never flood a response.
      const hits = rows.slice(0, limit);
      const last = hits[hits.length - 1];
      return Object.freeze({
        hits: Object.freeze(hits.map(hit => Object.freeze({...hit}))),
        next: rows.length > limit && last ? signCursor(last, binding, deps.cursorSecret, now) : null,
      });
    },
  });
}

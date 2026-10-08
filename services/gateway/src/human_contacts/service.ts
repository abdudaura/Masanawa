import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanContact, HumanContactPolicy, HumanContactPreferences, HumanContactRepository, HumanContactRequest, HumanContactPageAfter } from "./model.js";

export class HumanContactError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "HumanContactError";
  }
}

export interface HumanContactAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<PlatformSessionIdentity>;
}

export interface HumanContactService {
  lookup(input: { authorizationHeader: string | undefined; handle: string }): Promise<HumanContact>;
  ownPreferences(input: { authorizationHeader: string | undefined }): Promise<HumanContactPreferences>;
  updatePreferences(input: { authorizationHeader: string | undefined; policy?: HumanContactPolicy; discoverableByHandle?: boolean }): Promise<HumanContactPreferences>;
  request(input: { authorizationHeader: string | undefined; handle: string }): Promise<{ status: "accepted" | "pending" | "existing" }>;
  respond(input: { authorizationHeader: string | undefined; requesterId: string; requestRevision: string; accept: boolean }): Promise<{ status: "accepted" | "declined" }>;
  list(input: { authorizationHeader: string | undefined; limit?: number }): Promise<{ contacts: readonly HumanContactRequest[] }>;
  page(input: { authorizationHeader: string | undefined; limit?: number; cursor?: string }): Promise<{ contacts: readonly HumanContactRequest[]; nextCursor: string | null }>;
  revoke(input: { authorizationHeader: string | undefined; otherUserId: string }): Promise<{ status: "revoked" }>;
}

const VALID_POLICY: ReadonlySet<string> = new Set(["anyone", "requests", "nobody"]);
function handle(raw: string): string {
  const value = raw.trim().replace(/^@/u, "").toLowerCase();
  if (!/^[a-z0-9_][a-z0-9_.-]{1,39}$/u.test(value)) {
    throw new HumanContactError("messages.handle_invalid", 400);
  }
  return value;
}
function userId(raw: string): string {
  const value = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u.test(value)) {
    throw new HumanContactError("messages.user_id_invalid", 400);
  }
  return value;
}

/** Cursor content is a position only, never a permission grant. Actor and tenant are
 * checked against the freshly-authorized session on every page. */
function contactCursor(tenantId: string, actorId: string, next: HumanContactPageAfter): string {
  return Buffer.from(JSON.stringify([tenantId, actorId, next.updatedAt, next.userId])).toString("base64url");
}
function parseContactCursor(token: string, tenantId: string, actorId: string): HumanContactPageAfter {
  const invalid = () => new HumanContactError("messages.invalid_page_cursor", 400);
  if (token.length < 8 || token.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(token)) throw invalid();
  const raw = Buffer.from(token, "base64url");
  if (raw.length > 768 || raw.toString("base64url") !== token) throw invalid();
  let parsed: unknown;
  try { parsed = JSON.parse(raw.toString("utf8")); } catch { throw invalid(); }
  if (!Array.isArray(parsed) || parsed.length !== 4 ||
      parsed[0] !== tenantId || parsed[1] !== actorId ||
      typeof parsed[2] !== "string" || typeof parsed[3] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(parsed[2]) ||
      !Number.isFinite(Date.parse(parsed[2])) ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/.test(parsed[3])) throw invalid();
  return { updatedAt: parsed[2], userId: parsed[3] };
}

export function createHumanContactService(input: Readonly<{
  repository: HumanContactRepository;
  authorizer: HumanContactAuthorizer;
}>): HumanContactService {
  async function principal(authorizationHeader: string | undefined) {
    const who = await input.authorizer.authorize({ authorizationHeader });
    return { tenantId: who.tenantId, userId: who.userId };
  }
  return Object.freeze<HumanContactService>({
    async lookup({ authorizationHeader, handle: raw }) {
      const who = await principal(authorizationHeader);
      const result = await input.repository.lookup({ tenantId: who.tenantId, viewerId: who.userId, handle: handle(raw) });
      if (!result) throw new HumanContactError("messages.contact_unavailable", 404);
      return result;
    },
    async ownPreferences({ authorizationHeader }) {
      const who = await principal(authorizationHeader);
      return input.repository.getOwnPreferences(who);
    },
    async updatePreferences({ authorizationHeader, policy, discoverableByHandle }) {
      if (policy !== undefined && !VALID_POLICY.has(policy)) throw new HumanContactError("messages.invalid_policy", 400);
      if (discoverableByHandle !== undefined && typeof discoverableByHandle !== "boolean") {
        throw new HumanContactError("messages.invalid_discoverability", 400);
      }
      if (policy === undefined && discoverableByHandle === undefined) {
        throw new HumanContactError("messages.empty_preferences", 400);
      }
      const who = await principal(authorizationHeader);
      return input.repository.setOwnPreferences({ ...who,
        ...(policy !== undefined ? { policy } : {}),
        ...(discoverableByHandle !== undefined ? { discoverableByHandle } : {}),
      });
    },
    async request({ authorizationHeader, handle: raw }) {
      const who = await principal(authorizationHeader);
      const result = await input.repository.request({ tenantId: who.tenantId, requesterId: who.userId, handle: handle(raw) });
      if (result === "unavailable") throw new HumanContactError("messages.contact_unavailable", 404);
      return { status: result };
    },
    async respond({ authorizationHeader, requesterId, requestRevision, accept }) {
      if (typeof requestRevision !== "string" || !/^[1-9][0-9]{0,18}$/.test(requestRevision) ||
          BigInt(requestRevision) > 9223372036854775807n) {
        throw new HumanContactError("messages.invalid_request_revision", 400);
      }
      const who = await principal(authorizationHeader);
      const changed = await input.repository.respond({ tenantId: who.tenantId, recipientId: who.userId, requesterId: userId(requesterId), requestRevision, accept });
      if (!changed) throw new HumanContactError("messages.contact_request_unavailable", 404);
      return { status: accept ? "accepted" : "declined" };
    },
    async revoke({ authorizationHeader, otherUserId }) {
      const who = await principal(authorizationHeader);
      const done = await input.repository.revoke({ tenantId: who.tenantId, actorId: who.userId, otherUserId: userId(otherUserId) });
      if (!done) throw new HumanContactError("messages.contact_request_unavailable", 404);
      return { status: "revoked" };
    },
    async page({ authorizationHeader, limit, cursor }) {
      const who = await principal(authorizationHeader);
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
        throw new HumanContactError("messages.invalid_page_limit", 400);
      }
      if (cursor !== undefined && typeof cursor !== "string") {
        throw new HumanContactError("messages.invalid_page_cursor", 400);
      }
      const after = cursor === undefined ? null : parseContactCursor(cursor, who.tenantId, who.userId);
      if (!input.repository.listPage) throw new HumanContactError("messages.pagination_unavailable", 503);
      const result = await input.repository.listPage({ ...who, limit: limit ?? 50, after });
      return {
        contacts: result.contacts,
        nextCursor: result.next ? contactCursor(who.tenantId, who.userId, result.next) : null,
      };
    },
    async list({ authorizationHeader, limit }) {
      const who = await principal(authorizationHeader);
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
        throw new HumanContactError("messages.invalid_page_limit", 400);
      }
      return { contacts: await input.repository.list({ ...who, limit: limit ?? 30 }) };
    },
  });
}



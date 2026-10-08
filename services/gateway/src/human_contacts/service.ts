import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanContact, HumanContactPolicy, HumanContactPreferences, HumanContactRepository, HumanContactRequest } from "./model.js";

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
    async list({ authorizationHeader, limit }) {
      const who = await principal(authorizationHeader);
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
        throw new HumanContactError("messages.invalid_page_limit", 400);
      }
      return { contacts: await input.repository.list({ ...who, limit: limit ?? 30 }) };
    },
  });
}

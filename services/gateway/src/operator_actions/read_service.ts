/**
 * U04: authenticated, bounded READ side of the U01 operator catalog.
 *
 * Intentionally no route registration, approval issuer, wallet command, or generic
 * "execute" callback. The result of U01.authorizeOperatorProposal is accepted
 * structurally because U01's package is still an unmerged draft on main.
 * Composition MUST use that function, not model-supplied objects.
 */
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { AgentDirectoryService } from "../agent_directory.js";
import type { TalkService } from "../talks/service.js";
import type { TalkLibraryService } from "../talk_library/service.js";
import type { TalkProfileService } from "../talk_profiles/service.js";
import type { BillingWalletService } from "../billing_wallet.js";

export const U04_READ_CONTRACT_VERSION = 1 as const;

export type U04ReadCapability =
  | "accounts.me.read"
  | "agents.directory.read"
  | "talks.discover"
  | "talks.detail.read"
  | "talks.mine.read"
  | "settings.profile.read"
  | "wallet.balance.read";

export type U04Principal = Readonly<{
  tenantId: string;
  userId: string;
  accountId: string;
  sessionId: string;
  deviceId: string;
}>;

/**
 * Precisely the U01 authorizeOperatorProposal returned shape needed here.
 * The caller must use U01's server-side validation and predicates beforehand.
 * Never populate this from a client JSON body or an AI model response.
 */
export type U04AuthorizedRead = Readonly<{
  capability: Readonly<{
    id: string;
    version: number;
    enabled: boolean;
    executionClass: string;
    argumentKeys: readonly string[];
  }>;
  classification: string;
  arguments: Readonly<Record<string, unknown>>;
  contextRef: Readonly<{ kind: string; id: string; revision?: string }> | null;
  requestId: string;
}>;

export class U04ReadError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "U04ReadError";
  }
}
const failure = (code: string, statusCode: number): never => { throw new U04ReadError(code, statusCode); };
const unavailable = (): never => failure("OPERATOR_NOT_QUALIFIED", 503);

type ReadSpec = Readonly<{ keys: readonly string[]; context: "none" | "talk"; cost: number }>;
const specs: Readonly<Record<U04ReadCapability, ReadSpec>> = Object.freeze({
  "accounts.me.read": { keys: [], context: "none", cost: 1 },
  "agents.directory.read": { keys: [], context: "none", cost: 2 },
  "talks.discover": { keys: ["feed", "limit"], context: "none", cost: 3 },
  "talks.detail.read": { keys: ["talkId"], context: "talk", cost: 2 },
  "talks.mine.read": { keys: [], context: "none", cost: 2 },
  "settings.profile.read": { keys: [], context: "none", cost: 1 },
  "wallet.balance.read": { keys: [], context: "none", cost: 3 },
});

/** U01 catalog composer chooses actual enabled scopes/regions; this is ONLY a
 * list of wired domain readers. It is never a permission/eligibility decision. */
export function availableU04ReadCapabilities(input: U04Dependencies): readonly U04ReadCapability[] {
  return Object.freeze((Object.keys(specs) as U04ReadCapability[]).filter(id =>
    id === "accounts.me.read" ||
    (id === "agents.directory.read" && !!input.agents) ||
    ((id === "talks.discover" || id === "talks.detail.read") && !!input.talks) ||
    (id === "talks.mine.read" && !!input.library) ||
    (id === "settings.profile.read" && !!input.profiles) ||
    (id === "wallet.balance.read" && !!input.wallet)
  ));
}

export interface U04Dependencies {
  /** Current, real platform access-token authorizer. No trusted client identity. */
  readonly sessions: Readonly<{
    authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<PlatformSessionIdentity>;
  }>;
  /** Mandatory U01 principal/session/device/account binding. Fail closed if absent.
   * Must recheck token revocation and current account at the time of the call. */
  readonly bindSession: (input: Readonly<{
    authorizationHeader: string;
    principal: U04Principal;
    identity: PlatformSessionIdentity;
  }>) => Promise<boolean>;
  /** Durable/user-scoped quota authority; reject when unavailable. No local-only limits. */
  readonly quota: Readonly<{
    consume(input: Readonly<{
      tenantId: string; userId: string; capabilityId: U04ReadCapability;
      requestId: string; cost: number;
    }>): Promise<boolean>;
  }>;
  /** Privacy-safe audit sink (NO raw arguments, auth headers, phone numbers or balances). */
  readonly audit: Readonly<{
    append(input: Readonly<{
      tenantId: string; userId: string; capabilityId: U04ReadCapability;
      requestId: string; status: "succeeded" | "failed"; code: string;
    }>): Promise<void>;
  }>;
  readonly agents?: Pick<AgentDirectoryService, "list">;
  readonly talks?: Pick<TalkService, "list" | "detail">;
  readonly library?: Pick<TalkLibraryService, "myTalks">;
  readonly profiles?: Pick<TalkProfileService, "self">;
  readonly wallet?: Pick<BillingWalletService, "balance">;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export interface U04ReadResult {
  readonly capabilityId: U04ReadCapability;
  readonly contractVersion: 1;
  readonly requestId: string;
  /** Authoritative domain projection, NOT an AI-generated receipt. */
  readonly data: unknown;
  readonly readAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function validatedArguments(value: unknown, spec: ReadSpec): Readonly<Record<string, unknown>> {
  if (!isObject(value) || Object.keys(value).length > 6) return failure("OPERATOR_INVALID_ARGUMENTS", 400);
  for (const key of Object.keys(value)) {
    if (!spec.keys.includes(key) || key === "__proto__" || key === "constructor" || key === "prototype") {
      return failure("OPERATOR_INVALID_ARGUMENTS", 400);
    }
  }
  return value;
}

function exactString(value: unknown, max: number): string {
  if (typeof value !== "string" || !value || value.trim() !== value || value.length > max ||
      /[\u0000-\u001f\u007f]/u.test(value)) return failure("OPERATOR_INVALID_ARGUMENTS", 400);
  return value;
}

function normalizeFailure(error: unknown): U04ReadError {
  if (error instanceof U04ReadError) return error;
  const status = error !== null && typeof error === "object" && "statusCode" in error
    ? (error as { statusCode: unknown }).statusCode : null;
  if (status === 401) return new U04ReadError("OPERATOR_UNAUTHORIZED", 401);
  if (status === 403) return new U04ReadError("OPERATOR_FORBIDDEN", 403);
  if (status === 404) return new U04ReadError("OPERATOR_NOT_FOUND", 404);
  if (status === 429) return new U04ReadError("OPERATOR_RATE_LIMITED", 429);
  return new U04ReadError("OPERATOR_SOURCE_UNAVAILABLE", 503);
}

async function timeoutRead<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new U04ReadError("OPERATOR_SOURCE_TIMEOUT", 504)), ms);
  });
  try { return await Promise.race([operation, deadline]); }
  finally { if (timer) clearTimeout(timer); }
}

export function createU04ReadService(input: U04Dependencies): Readonly<{
  read(request: Readonly<{
    authorizationHeader: string | undefined;
    principal: U04Principal;
    authorized: U04AuthorizedRead;
  }>): Promise<U04ReadResult>;
}> {
  if (!input.sessions || !input.bindSession || !input.quota || !input.audit) {
    return unavailable();
  }
  const clock = input.now ?? (() => new Date());
  const timeoutMs = input.timeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30_000) {
    return failure("OPERATOR_INVALID_CONFIGURATION", 500);
  }
  const available = new Set(availableU04ReadCapabilities(input));

  return Object.freeze({
    async read(request) {
      // No untrusted model text, client role, or ability to invoke writes reaches
      // a downstream domain until U01 has produced an authorized typed action.
      const action = request.authorized;
      const capabilityId = action?.capability?.id as U04ReadCapability;
      if (!Object.hasOwn(specs, capabilityId) || !available.has(capabilityId) ||
          action?.capability?.version !== U04_READ_CONTRACT_VERSION ||
          action.capability.enabled !== true || action.classification !== "read" ||
          action.capability.executionClass !== "read" ||
          !Array.isArray(action.capability.argumentKeys) ||
          typeof action.requestId !== "string" ||
          !/^request_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(action.requestId)) {
        return unavailable();
      }
      const spec = specs[capabilityId];
      const args = validatedArguments(action.arguments, spec);
      if (spec.context === "none" && action.contextRef !== null && action.contextRef !== undefined) {
        return failure("OPERATOR_CONTEXT_NOT_AUTHORIZED", 403);
      }
      if (spec.context === "talk" && action.contextRef &&
          (action.contextRef.kind !== "talk" || action.contextRef.id !== args.talkId)) {
        return failure("OPERATOR_CONTEXT_NOT_AUTHORIZED", 403);
      }
      const principal = request.principal;
      if (!principal || ![principal.tenantId, principal.userId, principal.accountId,
          principal.sessionId, principal.deviceId].every(s => typeof s === "string" && s.length > 0) ||
          !request.authorizationHeader?.startsWith("Bearer ")) {
        return failure("OPERATOR_UNAUTHORIZED", 401);
      }
      // Read both the platform identity AND the U01 device/session binding.
      // A valid bearer token for a different account is insufficient.
      let identity: PlatformSessionIdentity;
      try {
        identity = await timeoutRead(input.sessions.authorize({ authorizationHeader: request.authorizationHeader }), timeoutMs);
        if (identity.tenantId !== principal.tenantId || identity.userId !== principal.userId ||
            !(await timeoutRead(input.bindSession({
              authorizationHeader: request.authorizationHeader, principal, identity,
            }), timeoutMs))) return failure("OPERATOR_UNAUTHORIZED", 401);
      } catch (error) { throw normalizeFailure(error); }

      // Invalid arguments fail before quota or service dispatch.
      const feed = capabilityId === "talks.discover"
        ? (args.feed === undefined ? "explore" : args.feed) : null;
      if (capabilityId === "talks.discover" && feed !== "explore" && feed !== "live") {
        return failure("OPERATOR_INVALID_ARGUMENTS", 400);
      }
      const limit = capabilityId === "talks.discover" ? (args.limit ?? 20) : 0;
      if (capabilityId === "talks.discover" &&
          (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 30)) {
        return failure("OPERATOR_INVALID_ARGUMENTS", 400);
      }
      const talkId = capabilityId === "talks.detail.read"
        ? exactString(args.talkId, 128) : null;
      if (capabilityId === "talks.detail.read" && (!talkId || talkId.length < 8)) {
        return failure("OPERATOR_INVALID_ARGUMENTS", 400);
      }

      let status: "succeeded" | "failed" = "failed";
      let code = "OPERATOR_SOURCE_UNAVAILABLE";
      try {
        if (!(await timeoutRead(input.quota.consume({
          tenantId: identity.tenantId, userId: identity.userId,
          capabilityId, requestId: action.requestId, cost: spec.cost,
        }), timeoutMs))) return failure("OPERATOR_RATE_LIMITED", 429);

        // These canonical services authenticate AGAIN and enforce owner,
        // membership, tenant and visibility at their repository boundaries.
        const header = request.authorizationHeader;
        let data: unknown;
        switch (capabilityId) {
          case "accounts.me.read":
            data = Object.freeze({ displayName: identity.profile.name, locale: identity.profile.locale });
            break;
          case "agents.directory.read":
            data = Object.freeze((await timeoutRead(input.agents!.list({
              authorizationHeader: header,
            }), timeoutMs)).slice(0, 50));
            break;
          case "talks.discover":
            data = Object.freeze((await timeoutRead(input.talks!.list({
              authorizationHeader: header, feed: feed as "explore" | "live",
            }), timeoutMs)).slice(0, limit as number));
            break;
          case "talks.detail.read": {
            const detail = await timeoutRead(input.talks!.detail({
              authorizationHeader: header, talkId: talkId!,
            }), timeoutMs);
            // Do not import arbitrary public comments into private AI context.
            data = detail.talk;
            break;
          }
          case "talks.mine.read": {
            const owned = await timeoutRead(input.library!.myTalks({
              authorizationHeader: header,
            }), timeoutMs);
            data = Object.freeze({ live: owned.live.slice(0, 25), replays: owned.replays.slice(0, 25) });
            break;
          }
          case "settings.profile.read": {
            const own = await timeoutRead(input.profiles!.self({
              authorizationHeader: header,
            }), timeoutMs);
            data = Object.freeze({ handle: own.handle, displayName: own.displayName,
              bio: own.bio, avatarUrl: own.avatarUrl });
            break;
          }
          case "wallet.balance.read": {
            const balance = await timeoutRead(input.wallet!.balance({
              authorizationHeader: header,
            }), timeoutMs);
            if (!Number.isSafeInteger(balance.balanceKobo) || balance.balanceKobo < 0 ||
                typeof balance.balance !== "string" || balance.balance.length > 80) {
              return failure("OPERATOR_SOURCE_UNAVAILABLE", 503);
            }
            data = Object.freeze({ balanceKobo: balance.balanceKobo, balance: balance.balance });
            break;
          }
          default:
            return unavailable();
        }
        // Re-check a potentially revoked access session AFTER the domain read.
        // A slow request started by account A must never return A's private
        // wallet/profile data after logout or a switch to account B.
        const latest = await timeoutRead(input.sessions.authorize({
          authorizationHeader: header,
        }), timeoutMs);
        if (latest.tenantId !== principal.tenantId || latest.userId !== principal.userId ||
            !(await timeoutRead(input.bindSession({
              authorizationHeader: header, principal, identity: latest,
            }), timeoutMs))) {
          return failure("OPERATOR_UNAUTHORIZED", 401);
        }
        const readAt = clock().toISOString();
        status = "succeeded"; code = "OPERATOR_READ_OK";
        return Object.freeze({ capabilityId, contractVersion: 1 as const,
          requestId: action.requestId, data, readAt });
      } catch (error) {
        const failure = normalizeFailure(error);
        code = failure.code;
        throw failure;
      } finally {
        try {
          await timeoutRead(input.audit.append({ tenantId: identity.tenantId, userId: identity.userId,
            capabilityId, requestId: action.requestId, status, code }), timeoutMs);
        } catch {
          // Read-only responses are suppressed when mandatory audit fails.
          // A read may have completed but no irreversible effect was performed.
          throw new U04ReadError("OPERATOR_AUDIT_UNAVAILABLE", 503);
        }
        // The audit sink is asynchronous too. Revocation during that write
        // must suppress the already-computed return value before it escapes.
        // Audit success records the domain read; a later fence rejection adds
        // a failure event without including private output.
        if (status === "succeeded") {
          try {
            const latest = await timeoutRead(input.sessions.authorize({
              authorizationHeader: request.authorizationHeader,
            }), timeoutMs);
            if (latest.tenantId !== principal.tenantId || latest.userId !== principal.userId ||
                !(await timeoutRead(input.bindSession({
                  authorizationHeader: request.authorizationHeader, principal, identity: latest,
                }), timeoutMs))) {
              failure("OPERATOR_UNAUTHORIZED", 401);
            }
          } catch (error) {
            const rejected = normalizeFailure(error);
            try {
              await timeoutRead(input.audit.append({ tenantId: identity.tenantId, userId: identity.userId,
                capabilityId, requestId: action.requestId, status: "failed", code: rejected.code }), timeoutMs);
            } catch {
              throw new U04ReadError("OPERATOR_AUDIT_UNAVAILABLE", 503);
            }
            throw rejected;
          }
        }
      }
    },
  });
}

/** U02 write execution must NOT be exposed until it can durably recover the
 * exact arguments, user approval terms, idempotency key and canonical readback.
 * In particular Talks.create currently allocates a fresh random UUID and
 * cannot safely be retried from an uncertain operator outcome. */
export function requireU04WriteQualification(_capabilityId: string): never {
  return unavailable();
}


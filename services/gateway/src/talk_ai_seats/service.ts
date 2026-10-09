import type { TalkAiRuntimeDispatcher } from "../talk_ai_worker/livekit_dispatch.js";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  TalkAiSeatCandidateView,
  TalkAiSeatConfirmView,
  TalkAiSeatPricingPolicy,
  TalkAiSeatQuoteView,
  TalkAiSeatRepository,
} from "./model.js";

export interface TalkAiSeatAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkAiSeatError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkAiSeatError";
  }
}

export interface TalkAiSeatHostBridge {
  sweep(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<void>;
  decide(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    requestId: string;
    action: "accept" | "decline";
  }>): Promise<Readonly<{ handled: boolean }>>;
}

export interface TalkAiSeatService extends TalkAiSeatHostBridge {
  candidates(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<readonly TalkAiSeatCandidateView[]>;
  quote(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    personaId: string;
    mode: "host_add" | "sponsor";
  }>): Promise<TalkAiSeatQuoteView>;
  confirm(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    quoteId: string;
  }>): Promise<TalkAiSeatConfirmView>;
}

function bounded(value: string, label: string, max = 160): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TalkAiSeatError(`talks.${label}_invalid`, 400);
  }
  return normalized;
}

function integer(value: number, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function normalizePolicy(policy: TalkAiSeatPricingPolicy): TalkAiSeatPricingPolicy {
  const normalized = Object.freeze({
    expertPriceCredits: integer(
      policy.expertPriceCredits,
      "expertPriceCredits",
      1,
      1_000_000_000,
    ),
    twinPriceCredits: integer(
      policy.twinPriceCredits,
      "twinPriceCredits",
      1,
      1_000_000_000,
    ),
    hostShareBasisPoints: integer(
      policy.hostShareBasisPoints,
      "hostShareBasisPoints",
      0,
      10_000,
    ),
    twinOwnerShareBasisPoints: integer(
      policy.twinOwnerShareBasisPoints,
      "twinOwnerShareBasisPoints",
      0,
      10_000,
    ),
    quoteTtlSeconds: integer(
      policy.quoteTtlSeconds,
      "quoteTtlSeconds",
      15,
      3600,
    ),
  });
  if (
    normalized.hostShareBasisPoints +
      normalized.twinOwnerShareBasisPoints >
    10_000
  ) {
    throw new TypeError("Talk AI Seat shares exceed 100%");
  }
  return normalized;
}

function priceFor(
  kind: "expert" | "twin",
  policy: TalkAiSeatPricingPolicy,
): number {
  return kind === "expert"
    ? policy.expertPriceCredits
    : policy.twinPriceCredits;
}

/**
 * Only explicit public domain failures may cross the HTTP boundary. PostgreSQL,
 * commerce adapters and background dispatchers may throw errors containing SQL,
 * connection details or provider payloads; never turn arbitrary error.message or
 * error.code into a customer-visible error or infer status from substrings.
 *
 * Keep existing canonical codes where possible. Internal revision messages are
 * deliberately converted to stable machine codes without exposing raw text.
 */
const PUBLIC_REPOSITORY_FAILURES: Readonly<
  Record<string, Readonly<{ code: string; statusCode: number }>>
> = Object.freeze({
  "talks.not_found": { code: "talks.not_found", statusCode: 404 },
  "talks.persona_not_found": { code: "talks.persona_not_found", statusCode: 404 },
  "talks.ai_seat_quote_not_found": { code: "talks.ai_seat_quote_not_found", statusCode: 404 },
  "talks.host_forbidden": { code: "talks.host_forbidden", statusCode: 403 },
  "commerce.insufficient_balance": { code: "commerce.insufficient_balance", statusCode: 409 },
  "talks.not_live": { code: "talks.not_live", statusCode: 409 },
  "talks.persona_unavailable": { code: "talks.persona_unavailable", statusCode: 409 },
  "talks.canonical_missing": { code: "talks.canonical_missing", statusCode: 409 },
  "talks.host_identity_changed": { code: "talks.host_identity_changed", statusCode: 409 },
  "talks.ai_commerce_required": { code: "talks.ai_commerce_required", statusCode: 503 },
  "AI Seat quote revision conflict": { code: "talks.ai_seat_quote_revision_conflict", statusCode: 409 },
  "Talk live revision conflict": { code: "talks.live_revision_conflict", statusCode: 409 },
});

function mapRepositoryError(error: unknown): never {
  // Service-created errors (validated request and runtime dispatch) already
  // have explicit public codes. All repository/provider errors are untrusted.
  if (error instanceof TalkAiSeatError) throw error;

  const externalCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;
  const externalMessage = error instanceof Error ? error.message : undefined;
  for (const key of [externalCode, externalMessage]) {
    if (key === undefined || !Object.hasOwn(PUBLIC_REPOSITORY_FAILURES, key)) {
      continue;
    }
    const failure = PUBLIC_REPOSITORY_FAILURES[key];
    throw new TalkAiSeatError(failure.code, failure.statusCode);
  }

  // Unknown SQLSTATEs, provider errors and free-form messages are operational
  // failures, not malformed customer requests. The response is intentionally
  // opaque and retryable; retain the original cause only in private telemetry.
  throw new TalkAiSeatError("talks.ai_seat_failed", 503);
}

function message(
  status: TalkAiSeatConfirmView["status"],
  displayName: string,
): string {
  switch (status) {
    case "pending_host":
      return `${displayName} is waiting for the Host to accept the sponsored Seat.`;
    case "admitted":
      return `${displayName} has joined the Talk.`;
    case "declined":
      return `${displayName} was not admitted. Your held Credits were released.`;
    case "expired":
      return `The Seat request expired. Any held Credits were released.`;
  }
}

export function createTalkAiSeatService(input: Readonly<{
  repository: TalkAiSeatRepository;
  authorizer: TalkAiSeatAuthorizer;
  pricing: TalkAiSeatPricingPolicy;
  runtimeDispatcher?: TalkAiRuntimeDispatcher;
  now?: () => string;
}>): TalkAiSeatService {
  const pricing = normalizePolicy(input.pricing);
  const now = input.now ?? (() => new Date().toISOString());

  async function identity(
    authorizationHeader: string | undefined,
  ): Promise<PlatformSessionIdentity> {
    return input.authorizer.authorize({ authorizationHeader });
  }

  async function dispatchIfAdmitted(request: Readonly<{
    tenantId: string;
    talkId: string;
    requestId: string;
    status: TalkAiSeatConfirmView["status"] | undefined;
  }>): Promise<void> {
    if (request.status !== "admitted" || !input.runtimeDispatcher) return;
    const seat = await input.repository.readRuntimeSeat({
      tenantId: request.tenantId,
      talkId: request.talkId,
      requestId: request.requestId,
    });
    if (!seat) throw new TalkAiSeatError("talks.ai_runtime_seat_missing", 409);
    try {
      await input.runtimeDispatcher.dispatch(seat);
    } catch (error) {
      if (error instanceof TalkAiSeatError) throw error;
      throw new TalkAiSeatError("talks.ai_runtime_unavailable", 503);
    }
  }

  return Object.freeze<TalkAiSeatService>({
    async candidates(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = bounded(request.talkId, "talk_id");
      const rows = await (async () => {
        try {
          await input.repository.sweepExpired({
            tenantId: viewer.tenantId,
            talkId,
            now: now(),
            limit: 50,
          });
          return await input.repository.listCandidates({
            tenantId: viewer.tenantId,
            talkId,
          });
        } catch (error) {
          return mapRepositoryError(error);
        }
      })();
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            personaId: row.personaId,
            displayName: row.displayName,
            kind: row.kind,
            seatFeeLabel: `${priceFor(row.kind, pricing)} Credits`,
            ...(row.subtitle === null ? {} : { subtitle: row.subtitle }),
            ...(row.avatarUrl === null ? {} : { avatarUrl: row.avatarUrl }),
            topics: row.topics,
            isAvailable: row.isAvailable,
            isOwnedByViewer: row.kind === "twin" &&
              row.twinOwnerUserId === viewer.userId,
          }),
        ),
      );
    },

    async quote(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = bounded(request.talkId, "talk_id");
      const personaId = bounded(request.personaId, "persona_id");
      try {
        const created = await input.repository.createQuote({
          tenantId: viewer.tenantId,
          talkId,
          personaId,
          mode: request.mode,
          payerUserId: viewer.userId,
          pricing,
          now: now(),
        });
        return Object.freeze({
          quoteId: created.quote.quoteId,
          personaId: created.quote.personaId,
          displayName: created.displayName,
          kind: created.quote.personaKind,
          mode: created.quote.mode,
          totalLabel: `${created.quote.priceCredits} Credits`,
          expiresAt: created.quote.expiresAt,
          requiresHostApproval: created.quote.mode === "sponsor",
        });
      } catch (error) {
        return mapRepositoryError(error);
      }
    },

    async confirm(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        const talkId = bounded(request.talkId, "talk_id");
        const result = await input.repository.confirm({
          tenantId: viewer.tenantId,
          payerUserId: viewer.userId,
          talkId,
          quoteId: bounded(request.quoteId, "quote_id"),
          now: now(),
        });
        await dispatchIfAdmitted({
          tenantId: viewer.tenantId,
          talkId,
          requestId: result.requestId,
          status: result.status,
        });
        return Object.freeze({
          requestId: result.requestId,
          status: result.status,
          message: message(result.status, result.displayName),
        });
      } catch (error) {
        return mapRepositoryError(error);
      }
    },

    async sweep(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        await input.repository.sweepExpired({
          tenantId: viewer.tenantId,
          talkId: bounded(request.talkId, "talk_id"),
          now: now(),
          limit: 50,
        });
      } catch (error) {
        mapRepositoryError(error);
      }
    },

    async decide(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        const talkId = bounded(request.talkId, "talk_id");
        const requestId = bounded(request.requestId, "request_id");
        const result = await input.repository.hostDecision({
          tenantId: viewer.tenantId,
          hostUserId: viewer.userId,
          talkId,
          requestId,
          action: request.action,
          now: now(),
        });
        await dispatchIfAdmitted({
          tenantId: viewer.tenantId,
          talkId,
          requestId,
          status: result.status,
        });
        return Object.freeze({ handled: result.handled });
      } catch (error) {
        return mapRepositoryError(error);
      }
    },
  });
}

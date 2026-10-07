import {
  isCanonicalId,
  parseCanonicalId,
  toInstant,
  type Instant,
  type QuoteId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type TalkAiSeatMode = "host_add" | "sponsor";
export type TalkAiSeatPersonaKind = "expert" | "twin";
export type TalkAiSeatState =
  | "quoted"
  | "pending_admission"
  | "pending_host"
  | "admitted"
  | "declined"
  | "expired";

export interface TalkAiSeatQuote {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly quoteId: QuoteId;
  readonly talkId: string;
  readonly personaId: string;
  readonly personaKind: TalkAiSeatPersonaKind;
  readonly mode: TalkAiSeatMode;
  readonly payerUserId: UserId;
  readonly hostUserId: UserId;
  readonly twinOwnerUserId: UserId | null;
  readonly priceCredits: number;
  readonly hostShareCredits: number;
  readonly twinOwnerShareCredits: number;
  readonly platformShareCredits: number;
  readonly state: TalkAiSeatState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly expiresAt: Instant;
  readonly admittedAt: Instant | null;
  readonly declinedAt: Instant | null;
  readonly expiredAt: Instant | null;
}

export interface CreateTalkAiSeatQuoteInput {
  readonly tenantId: TenantId;
  readonly quoteId: QuoteId;
  readonly talkId: string;
  readonly personaId: string;
  readonly personaKind: TalkAiSeatPersonaKind;
  readonly mode: TalkAiSeatMode;
  readonly payerUserId: UserId;
  readonly hostUserId: UserId;
  readonly twinOwnerUserId: UserId | null;
  readonly priceCredits: number;
  readonly hostShareCredits: number;
  readonly twinOwnerShareCredits: number;
  readonly platformShareCredits: number;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
}

export type TalkAiSeatCommand =
  | {
      readonly type: "confirm";
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly actorUserId: UserId;
    }
  | {
      readonly type: "admit";
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly actorUserId: UserId;
    }
  | {
      readonly type: "decline";
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly actorUserId: UserId;
    }
  | {
      readonly type: "expire";
      readonly requestId: string;
      readonly expectedRevision: number;
    };

export type TalkAiSeatSettlementInstruction =
  | Readonly<{
      kind: "hold";
      idempotencyKey: string;
      quoteId: QuoteId;
      payerUserId: UserId;
      amountCredits: number;
    }>
  | Readonly<{
      kind: "capture";
      idempotencyKey: string;
      quoteId: QuoteId;
      payerUserId: UserId;
      amountCredits: number;
      hostUserId: UserId;
      hostShareCredits: number;
      twinOwnerUserId: UserId | null;
      twinOwnerShareCredits: number;
      platformShareCredits: number;
    }>
  | Readonly<{
      kind: "release";
      idempotencyKey: string;
      quoteId: QuoteId;
      payerUserId: UserId;
      amountCredits: number;
      reason: "declined" | "expired";
    }>;

export interface TalkAiSeatTransition {
  readonly quote: TalkAiSeatQuote;
  readonly settlement: TalkAiSeatSettlementInstruction | null;
  readonly event: Readonly<{
    schemaVersion: 1;
    tenantId: TenantId;
    talkId: string;
    quoteId: QuoteId;
    type: TalkAiSeatCommand["type"];
    requestId: string;
    revision: number;
    occurredAt: Instant;
  }>;
}

function text(value: string, name: string, max = 256): string {
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function credits(value: number, name: string, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000_000_000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("AI Seat quote revision is invalid");
  }
  return value;
}

function requestId(value: string): string {
  return text(value, "requestId", 256);
}

function holdKey(quoteId: QuoteId): string {
  return `talk-ai-seat:hold:${quoteId}`;
}

function captureKey(quoteId: QuoteId): string {
  return `talk-ai-seat:capture:${quoteId}`;
}

function releaseKey(quoteId: QuoteId): string {
  return `talk-ai-seat:release:${quoteId}`;
}

function assertEconomics(input: {
  readonly personaKind: TalkAiSeatPersonaKind;
  readonly twinOwnerUserId: UserId | null;
  readonly priceCredits: number;
  readonly hostShareCredits: number;
  readonly twinOwnerShareCredits: number;
  readonly platformShareCredits: number;
}): void {
  const price = credits(input.priceCredits, "priceCredits", false);
  const host = credits(input.hostShareCredits, "hostShareCredits");
  const owner = credits(input.twinOwnerShareCredits, "twinOwnerShareCredits");
  const platform = credits(input.platformShareCredits, "platformShareCredits");
  if (host + owner + platform !== price) {
    throw new RangeError("AI Seat quote shares must sum exactly to priceCredits");
  }
  if (input.personaKind === "expert") {
    if (input.twinOwnerUserId !== null || owner !== 0) {
      throw new TypeError("Expert AI Seat cannot allocate a Twin owner share");
    }
  } else if (input.twinOwnerUserId === null) {
    throw new TypeError("Twin AI Seat requires twinOwnerUserId");
  }
}

function assertRoleSemantics(input: {
  readonly mode: TalkAiSeatMode;
  readonly payerUserId: UserId;
  readonly hostUserId: UserId;
}): void {
  if (input.mode === "host_add" && input.payerUserId !== input.hostUserId) {
    throw new TypeError("host_add payer must be the Talk Host");
  }
  if (input.mode === "sponsor" && input.payerUserId === input.hostUserId) {
    throw new TypeError("Sponsor payer must be an audience user");
  }
}

export function createTalkAiSeatQuote(input: CreateTalkAiSeatQuoteInput): TalkAiSeatQuote {
  if (!isCanonicalId("quote", input.quoteId)) throw new TypeError("quoteId is invalid");
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const payerUserId = parseCanonicalId("user", input.payerUserId);
  const hostUserId = parseCanonicalId("user", input.hostUserId);
  const twinOwnerUserId =
    input.twinOwnerUserId === null ? null : parseCanonicalId("user", input.twinOwnerUserId);
  if (input.personaKind !== "expert" && input.personaKind !== "twin") {
    throw new TypeError("AI Seat personaKind is invalid");
  }
  if (input.mode !== "host_add" && input.mode !== "sponsor") {
    throw new TypeError("AI Seat mode is invalid");
  }
  assertRoleSemantics({ mode: input.mode, payerUserId, hostUserId });
  assertEconomics({
    personaKind: input.personaKind,
    twinOwnerUserId,
    priceCredits: input.priceCredits,
    hostShareCredits: input.hostShareCredits,
    twinOwnerShareCredits: input.twinOwnerShareCredits,
    platformShareCredits: input.platformShareCredits,
  });
  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  if (expiresAt <= createdAt) throw new RangeError("AI Seat quote expiry must be after creation");

  const quote: TalkAiSeatQuote = Object.freeze({
    schemaVersion: 1,
    tenantId,
    quoteId: input.quoteId,
    talkId: text(input.talkId, "talkId"),
    personaId: text(input.personaId, "personaId"),
    personaKind: input.personaKind,
    mode: input.mode,
    payerUserId,
    hostUserId,
    twinOwnerUserId,
    priceCredits: credits(input.priceCredits, "priceCredits", false),
    hostShareCredits: credits(input.hostShareCredits, "hostShareCredits"),
    twinOwnerShareCredits: credits(input.twinOwnerShareCredits, "twinOwnerShareCredits"),
    platformShareCredits: credits(input.platformShareCredits, "platformShareCredits"),
    state: "quoted",
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    admittedAt: null,
    declinedAt: null,
    expiredAt: null,
  });
  assertTalkAiSeatQuote(quote);
  return quote;
}

export function assertTalkAiSeatQuote(quote: TalkAiSeatQuote): void {
  if (quote.schemaVersion !== 1) throw new TypeError("Unsupported AI Seat quote schema");
  if (!isCanonicalId("quote", quote.quoteId)) throw new TypeError("quoteId is invalid");
  parseCanonicalId("tenant", quote.tenantId);
  parseCanonicalId("user", quote.payerUserId);
  parseCanonicalId("user", quote.hostUserId);
  if (quote.twinOwnerUserId !== null) parseCanonicalId("user", quote.twinOwnerUserId);
  text(quote.talkId, "talkId");
  text(quote.personaId, "personaId");
  revision(quote.revision);
  if (!["expert", "twin"].includes(quote.personaKind)) throw new TypeError("AI Seat personaKind is invalid");
  if (!["host_add", "sponsor"].includes(quote.mode)) throw new TypeError("AI Seat mode is invalid");
  if (!["quoted", "pending_admission", "pending_host", "admitted", "declined", "expired"].includes(quote.state)) {
    throw new TypeError("AI Seat state is invalid");
  }
  assertRoleSemantics(quote);
  assertEconomics(quote);
  const createdAt = toInstant(quote.createdAt);
  const updatedAt = toInstant(quote.updatedAt);
  const expiresAt = toInstant(quote.expiresAt);
  if (updatedAt < createdAt || expiresAt <= createdAt) {
    throw new TypeError("AI Seat quote timestamps are inconsistent");
  }

  if (quote.state === "admitted") {
    if (quote.admittedAt === null || toInstant(quote.admittedAt) !== updatedAt ||
        quote.declinedAt !== null || quote.expiredAt !== null) {
      throw new TypeError("Admitted AI Seat lifecycle is inconsistent");
    }
  } else if (quote.state === "declined") {
    if (quote.declinedAt === null || toInstant(quote.declinedAt) !== updatedAt ||
        quote.admittedAt !== null || quote.expiredAt !== null) {
      throw new TypeError("Declined AI Seat lifecycle is inconsistent");
    }
  } else if (quote.state === "expired") {
    if (quote.expiredAt === null || toInstant(quote.expiredAt) !== updatedAt ||
        quote.admittedAt !== null || quote.declinedAt !== null) {
      throw new TypeError("Expired AI Seat lifecycle is inconsistent");
    }
  } else if (quote.admittedAt !== null || quote.declinedAt !== null || quote.expiredAt !== null) {
    throw new TypeError("Pending AI Seat lifecycle cannot contain terminal timestamps");
  }

  if (quote.state === "pending_host" && quote.mode !== "sponsor") {
    throw new TypeError("Only sponsored AI Seats can await Host approval");
  }
  if (quote.state === "pending_admission" && quote.mode !== "host_add") {
    throw new TypeError("Only Host-added AI Seats can await direct admission");
  }
}

function event(
  quote: TalkAiSeatQuote,
  type: TalkAiSeatCommand["type"],
  id: string,
  at: Instant,
): TalkAiSeatTransition["event"] {
  return Object.freeze({
    schemaVersion: 1 as const,
    tenantId: quote.tenantId,
    talkId: quote.talkId,
    quoteId: quote.quoteId,
    type,
    requestId: id,
    revision: quote.revision,
    occurredAt: at,
  });
}

function next(
  previous: TalkAiSeatQuote,
  patch: Omit<Partial<TalkAiSeatQuote>, "revision" | "updatedAt">,
  at: Instant,
): TalkAiSeatQuote {
  const candidate = Object.freeze({
    ...previous,
    ...patch,
    revision: previous.revision + 1,
    updatedAt: at,
  }) as TalkAiSeatQuote;
  assertTalkAiSeatQuote(candidate);
  return candidate;
}

function captureInstruction(quote: TalkAiSeatQuote): TalkAiSeatSettlementInstruction {
  return Object.freeze({
    kind: "capture",
    idempotencyKey: captureKey(quote.quoteId),
    quoteId: quote.quoteId,
    payerUserId: quote.payerUserId,
    amountCredits: quote.priceCredits,
    hostUserId: quote.hostUserId,
    hostShareCredits: quote.hostShareCredits,
    twinOwnerUserId: quote.twinOwnerUserId,
    twinOwnerShareCredits: quote.twinOwnerShareCredits,
    platformShareCredits: quote.platformShareCredits,
  });
}

export function transitionTalkAiSeatQuote(
  quote: TalkAiSeatQuote,
  command: TalkAiSeatCommand,
  atInput: Instant,
): TalkAiSeatTransition {
  assertTalkAiSeatQuote(quote);
  if (command.expectedRevision !== quote.revision) throw new Error("AI Seat quote revision conflict");
  const id = requestId(command.requestId);
  const at = toInstant(atInput);
  if (at < quote.updatedAt) throw new TypeError("AI Seat transition time cannot move backwards");

  if (["admitted", "declined", "expired"].includes(quote.state)) {
    throw new Error("AI Seat quote is terminal");
  }

  switch (command.type) {
    case "confirm": {
      if (quote.state !== "quoted") throw new Error("AI Seat quote is already confirmed");
      if (command.actorUserId !== quote.payerUserId) {
        throw new Error("Only the quoted payer may confirm the AI Seat purchase");
      }
      if (at >= quote.expiresAt) throw new Error("AI Seat quote has expired");
      const updated = next(quote, {
        state: quote.mode === "sponsor" ? "pending_host" : "pending_admission",
      }, at);
      return Object.freeze({
        quote: updated,
        settlement: Object.freeze({
          kind: "hold",
          idempotencyKey: holdKey(quote.quoteId),
          quoteId: quote.quoteId,
          payerUserId: quote.payerUserId,
          amountCredits: quote.priceCredits,
        }),
        event: event(updated, command.type, id, at),
      });
    }
    case "admit": {
      if (command.actorUserId !== quote.hostUserId) {
        throw new Error("Only the human Talk Host may admit an AI Seat");
      }
      const expected = quote.mode === "sponsor" ? "pending_host" : "pending_admission";
      if (quote.state !== expected) throw new Error("AI Seat is not awaiting admission");
      if (at >= quote.expiresAt) throw new Error("AI Seat authorization has expired");
      const updated = next(quote, { state: "admitted", admittedAt: at }, at);
      return Object.freeze({
        quote: updated,
        settlement: captureInstruction(quote),
        event: event(updated, command.type, id, at),
      });
    }
    case "decline": {
      if (command.actorUserId !== quote.hostUserId) {
        throw new Error("Only the human Talk Host may decline an AI Seat");
      }
      const expected = quote.mode === "sponsor" ? "pending_host" : "pending_admission";
      if (quote.state !== expected) throw new Error("AI Seat is not awaiting a Host decision");
      if (at >= quote.expiresAt) throw new Error("AI Seat authorization has expired");
      const updated = next(quote, { state: "declined", declinedAt: at }, at);
      return Object.freeze({
        quote: updated,
        settlement: Object.freeze({
          kind: "release",
          idempotencyKey: releaseKey(quote.quoteId),
          quoteId: quote.quoteId,
          payerUserId: quote.payerUserId,
          amountCredits: quote.priceCredits,
          reason: "declined",
        }),
        event: event(updated, command.type, id, at),
      });
    }
    case "expire": {
      if (at < quote.expiresAt) throw new Error("AI Seat quote has not expired");
      const held = quote.state === "pending_host" || quote.state === "pending_admission";
      const updated = next(quote, { state: "expired", expiredAt: at }, at);
      return Object.freeze({
        quote: updated,
        settlement: held
          ? Object.freeze({
              kind: "release",
              idempotencyKey: releaseKey(quote.quoteId),
              quoteId: quote.quoteId,
              payerUserId: quote.payerUserId,
              amountCredits: quote.priceCredits,
              reason: "expired",
            })
          : null,
        event: event(updated, command.type, id, at),
      });
    }
  }
}

/**
 * State + settlement instruction must be committed atomically by the owning wallet/ledger adapter.
 * Applying the state transition without its settlement instruction is invalid integration.
 */
export function settlementRequired(transition: TalkAiSeatTransition): boolean {
  return transition.settlement !== null;
}

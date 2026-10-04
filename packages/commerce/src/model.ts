import {
  isCanonicalId,
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type FulfillmentId,
  type Instant,
  type LedgerEntryId,
  type QuoteId,
  type RequestId,
  type SkillVersionId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type OfferId = string & { readonly __offerId: unique symbol };

function isOfferId(value: unknown): value is OfferId {
  return typeof value === "string" && /^offer_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export type CommerceAccountKind =
  | "customer-credit"
  | "agent-float"
  | "fulfillment-reserve"
  | "pending-earnings"
  | "available-earnings"
  | "platform-revenue"
  | "platform-float"
  | "external-clearing";

export interface CommerceAccountRef {
  readonly tenantId: TenantId;
  readonly kind: CommerceAccountKind;
  readonly userId: UserId | null;
  readonly characterId: CharacterId | null;
}

export interface OfferRevision {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly offerId: OfferId;
  readonly revision: number;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly skillVersionId: SkillVersionId;
  readonly priceCredits: number;
  readonly fulfillmentReserveCredits: number;
  readonly creatorCommissionCredits: number;
  readonly fallbackCommissionCredits: number;
  readonly platformMarginCredits: number;
  readonly active: boolean;
  readonly regions: readonly string[];
  readonly createdAt: Instant;
}

export interface CommerceLedgerTransfer {
  readonly schemaVersion: 1;
  readonly ledgerEntryId: LedgerEntryId;
  readonly tenantId: TenantId;
  readonly debit: CommerceAccountRef;
  readonly credit: CommerceAccountRef;
  readonly amountCredits: number;
  readonly reason:
    | "customer-topup"
    | "customer-payment"
    | "agent-float-topup"
    | "fulfillment-reserve"
    | "fulfillment-release"
    | "creator-earning"
    | "earning-settlement"
    | "platform-margin"
    | "refund"
    | "adjustment";
  readonly quoteId: QuoteId | null;
  readonly fulfillmentId: FulfillmentId | null;
  readonly createdAt: Instant;
}

export interface CommerceQuote {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly quoteId: QuoteId;
  readonly offerId: OfferId;
  readonly offerRevision: number;
  readonly customerUserId: UserId;
  readonly originatingCharacterId: CharacterId;
  readonly creatorUserId: UserId | null;
  readonly priceCredits: number;
  readonly creatorCommissionCredits: number;
  readonly fulfillmentReserveCredits: number;
  readonly platformMarginCredits: number;
  readonly expiresAt: Instant;
  readonly createdAt: Instant;
}

/** Supplied by an authorized caller; retries preserve the same request identity. */
export interface AgentFloatAllocationCommand {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly requestId: RequestId;
  readonly amountCredits: number;
}

export interface AgentFloatAllocation extends AgentFloatAllocationCommand {
  readonly ledgerEntryId: LedgerEntryId;
  readonly createdAt: Instant;
}

export interface AgentFloatAllocationHistoryQuery {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId?: CharacterId | null;
  readonly beforeRequestId?: RequestId | null;
  readonly limit?: number;
}

export interface NormalizedAgentFloatAllocationHistoryQuery {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId | null;
  readonly beforeRequestId: RequestId | null;
  readonly limit: number;
}

export interface AgentFloatAllocationHistoryPage {
  readonly allocations: readonly AgentFloatAllocation[];
  readonly nextBeforeRequestId: RequestId | null;
}

export function normalizeAgentFloatAllocationHistoryQuery(
  input: AgentFloatAllocationHistoryQuery,
): NormalizedAgentFloatAllocationHistoryQuery {
  const limit = input.limit === undefined ? 20 : input.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Float allocation history limit must be between 1 and 100");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: input.characterId == null ? null : parseCanonicalId("character", input.characterId),
    beforeRequestId: input.beforeRequestId == null ? null : parseCanonicalId("request", input.beforeRequestId),
    limit,
  });
}

export function normalizeAgentFloatAllocationCommand(
  input: AgentFloatAllocationCommand,
): AgentFloatAllocationCommand {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported Float allocation schema");
  const amountCredits = credits(input.amountCredits, "allocation.amountCredits", false);
  if (amountCredits > 1_000_000_000) throw new RangeError("allocation.amountCredits exceeds limit");
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    requestId: parseCanonicalId("request", input.requestId),
    amountCredits,
  });
}

export function normalizeAgentFloatAllocation(input: AgentFloatAllocation): AgentFloatAllocation {
  return Object.freeze({
    ...normalizeAgentFloatAllocationCommand(input),
    ledgerEntryId: parseCanonicalId("ledger-entry", input.ledgerEntryId),
    createdAt: toInstant(input.createdAt),
  });
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function credits(value: number, name: string, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

export function normalizeCommerceAccountRef(input: CommerceAccountRef): CommerceAccountRef {
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const userId = input.userId === null ? null : parseCanonicalId("user", input.userId);
  const characterId =
    input.characterId === null ? null : parseCanonicalId("character", input.characterId);

  if (input.kind === "customer-credit" && userId === null) {
    throw new TypeError("customer-credit account requires userId");
  }
  if (input.kind === "agent-float" && (userId === null || characterId === null)) {
    throw new TypeError("agent-float account requires userId and characterId");
  }
  if (
    ["pending-earnings", "available-earnings"].includes(input.kind) &&
    userId === null
  ) {
    throw new TypeError(`${input.kind} account requires userId`);
  }
  if (
    ["platform-revenue", "platform-float", "external-clearing"].includes(input.kind) &&
    (userId !== null || characterId !== null)
  ) {
    throw new TypeError(`${input.kind} account cannot be user/Character scoped`);
  }

  return Object.freeze({ tenantId, kind: input.kind, userId, characterId });
}

export function normalizeOfferRevision(input: OfferRevision): OfferRevision {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported Offer schema");
  if (!isOfferId(input.offerId)) throw new TypeError("offerId is invalid");
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("Offer SkillVersionId is invalid");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError("Offer revision is invalid");
  }
  const key = bounded(input.key, "offer.key", 128).toLowerCase();
  if (!keyPattern.test(key)) throw new TypeError("offer.key is invalid");

  const priceCredits = credits(input.priceCredits, "offer.priceCredits", false);
  const fulfillmentReserveCredits = credits(
    input.fulfillmentReserveCredits,
    "offer.fulfillmentReserveCredits",
  );
  const creatorCommissionCredits = credits(
    input.creatorCommissionCredits,
    "offer.creatorCommissionCredits",
  );
  const fallbackCommissionCredits = credits(
    input.fallbackCommissionCredits,
    "offer.fallbackCommissionCredits",
  );
  const platformMarginCredits = credits(
    input.platformMarginCredits,
    "offer.platformMarginCredits",
  );

  if (fallbackCommissionCredits > creatorCommissionCredits) {
    throw new RangeError("Fallback commission cannot exceed creator commission");
  }
  if (
    fulfillmentReserveCredits + creatorCommissionCredits + platformMarginCredits !==
    priceCredits
  ) {
    throw new RangeError(
      "Offer price must equal fulfillment reserve + creator commission + platform margin",
    );
  }

  if (!Array.isArray(input.regions) || input.regions.length > 64) {
    throw new RangeError("Offer regions are invalid");
  }
  const regions = input.regions.map((region) => bounded(region, "offer.region", 64).toUpperCase());
  if (new Set(regions).size !== regions.length) {
    throw new TypeError("Offer regions must be unique");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    offerId: input.offerId,
    revision: input.revision,
    key,
    title: bounded(input.title, "offer.title", 200),
    description: bounded(input.description, "offer.description", 4000),
    skillVersionId: input.skillVersionId,
    priceCredits,
    fulfillmentReserveCredits,
    creatorCommissionCredits,
    fallbackCommissionCredits,
    platformMarginCredits,
    active: input.active === true,
    regions: Object.freeze([...regions].sort()),
    createdAt: toInstant(input.createdAt),
  });
}

export function normalizeCommerceLedgerTransfer(
  input: CommerceLedgerTransfer,
): CommerceLedgerTransfer {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported ledger schema");
  if (!isCanonicalId("ledger-entry", input.ledgerEntryId)) {
    throw new TypeError("ledgerEntryId is invalid");
  }
  if (input.quoteId !== null && !isCanonicalId("quote", input.quoteId)) {
    throw new TypeError("quoteId is invalid");
  }
  if (input.fulfillmentId !== null && !isCanonicalId("fulfillment", input.fulfillmentId)) {
    throw new TypeError("fulfillmentId is invalid");
  }

  const debit = normalizeCommerceAccountRef(input.debit);
  const credit = normalizeCommerceAccountRef(input.credit);
  if (debit.tenantId !== input.tenantId || credit.tenantId !== input.tenantId) {
    throw new TypeError("Ledger accounts must share the entry tenant");
  }
  if (
    debit.kind === credit.kind &&
    debit.userId === credit.userId &&
    debit.characterId === credit.characterId
  ) {
    throw new TypeError("Ledger debit and credit accounts must differ");
  }

  return Object.freeze({
    schemaVersion: 1,
    ledgerEntryId: input.ledgerEntryId,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    debit,
    credit,
    amountCredits: credits(input.amountCredits, "ledger.amountCredits", false),
    reason: input.reason,
    quoteId: input.quoteId,
    fulfillmentId: input.fulfillmentId,
    createdAt: toInstant(input.createdAt),
  });
}

export function normalizeCommerceQuote(input: CommerceQuote): CommerceQuote {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported quote schema");
  if (!isCanonicalId("quote", input.quoteId)) throw new TypeError("quoteId is invalid");
  if (!isOfferId(input.offerId)) throw new TypeError("offerId is invalid");
  if (!isCanonicalId("user", input.customerUserId)) throw new TypeError("customerUserId is invalid");
  if (!isCanonicalId("character", input.originatingCharacterId)) {
    throw new TypeError("originatingCharacterId is invalid");
  }
  if (input.creatorUserId !== null && !isCanonicalId("user", input.creatorUserId)) {
    throw new TypeError("creatorUserId is invalid");
  }
  if (!Number.isSafeInteger(input.offerRevision) || input.offerRevision < 1) {
    throw new RangeError("offerRevision is invalid");
  }
  const priceCredits = credits(input.priceCredits, "quote.priceCredits", false);
  const reserve = credits(input.fulfillmentReserveCredits, "quote.fulfillmentReserveCredits");
  const creator = credits(input.creatorCommissionCredits, "quote.creatorCommissionCredits");
  const margin = credits(input.platformMarginCredits, "quote.platformMarginCredits");
  if (reserve + creator + margin !== priceCredits) {
    throw new RangeError("Quote economics do not sum to the quoted price");
  }
  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new RangeError("Quote expiry must be after creation");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    quoteId: input.quoteId,
    offerId: input.offerId,
    offerRevision: input.offerRevision,
    customerUserId: input.customerUserId,
    originatingCharacterId: input.originatingCharacterId,
    creatorUserId: input.creatorUserId,
    priceCredits,
    creatorCommissionCredits: creator,
    fulfillmentReserveCredits: reserve,
    platformMarginCredits: margin,
    expiresAt,
    createdAt,
  });
}


export interface CommerceFulfillmentAdmission {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly fulfillmentId: FulfillmentId;
  readonly quoteId: QuoteId;
  readonly offerId: OfferId;
  readonly offerRevision: number;
  readonly skillVersionId: SkillVersionId;
  readonly originatingCharacterId: CharacterId;
  readonly executorCharacterId: CharacterId;
  readonly creatorUserId: UserId | null;
  readonly fundingSource: "agent-float" | "platform";
  readonly reserveCredits: number;
  readonly creatorCommissionCredits: number;
  readonly platformRevenueCredits: number;
  readonly state: "admitted";
  readonly createdAt: Instant;
}

export function normalizeCommerceFulfillmentAdmission(
  input: CommerceFulfillmentAdmission,
): CommerceFulfillmentAdmission {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported fulfillment admission schema");
  }
  if (!isCanonicalId("fulfillment", input.fulfillmentId)) {
    throw new TypeError("fulfillmentId is invalid");
  }
  if (!isCanonicalId("quote", input.quoteId)) {
    throw new TypeError("fulfillment quoteId is invalid");
  }
  if (!isOfferId(input.offerId)) {
    throw new TypeError("fulfillment offerId is invalid");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("fulfillment SkillVersionId is invalid");
  }
  if (!isCanonicalId("character", input.originatingCharacterId)) {
    throw new TypeError("fulfillment originating CharacterId is invalid");
  }
  if (!isCanonicalId("character", input.executorCharacterId)) {
    throw new TypeError("fulfillment executor CharacterId is invalid");
  }
  if (
    input.creatorUserId !== null &&
    !isCanonicalId("user", input.creatorUserId)
  ) {
    throw new TypeError("fulfillment creator UserId is invalid");
  }
  if (!Number.isSafeInteger(input.offerRevision) || input.offerRevision < 1) {
    throw new RangeError("fulfillment offerRevision is invalid");
  }
  const reserveCredits = credits(
    input.reserveCredits,
    "fulfillment.reserveCredits",
  );
  const creatorCommissionCredits = credits(
    input.creatorCommissionCredits,
    "fulfillment.creatorCommissionCredits",
  );
  const platformRevenueCredits = credits(
    input.platformRevenueCredits,
    "fulfillment.platformRevenueCredits",
  );
  if (
    input.fundingSource !== "agent-float" &&
    input.fundingSource !== "platform"
  ) {
    throw new TypeError("fulfillment fundingSource is invalid");
  }
  if (input.state !== "admitted") {
    throw new TypeError("fulfillment initial state must be admitted");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    fulfillmentId: input.fulfillmentId,
    quoteId: input.quoteId,
    offerId: input.offerId,
    offerRevision: input.offerRevision,
    skillVersionId: input.skillVersionId,
    originatingCharacterId: input.originatingCharacterId,
    executorCharacterId: input.executorCharacterId,
    creatorUserId: input.creatorUserId,
    fundingSource: input.fundingSource,
    reserveCredits,
    creatorCommissionCredits,
    platformRevenueCredits,
    state: "admitted",
    createdAt: toInstant(input.createdAt),
  });
}


export interface CommerceFulfillmentCompletion {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly fulfillmentId: FulfillmentId;
  readonly state: "succeeded";
  readonly resultReference: string;
  readonly resultHash: string;
  readonly completedAt: Instant;
}

export function normalizeCommerceFulfillmentCompletion(
  input: CommerceFulfillmentCompletion,
): CommerceFulfillmentCompletion {
  if (input.schemaVersion !== 1 || input.state !== "succeeded") {
    throw new TypeError("Unsupported fulfillment completion schema");
  }
  if (!isCanonicalId("fulfillment", input.fulfillmentId)) {
    throw new TypeError("completion fulfillmentId is invalid");
  }
  const resultReference = bounded(
    input.resultReference,
    "completion.resultReference",
    2000,
  );
  const resultHash = bounded(
    input.resultHash,
    "completion.resultHash",
    71,
  ).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(resultHash)) {
    throw new TypeError("completion resultHash must be sha256:<64 lowercase hex>");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    fulfillmentId: input.fulfillmentId,
    state: "succeeded",
    resultReference,
    resultHash,
    completedAt: toInstant(input.completedAt),
  });
}

import {
  parseCanonicalId,
  type CharacterId,
  type FulfillmentId,
  type Instant,
  type LedgerEntryId,
  type QuoteId,
  type UserId,
} from "@masanawa/contracts";
import { planFulfillmentFunding } from "./funding.js";
import {
  normalizeCommerceFulfillmentAdmission,
  normalizeCommerceFulfillmentCompletion,
  normalizeCommerceLedgerTransfer,
  normalizeCommerceQuote,
  normalizeOfferRevision,
  type CommerceFulfillmentAdmission,
  type CommerceFulfillmentCompletion,
  type CommerceLedgerTransfer,
  type CommerceQuote,
  type OfferRevision,
} from "./model.js";
import {
  assertFulfillmentAdmissionTransfers,
  assertFulfillmentQuoteTerms,
} from "./settlement.js";

export interface DeterministicQuoteInput {
  readonly offer: OfferRevision;
  readonly quoteId: QuoteId;
  readonly customerUserId: UserId;
  readonly originatingCharacterId: CharacterId;
  readonly creatorUserId: UserId | null;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
}

export interface DeterministicAdmissionIds {
  readonly fulfillmentId: FulfillmentId;
  readonly customerPaymentLedgerEntryId: LedgerEntryId;
  readonly creatorReserveLedgerEntryId: LedgerEntryId | null;
}

export interface DeterministicSettlementIds {
  readonly reserveReleaseLedgerEntryId: LedgerEntryId | null;
  readonly creatorEarningLedgerEntryId: LedgerEntryId | null;
  readonly platformMarginLedgerEntryId: LedgerEntryId | null;
}

export interface DeterministicCommerceAdmissionPlan {
  readonly quote: CommerceQuote;
  readonly admission: CommerceFulfillmentAdmission;
  readonly transfers: readonly CommerceLedgerTransfer[];
}

export interface DeterministicCommerceSettlementPlan {
  readonly completion: CommerceFulfillmentCompletion;
  readonly transfers: readonly CommerceLedgerTransfer[];
}

function credits(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function ledgerId(
  value: LedgerEntryId | null,
  name: string,
  required: boolean,
): LedgerEntryId | null {
  if (required) {
    if (value === null) throw new TypeError(`${name} is required`);
    return parseCanonicalId("ledger-entry", value);
  }
  if (value !== null) {
    throw new TypeError(`${name} must be null when its transfer amount is zero`);
  }
  return null;
}

export function createDeterministicCommerceQuote(
  input: DeterministicQuoteInput,
): CommerceQuote {
  const offer = normalizeOfferRevision(input.offer);
  if (!offer.active) {
    throw new Error("Cannot quote an inactive Offer revision");
  }

  const customerUserId = parseCanonicalId("user", input.customerUserId);
  const originatingCharacterId = parseCanonicalId(
    "character",
    input.originatingCharacterId,
  );
  const creatorUserId =
    input.creatorUserId === null
      ? null
      : parseCanonicalId("user", input.creatorUserId);

  if (creatorUserId !== null && creatorUserId === customerUserId) {
    throw new Error(
      "Self-purchase must suppress creator earnings attribution before quote creation",
    );
  }

  const creatorCommissionCredits =
    creatorUserId === null ? 0 : offer.creatorCommissionCredits;
  const platformMarginCredits =
    offer.priceCredits -
    offer.fulfillmentReserveCredits -
    creatorCommissionCredits;

  return normalizeCommerceQuote({
    schemaVersion: 1,
    tenantId: offer.tenantId,
    quoteId: parseCanonicalId("quote", input.quoteId),
    offerId: offer.offerId,
    offerRevision: offer.revision,
    customerUserId,
    originatingCharacterId,
    creatorUserId,
    priceCredits: offer.priceCredits,
    creatorCommissionCredits,
    fulfillmentReserveCredits: offer.fulfillmentReserveCredits,
    platformMarginCredits,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
  });
}

export function planDeterministicCommerceAdmission(input: {
  readonly offer: OfferRevision;
  readonly quote: CommerceQuote;
  readonly executorCharacterId: CharacterId;
  readonly availableAgentFloatCredits: number;
  readonly ids: DeterministicAdmissionIds;
  readonly createdAt: Instant;
}): DeterministicCommerceAdmissionPlan {
  const offer = normalizeOfferRevision(input.offer);
  const quote = normalizeCommerceQuote(input.quote);

  if (
    quote.tenantId !== offer.tenantId ||
    quote.offerId !== offer.offerId ||
    quote.offerRevision !== offer.revision ||
    quote.priceCredits !== offer.priceCredits ||
    quote.fulfillmentReserveCredits !== offer.fulfillmentReserveCredits
  ) {
    throw new Error("Quote does not belong to the exact Offer revision");
  }

  const executorCharacterId = parseCanonicalId(
    "character",
    input.executorCharacterId,
  );
  const availableAgentFloatCredits = credits(
    input.availableAgentFloatCredits,
    "availableAgentFloatCredits",
  );

  const creatorMayFund =
    quote.creatorUserId !== null &&
    executorCharacterId === quote.originatingCharacterId;

  const funding = planFulfillmentFunding({
    offer,
    availableAgentFloatCredits: creatorMayFund
      ? availableAgentFloatCredits
      : 0,
  });

  const creatorCommissionCredits =
    quote.creatorUserId === null
      ? 0
      : funding.source === "agent-float"
        ? quote.creatorCommissionCredits
        : Math.min(offer.fallbackCommissionCredits, quote.creatorCommissionCredits);

  const platformRevenueCredits =
    quote.priceCredits -
    quote.fulfillmentReserveCredits -
    creatorCommissionCredits;

  const admission = normalizeCommerceFulfillmentAdmission({
    schemaVersion: 1,
    tenantId: quote.tenantId,
    fulfillmentId: parseCanonicalId("fulfillment", input.ids.fulfillmentId),
    quoteId: quote.quoteId,
    offerId: quote.offerId,
    offerRevision: quote.offerRevision,
    skillVersionId: offer.skillVersionId,
    originatingCharacterId: quote.originatingCharacterId,
    executorCharacterId,
    creatorUserId: quote.creatorUserId,
    fundingSource:
      quote.creatorUserId === null ? "platform" : funding.source,
    reserveCredits: quote.fulfillmentReserveCredits,
    creatorCommissionCredits,
    platformRevenueCredits,
    state: "admitted",
    createdAt: input.createdAt,
  });

  assertFulfillmentQuoteTerms(quote, admission);

  const platformFloat = {
    tenantId: quote.tenantId,
    kind: "platform-float" as const,
    userId: null,
    characterId: null,
  };

  const transfers: CommerceLedgerTransfer[] = [
    normalizeCommerceLedgerTransfer({
      schemaVersion: 1,
      ledgerEntryId: parseCanonicalId(
        "ledger-entry",
        input.ids.customerPaymentLedgerEntryId,
      ),
      tenantId: quote.tenantId,
      debit: {
        tenantId: quote.tenantId,
        kind: "customer-credit",
        userId: quote.customerUserId,
        characterId: null,
      },
      credit: platformFloat,
      amountCredits: quote.priceCredits,
      reason: "customer-payment",
      quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId,
      createdAt: admission.createdAt,
    }),
  ];

  const reserveRequired =
    admission.fundingSource === "agent-float" &&
    admission.reserveCredits > 0;
  const reserveLedgerEntryId = ledgerId(
    input.ids.creatorReserveLedgerEntryId,
    "creatorReserveLedgerEntryId",
    reserveRequired,
  );

  if (reserveRequired) {
    transfers.push(
      normalizeCommerceLedgerTransfer({
        schemaVersion: 1,
        ledgerEntryId: reserveLedgerEntryId!,
        tenantId: quote.tenantId,
        debit: {
          tenantId: quote.tenantId,
          kind: "agent-float",
          userId: admission.creatorUserId,
          characterId: admission.originatingCharacterId,
        },
        credit: platformFloat,
        amountCredits: admission.reserveCredits,
        reason: "fulfillment-reserve",
        quoteId: quote.quoteId,
        fulfillmentId: admission.fulfillmentId,
        createdAt: admission.createdAt,
      }),
    );
  }

  assertFulfillmentAdmissionTransfers({
    quote,
    admission,
    transfers,
  });

  return Object.freeze({
    quote,
    admission,
    transfers: Object.freeze(transfers),
  });
}

export function planDeterministicCommerceSettlement(input: {
  readonly quote: CommerceQuote;
  readonly admission: CommerceFulfillmentAdmission;
  readonly completion: CommerceFulfillmentCompletion;
  readonly ids: DeterministicSettlementIds;
}): DeterministicCommerceSettlementPlan {
  const quote = normalizeCommerceQuote(input.quote);
  const admission = normalizeCommerceFulfillmentAdmission(input.admission);
  const completion = normalizeCommerceFulfillmentCompletion(input.completion);

  assertFulfillmentQuoteTerms(quote, admission);
  if (
    completion.tenantId !== admission.tenantId ||
    completion.fulfillmentId !== admission.fulfillmentId ||
    Date.parse(completion.completedAt) < Date.parse(admission.createdAt)
  ) {
    throw new TypeError("Completion must follow its admitted fulfillment");
  }

  const platformFloat = {
    tenantId: admission.tenantId,
    kind: "platform-float" as const,
    userId: null,
    characterId: null,
  };
  const transfers: CommerceLedgerTransfer[] = [];

  const reserveReleaseRequired =
    admission.fundingSource === "agent-float" &&
    admission.reserveCredits > 0;
  const reserveReleaseId = ledgerId(
    input.ids.reserveReleaseLedgerEntryId,
    "reserveReleaseLedgerEntryId",
    reserveReleaseRequired,
  );
  if (reserveReleaseRequired) {
    transfers.push(
      normalizeCommerceLedgerTransfer({
        schemaVersion: 1,
        ledgerEntryId: reserveReleaseId!,
        tenantId: admission.tenantId,
        debit: platformFloat,
        credit: {
          tenantId: admission.tenantId,
          kind: "agent-float",
          userId: admission.creatorUserId,
          characterId: admission.originatingCharacterId,
        },
        amountCredits: admission.reserveCredits,
        reason: "fulfillment-release",
        quoteId: quote.quoteId,
        fulfillmentId: admission.fulfillmentId,
        createdAt: completion.completedAt,
      }),
    );
  }

  const creatorEarningRequired =
    admission.creatorUserId !== null &&
    admission.creatorCommissionCredits > 0;
  const creatorEarningId = ledgerId(
    input.ids.creatorEarningLedgerEntryId,
    "creatorEarningLedgerEntryId",
    creatorEarningRequired,
  );
  if (creatorEarningRequired) {
    transfers.push(
      normalizeCommerceLedgerTransfer({
        schemaVersion: 1,
        ledgerEntryId: creatorEarningId!,
        tenantId: admission.tenantId,
        debit: platformFloat,
        credit: {
          tenantId: admission.tenantId,
          kind: "pending-earnings",
          userId: admission.creatorUserId,
          characterId: null,
        },
        amountCredits: admission.creatorCommissionCredits,
        reason: "creator-earning",
        quoteId: quote.quoteId,
        fulfillmentId: admission.fulfillmentId,
        createdAt: completion.completedAt,
      }),
    );
  }

  const platformMarginRequired = admission.platformRevenueCredits > 0;
  const platformMarginId = ledgerId(
    input.ids.platformMarginLedgerEntryId,
    "platformMarginLedgerEntryId",
    platformMarginRequired,
  );
  if (platformMarginRequired) {
    transfers.push(
      normalizeCommerceLedgerTransfer({
        schemaVersion: 1,
        ledgerEntryId: platformMarginId!,
        tenantId: admission.tenantId,
        debit: platformFloat,
        credit: {
          tenantId: admission.tenantId,
          kind: "platform-revenue",
          userId: null,
          characterId: null,
        },
        amountCredits: admission.platformRevenueCredits,
        reason: "platform-margin",
        quoteId: quote.quoteId,
        fulfillmentId: admission.fulfillmentId,
        createdAt: completion.completedAt,
      }),
    );
  }

  return Object.freeze({
    completion,
    transfers: Object.freeze(transfers),
  });
}

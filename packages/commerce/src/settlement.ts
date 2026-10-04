import { createCanonicalId } from "@masanawa/contracts";
import {
  normalizeCommerceFulfillmentAdmission,
  normalizeCommerceFulfillmentCompletion,
  normalizeCommerceLedgerTransfer,
  normalizeCommerceQuote,
  type CommerceAccountRef,
  type CommerceFulfillmentAdmission,
  type CommerceFulfillmentCompletion,
  type CommerceLedgerTransfer,
  type CommerceQuote,
} from "./model.js";

/** The persisted quote, rather than an executor's requested transfers, owns money. */
export function assertFulfillmentQuoteTerms(
  quoteInput: CommerceQuote,
  admissionInput: CommerceFulfillmentAdmission,
): void {
  const quote = normalizeCommerceQuote(quoteInput);
  const admission = normalizeCommerceFulfillmentAdmission(admissionInput);
  if (
    admission.tenantId !== quote.tenantId ||
    admission.quoteId !== quote.quoteId ||
    admission.offerId !== quote.offerId ||
    admission.offerRevision !== quote.offerRevision ||
    admission.originatingCharacterId !== quote.originatingCharacterId ||
    admission.creatorUserId !== quote.creatorUserId ||
    admission.reserveCredits !== quote.fulfillmentReserveCredits ||
    admission.creatorCommissionCredits > quote.creatorCommissionCredits ||
    (quote.creatorUserId === null && admission.creatorCommissionCredits !== 0) ||
    admission.platformRevenueCredits !==
      quote.priceCredits - admission.reserveCredits - admission.creatorCommissionCredits ||
    Date.parse(admission.createdAt) < Date.parse(quote.createdAt) ||
    Date.parse(admission.createdAt) >= Date.parse(quote.expiresAt)
  ) {
    throw new TypeError("Fulfillment terms must match the immutable quote");
  }
  if (
    admission.fundingSource === "agent-float" &&
    (quote.creatorUserId === null ||
      quote.creatorUserId === quote.customerUserId ||
      admission.executorCharacterId !== quote.originatingCharacterId ||
      admission.creatorCommissionCredits !== quote.creatorCommissionCredits)
  ) {
    throw new TypeError("Creator-funded fulfillment must preserve creator and executor terms");
  }
  if (quote.creatorUserId === quote.customerUserId) {
    throw new TypeError("Self-purchases cannot generate creator earnings");
  }
}

export function planFulfillmentSettlement(input: {
  readonly quote: CommerceQuote;
  readonly admission: CommerceFulfillmentAdmission;
  readonly completion: CommerceFulfillmentCompletion;
}): readonly CommerceLedgerTransfer[] {
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

  const platformFloat: CommerceAccountRef = {
    tenantId: admission.tenantId, kind: "platform-float", userId: null, characterId: null,
  };
  const transfers: CommerceLedgerTransfer[] = [];
  function transfer(
    credit: CommerceAccountRef,
    amountCredits: number,
    reason: CommerceLedgerTransfer["reason"],
  ): void {
    if (amountCredits === 0) return;
    transfers.push(normalizeCommerceLedgerTransfer({
      schemaVersion: 1,
      ledgerEntryId: createCanonicalId("ledger-entry"),
      tenantId: admission.tenantId,
      debit: platformFloat,
      credit,
      amountCredits,
      reason,
      quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId,
      createdAt: completion.completedAt,
    }));
  }

  // Admission temporarily moved the creator's capacity into platform Float.
  // Repay that capacity separately; it must never become withdrawable earnings.
  if (admission.fundingSource === "agent-float") {
    transfer({
      tenantId: admission.tenantId, kind: "agent-float",
      userId: admission.creatorUserId, characterId: admission.originatingCharacterId,
    }, admission.reserveCredits, "fulfillment-release");
  }
  if (admission.creatorUserId !== null) {
    transfer({
      tenantId: admission.tenantId, kind: "pending-earnings",
      userId: admission.creatorUserId, characterId: null,
    }, admission.creatorCommissionCredits, "creator-earning");
  }
  transfer({
    tenantId: admission.tenantId, kind: "platform-revenue", userId: null, characterId: null,
  }, admission.platformRevenueCredits, "platform-margin");
  return Object.freeze(transfers);
}

/** Require the full paid admission batch before a fulfillment can exist. */
export function assertFulfillmentAdmissionTransfers(input: {
  readonly quote: CommerceQuote;
  readonly admission: CommerceFulfillmentAdmission;
  readonly transfers: readonly CommerceLedgerTransfer[];
}): void {
  assertFulfillmentQuoteTerms(input.quote, input.admission);
  const { quote, admission } = input;
  const transfers = input.transfers.map(normalizeCommerceLedgerTransfer);
  const needsReserve = admission.fundingSource === "agent-float" && admission.reserveCredits > 0;
  if (transfers.length !== (needsReserve ? 2 : 1) ||
      new Set(transfers.map(t => t.ledgerEntryId)).size !== transfers.length) {
    throw new TypeError("Fulfillment requires exactly its payment and applicable reserve");
  }
  for (const transfer of transfers) {
    const isPayment = transfer.reason === "customer-payment" &&
      transfer.debit.kind === "customer-credit" &&
      transfer.debit.userId === quote.customerUserId && transfer.debit.characterId === null &&
      transfer.amountCredits === quote.priceCredits;
    const isReserve = needsReserve && transfer.reason === "fulfillment-reserve" &&
      transfer.debit.kind === "agent-float" && transfer.debit.userId === admission.creatorUserId &&
      transfer.debit.characterId === admission.originatingCharacterId &&
      transfer.amountCredits === admission.reserveCredits;
    if (
      (!isPayment && !isReserve) || transfer.tenantId !== admission.tenantId ||
      transfer.quoteId !== quote.quoteId || transfer.fulfillmentId !== admission.fulfillmentId ||
      transfer.credit.kind !== "platform-float" || transfer.credit.userId !== null ||
      transfer.credit.characterId !== null || transfer.createdAt !== admission.createdAt
    ) {
      throw new TypeError("Fulfillment payment/reserve must match the immutable admission");
    }
  }
  if (transfers.filter(t => t.reason === "customer-payment").length !== 1) {
    throw new TypeError("Fulfillment requires exactly one customer payment");
  }
}

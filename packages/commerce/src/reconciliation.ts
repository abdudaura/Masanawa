import {
  parseCanonicalId,
  toInstant,
  type ExternalReceiptId,
  type FulfillmentId,
  type Instant,
  type LedgerEntryId,
  type QuoteId,
  type ReconciliationCaseId,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  normalizeCommerceAccountRef,
  normalizeCommerceLedgerTransfer,
  type CommerceAccountRef,
  type CommerceLedgerTransfer,
} from "./model.js";

export interface CommerceReconciliationReceipt {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly reconciliationCaseId: ReconciliationCaseId;
  readonly externalReceiptId: ExternalReceiptId;
  readonly quoteId: QuoteId;
  readonly fulfillmentId: FulfillmentId;
  readonly providerKey: string;
  readonly outcome:
    | "confirmed-posted"
    | "confirmed-not-posted"
    | "reversed"
    | "ambiguous";
  readonly evidenceReference: string;
  readonly evidenceHash: string;
  readonly observedAt: Instant;
}

export interface CommerceReversalRequest {
  readonly original: CommerceLedgerTransfer;
  readonly reversalLedgerEntryId: LedgerEntryId;
}

export interface CommerceWithdrawalPlan {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
  readonly userId: UserId;
  readonly source: CommerceAccountRef;
  readonly destination: CommerceAccountRef;
  readonly amountCredits: number;
  readonly createdAt: Instant;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function credits(value: number, name: string, allowZero = false): number {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1)
  ) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function evidenceHash(value: string): string {
  const normalized = bounded(value, "evidenceHash", 71, 71).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    throw new TypeError("evidenceHash must be sha256:<64 lowercase hex>");
  }
  return normalized;
}

export function normalizeCommerceReconciliationReceipt(
  input: CommerceReconciliationReceipt,
): CommerceReconciliationReceipt {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported reconciliation receipt schema");
  }
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const outcome = input.outcome;
  if (
    outcome !== "confirmed-posted" &&
    outcome !== "confirmed-not-posted" &&
    outcome !== "reversed" &&
    outcome !== "ambiguous"
  ) {
    throw new TypeError("reconciliation receipt outcome is invalid");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId,
    reconciliationCaseId: parseCanonicalId(
      "reconciliation-case",
      input.reconciliationCaseId,
    ),
    externalReceiptId: parseCanonicalId(
      "external-receipt",
      input.externalReceiptId,
    ),
    quoteId: parseCanonicalId("quote", input.quoteId),
    fulfillmentId: parseCanonicalId("fulfillment", input.fulfillmentId),
    providerKey: bounded(input.providerKey, "providerKey", 2, 120).toLowerCase(),
    outcome,
    evidenceReference: bounded(
      input.evidenceReference,
      "evidenceReference",
      1,
      2048,
    ),
    evidenceHash: evidenceHash(input.evidenceHash),
    observedAt: toInstant(input.observedAt),
  });
}

export function assertCommerceReconciliationReceiptReplay(input: {
  readonly existing: CommerceReconciliationReceipt;
  readonly incoming: CommerceReconciliationReceipt;
}): CommerceReconciliationReceipt {
  const existing = normalizeCommerceReconciliationReceipt(input.existing);
  const incoming = normalizeCommerceReconciliationReceipt(input.incoming);
  if (
    existing.externalReceiptId !== incoming.externalReceiptId ||
    JSON.stringify(existing) !== JSON.stringify(incoming)
  ) {
    throw new Error("Commerce reconciliation receipt replay changed evidence");
  }
  return existing;
}

function inverseTransfer(input: {
  readonly original: CommerceLedgerTransfer;
  readonly reversalLedgerEntryId: LedgerEntryId;
  readonly createdAt: Instant;
}): CommerceLedgerTransfer {
  const original = normalizeCommerceLedgerTransfer(input.original);
  const createdAt = toInstant(input.createdAt);
  if (createdAt < original.createdAt) {
    throw new Error("reversal cannot predate original ledger entry");
  }

  let reason: CommerceLedgerTransfer["reason"];
  if (original.reason === "customer-payment") {
    if (
      original.debit.kind !== "customer-credit" ||
      original.credit.kind !== "platform-float"
    ) {
      throw new Error("customer-payment ledger shape is not refundable");
    }
    reason = "refund";
  } else if (original.reason === "creator-earning") {
    if (
      original.debit.kind !== "platform-float" ||
      original.credit.kind !== "pending-earnings"
    ) {
      throw new Error("creator-earning ledger shape is not reversible");
    }
    reason = "adjustment";
  } else if (original.reason === "platform-margin") {
    if (
      original.debit.kind !== "platform-float" ||
      original.credit.kind !== "platform-revenue"
    ) {
      throw new Error("platform-margin ledger shape is not reversible");
    }
    reason = "adjustment";
  } else if (original.reason === "fulfillment-reserve") {
    if (
      original.debit.kind !== "agent-float" ||
      original.credit.kind !== "platform-float"
    ) {
      throw new Error("fulfillment-reserve ledger shape is not releasable");
    }
    reason = "fulfillment-release";
  } else if (original.reason === "earning-settlement") {
    throw new Error(
      "Already-settled earnings require reconciliation/negative-balance policy",
    );
  } else {
    throw new Error(`Ledger reason ${original.reason} is not automatically reversible`);
  }

  return normalizeCommerceLedgerTransfer({
    schemaVersion: 1,
    ledgerEntryId: parseCanonicalId(
      "ledger-entry",
      input.reversalLedgerEntryId,
    ),
    tenantId: original.tenantId,
    debit: original.credit,
    credit: original.debit,
    amountCredits: original.amountCredits,
    reason,
    quoteId: original.quoteId,
    fulfillmentId: original.fulfillmentId,
    createdAt,
  });
}

export function planCommerceLedgerReversals(input: {
  readonly requests: readonly CommerceReversalRequest[];
  readonly createdAt: Instant;
}): readonly CommerceLedgerTransfer[] {
  if (!Array.isArray(input.requests) || input.requests.length < 1 || input.requests.length > 16) {
    throw new RangeError("reversal request batch must contain 1..16 entries");
  }

  const originals = new Set<string>();
  const reversals = new Set<string>();
  const result: CommerceLedgerTransfer[] = [];
  let scope:
    | {
        readonly tenantId: string;
        readonly quoteId: string | null;
        readonly fulfillmentId: string | null;
      }
    | undefined;

  for (const request of input.requests) {
    const original = normalizeCommerceLedgerTransfer(request.original);
    if (originals.has(original.ledgerEntryId)) {
      throw new Error("reversal batch contains duplicate original ledger entries");
    }
    originals.add(original.ledgerEntryId);

    const reversalId = parseCanonicalId(
      "ledger-entry",
      request.reversalLedgerEntryId,
    );
    if (reversals.has(reversalId)) {
      throw new Error("reversal batch contains duplicate reversal ledger ids");
    }
    reversals.add(reversalId);

    const currentScope = {
      tenantId: original.tenantId,
      quoteId: original.quoteId,
      fulfillmentId: original.fulfillmentId,
    };
    if (scope === undefined) {
      scope = currentScope;
    } else if (
      scope.tenantId !== currentScope.tenantId ||
      scope.quoteId !== currentScope.quoteId ||
      scope.fulfillmentId !== currentScope.fulfillmentId
    ) {
      throw new Error("reversal batch must belong to one exact Commerce scope");
    }

    result.push(
      inverseTransfer({
        original,
        reversalLedgerEntryId: reversalId,
        createdAt: input.createdAt,
      }),
    );
  }

  return Object.freeze(result);
}

export function planPendingEarningsRelease(input: {
  readonly creatorEarningTransfer: CommerceLedgerTransfer;
  readonly settlementLedgerEntryId: LedgerEntryId;
  readonly createdAt: Instant;
}): CommerceLedgerTransfer {
  const earning = normalizeCommerceLedgerTransfer(input.creatorEarningTransfer);
  if (
    earning.reason !== "creator-earning" ||
    earning.debit.kind !== "platform-float" ||
    earning.credit.kind !== "pending-earnings" ||
    earning.credit.userId === null
  ) {
    throw new Error("Only canonical pending creator earnings can be settled");
  }

  const createdAt = toInstant(input.createdAt);
  if (createdAt < earning.createdAt) {
    throw new Error("earnings settlement cannot predate creator earning");
  }

  return normalizeCommerceLedgerTransfer({
    schemaVersion: 1,
    ledgerEntryId: parseCanonicalId(
      "ledger-entry",
      input.settlementLedgerEntryId,
    ),
    tenantId: earning.tenantId,
    debit: earning.credit,
    credit: {
      tenantId: earning.tenantId,
      kind: "available-earnings",
      userId: earning.credit.userId,
      characterId: null,
    },
    amountCredits: earning.amountCredits,
    reason: "earning-settlement",
    quoteId: earning.quoteId,
    fulfillmentId: earning.fulfillmentId,
    createdAt,
  });
}

export function planAvailableEarningsWithdrawal(input: {
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
  readonly userId: UserId;
  readonly source: CommerceAccountRef;
  readonly amountCredits: number;
  readonly createdAt: Instant;
}): CommerceWithdrawalPlan {
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const userId = parseCanonicalId("user", input.userId);
  const source = normalizeCommerceAccountRef(input.source);

  if (
    source.tenantId !== tenantId ||
    source.kind !== "available-earnings" ||
    source.userId !== userId ||
    source.characterId !== null
  ) {
    throw new Error(
      "Withdrawal source must be the requesting User's available earnings",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId,
    requestId: parseCanonicalId("request", input.requestId),
    userId,
    source,
    destination: normalizeCommerceAccountRef({
      tenantId,
      kind: "external-clearing",
      userId: null,
      characterId: null,
    }),
    amountCredits: credits(input.amountCredits, "withdrawal amountCredits"),
    createdAt: toInstant(input.createdAt),
  });
}

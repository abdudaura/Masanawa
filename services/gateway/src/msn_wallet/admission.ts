/**
 * MSN is an off-chain Masanawa accounting unit. It is NOT a blockchain token,
 * bank deposit or promised redeemable stablecoin. Only verified, already
 * acquired backing can be admitted, and only by a privileged server worker.
 *
 * All USD and MSN monetary values use exact 6-decimal integer micro-units.
 * NGN (kobo) is intake/quote metadata, NEVER a customer-facing wallet asset.
 * Do not call this from an HTTP handler with client-provided settlement proof.
 */
export const MSN_SCALE = 1_000_000n;
const MAX = 10n ** 30n;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;

export type MsnFundingRail = "NGN_FLUTTERWAVE" | "NOWPAYMENTS_CRYPTO";
export type MsnQuoteState = "quoted" | "expired" | "settled" | "rejected";

export interface MsnConversionQuote {
  readonly quoteId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly fundingRail: MsnFundingRail;
  readonly fundingReference: string;
  /** Only present for optional Nigerian fiat intake; never wallet balance. */
  readonly ngnFundingKobo: bigint | null;
  readonly backingAsset: string;
  readonly backingNetwork: string;
  /** USD-denominated six-decimal backing value from a qualified provider. */
  readonly minimumSettledBackingUsdMicro: bigint;
  /** Explicit price for ONE MSN unit; there is deliberately no default rate. */
  readonly pricePerMsnUsdMicro: bigint;
  readonly providerQuoteReference: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface MsnProviderSettlement {
  readonly tenantId: string;
  readonly userId: string;
  readonly quoteId: string;
  readonly fundingReference: string;
  readonly providerSettlementId: string;
  readonly providerQuoteReference: string;
  readonly backingAsset: string;
  readonly backingNetwork: string;
  /** Exact custody-backed value from independent provider settlement evidence. */
  readonly settledBackingUsdMicro: bigint;
  /** The credited fiat receipt is a prerequisite for NGN funding. */
  readonly verifiedNgnFundingKobo: bigint | null;
  readonly settledAtMs: number;
}

export interface MsnAdmission {
  readonly tenantId: string;
  readonly userId: string;
  readonly quoteId: string;
  readonly providerSettlementId: string;
  readonly fundingReference: string;
  readonly backingAsset: string;
  readonly backingNetwork: string;
  readonly backingUsdMicro: bigint;
  readonly msnCreditMicro: bigint;
  readonly conversionRemainderUsdMicroScaled: bigint;
}

/** Exact decimal parser for server/provider DTOs. Rejects exponent, sign,
 * whitespace, floats, ambiguity and sub-micro precision. */
export function parseMicro(value: string, allowZero = false): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(value)) {
    throw new TypeError("msn.amount.invalid");
  }
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole!) * MSN_SCALE + BigInt(fraction.padEnd(6, "0"));
  if (units > MAX || (allowZero ? units < 0n : units <= 0n)) {
    throw new RangeError("msn.amount.out_of_bounds");
  }
  return units;
}

export function formatMicro(value: bigint): string {
  nonNegative(value, "msn.amount.invalid");
  const whole = value / MSN_SCALE;
  const frac = (value % MSN_SCALE).toString().padStart(6, "0");
  return whole.toString() + "." + frac;
}

function positive(value: bigint, code: string): void {
  if (typeof value !== "bigint" || value <= 0n || value > MAX) throw new RangeError(code);
}
function nonNegative(value: bigint, code: string): void {
  if (typeof value !== "bigint" || value < 0n || value > MAX) throw new RangeError(code);
}
function ref(value: string, code: string): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new TypeError(code);
}
function same(actual: string, expected: string): void {
  if (actual !== expected) throw new Error("msn.settlement.binding_mismatch");
}

export function admitMsnSettlement(input: {
  readonly quote: MsnConversionQuote;
  readonly settlement: MsnProviderSettlement;
  readonly nowMs: number;
  /** This is a server-side gate, NOT request JSON. */
  readonly qualifiedProvider: boolean;
  readonly custodyBackingVerified: boolean;
  readonly conversionLicensedAndAvailable: boolean;
  readonly accountPolicyApproved: boolean;
}): Readonly<MsnAdmission> {
  const { quote: q, settlement: s } = input;
  if (
    !input.qualifiedProvider ||
    !input.custodyBackingVerified ||
    !input.conversionLicensedAndAvailable ||
    !input.accountPolicyApproved
  ) throw new Error("msn.settlement.not_qualified");
  for (const v of [q.quoteId, q.tenantId, q.userId, q.fundingReference,
    q.providerQuoteReference, s.providerSettlementId]) ref(v, "msn.reference.invalid");
  if (!/^[A-Z0-9_-]{2,32}$/.test(q.backingAsset) ||
      !/^[a-z0-9_-]{2,64}$/.test(q.backingNetwork)) {
    throw new TypeError("msn.backing.asset_network_invalid");
  }
  if (!Number.isSafeInteger(input.nowMs) || !Number.isSafeInteger(q.issuedAtMs) ||
      !Number.isSafeInteger(q.expiresAtMs) || !Number.isSafeInteger(s.settledAtMs) ||
      q.issuedAtMs >= q.expiresAtMs ||
      s.settledAtMs < q.issuedAtMs || s.settledAtMs > q.expiresAtMs ||
      input.nowMs < s.settledAtMs) throw new Error("msn.quote.expired_or_invalid");

  same(s.quoteId, q.quoteId);
  same(s.tenantId, q.tenantId);
  same(s.userId, q.userId);
  same(s.fundingReference, q.fundingReference);
  same(s.providerQuoteReference, q.providerQuoteReference);
  same(s.backingAsset, q.backingAsset);
  same(s.backingNetwork, q.backingNetwork);

  positive(q.minimumSettledBackingUsdMicro, "msn.quote.minimum_invalid");
  positive(q.pricePerMsnUsdMicro, "msn.quote.price_invalid");
  positive(s.settledBackingUsdMicro, "msn.settlement.amount_invalid");
  if (s.settledBackingUsdMicro < q.minimumSettledBackingUsdMicro)
    throw new Error("msn.settlement.underfunded");

  if (q.fundingRail === "NGN_FLUTTERWAVE") {
    if (q.ngnFundingKobo === null || s.verifiedNgnFundingKobo === null)
      throw new Error("msn.ngn.verified_receipt_required");
    positive(q.ngnFundingKobo, "msn.ngn.amount_invalid");
    if (q.ngnFundingKobo !== s.verifiedNgnFundingKobo)
      throw new Error("msn.ngn.receipt_amount_mismatch");
  } else if (q.fundingRail === "NOWPAYMENTS_CRYPTO") {
    if (q.ngnFundingKobo !== null || s.verifiedNgnFundingKobo !== null)
      throw new Error("msn.crypto.fiat_receipt_unexpected");
  } else {
    throw new Error("msn.funding.rail_invalid");
  }

  // No floating point. Round down the minted amount and leave remainder
  // unallocated, never round up or mint MSN without acquired collateral.
  const numerator = s.settledBackingUsdMicro * MSN_SCALE;
  const minted = numerator / q.pricePerMsnUsdMicro;
  const remainder = numerator % q.pricePerMsnUsdMicro;
  positive(minted, "msn.settlement.too_small");
  return Object.freeze({
    tenantId: q.tenantId,
    userId: q.userId,
    quoteId: q.quoteId,
    providerSettlementId: s.providerSettlementId,
    fundingReference: q.fundingReference,
    backingAsset: q.backingAsset,
    backingNetwork: q.backingNetwork,
    backingUsdMicro: s.settledBackingUsdMicro,
    msnCreditMicro: minted,
    conversionRemainderUsdMicroScaled: remainder,
  });
}

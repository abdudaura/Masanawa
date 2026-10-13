import { createHash } from "node:crypto";
import type { FlutterwaveFundingClient } from "@masanawa/providers";
import type { MsnConversionQuote } from "./admission.js";
import type { MsnFiatIntakeRecord } from "./fiat_intake_pg.js";

export interface MsnFiatIntakeReader {
  read(input: { readonly tenantId: string; readonly userId: string;
    readonly fundingReference: string }): Promise<MsnFiatIntakeRecord | null>;
}

/**
 * Server-only read/reconciliation of ALREADY credited canonical NGN funding.
 * A redirect, callback, browser proof or internal "credited" flag alone is
 * insufficient: this calls Flutterwave verify-by-reference with merchant
 * credentials, checks the settled amount/currency/transaction and re-reads
 * the PostgreSQL ledger. Even success is NOT custody proof or MSN issuance.
 */
export async function verifyMsnFiatIntake(input: {
  readonly quote: MsnConversionQuote;
  readonly reader: MsnFiatIntakeReader;
  readonly provider: Pick<FlutterwaveFundingClient, "verifyByReference">;
  readonly observedAtMs: number;
  readonly signal?: AbortSignal;
}): Promise<Readonly<{
  state: "fiat_verified_backing_pending";
  tenantId: string;
  userId: string;
  quoteId: string;
  fundingReference: string;
  fundingKobo: string;
  providerTransactionId: string;
  providerVerificationSha256: string;
  observedAtMs: number;
}>> {
  const { quote, reader, provider } = input;
  if (quote.fundingRail !== "NGN_FLUTTERWAVE" ||
      quote.ngnFundingKobo === null || quote.ngnFundingKobo <= 0n ||
      quote.pricePerMsnUsdMicro <= 0n ||
      !Number.isSafeInteger(input.observedAtMs) || input.observedAtMs <= 0)
    throw new Error("msn.fiat_intake.quote_invalid");

  const key = { tenantId: quote.tenantId, userId: quote.userId,
    fundingReference: quote.fundingReference };
  const prior = await reader.read(key);
  if (!prior) throw new Error("msn.fiat_intake.not_found");
  validateRecord(prior, quote);

  // The funding client must be created with server-held Flutterwave secret,
  // never a client credential or unsigned webhook payload.
  const payment = await provider.verifyByReference(prior.txRef, input.signal);
  if (payment.txRef !== prior.txRef ||
      payment.currency !== "NGN" ||
      payment.status !== "successful" ||
      !/^[0-9]{1,80}$/.test(payment.transactionId) ||
      payment.transactionId !== prior.providerTransactionId ||
      (prior.providerReference !== null &&
       payment.providerReference !== prior.providerReference) ||
      paymentKobo(payment.amount) !== prior.amountKobo)
    throw new Error("msn.fiat_intake.provider_mismatch");

  // Prevent a reversal/owner/amount change between the local snapshot and
  // independent provider round trip. A later issuance worker must STILL
  // atomically lock/recheck all funding and custody state.
  const latest = await reader.read(key);
  if (!latest) throw new Error("msn.fiat_intake.changed_during_verification");
  try {
    validateRecord(latest, quote);
  } catch {
    throw new Error("msn.fiat_intake.changed_during_verification");
  }
  if (latest.txRef !== prior.txRef ||
      latest.providerTransactionId !== prior.providerTransactionId ||
      latest.providerReference !== prior.providerReference)
    throw new Error("msn.fiat_intake.changed_during_verification");

  const proof = [
    "msn-flutterwave-fiat-only-v1",
    quote.tenantId, quote.userId, quote.quoteId, quote.fundingReference,
    latest.txRef, latest.amountKobo.toString(), payment.transactionId,
    payment.providerReference ?? "",
  ];
  return Object.freeze({
    state: "fiat_verified_backing_pending" as const,
    tenantId: quote.tenantId, userId: quote.userId,
    quoteId: quote.quoteId, fundingReference: quote.fundingReference,
    fundingKobo: latest.amountKobo.toString(),
    providerTransactionId: payment.transactionId,
    providerVerificationSha256: createHash("sha256")
      .update(JSON.stringify(proof)).digest("hex"),
    observedAtMs: input.observedAtMs,
  });
}

function validateRecord(record: MsnFiatIntakeRecord, quote: MsnConversionQuote): void {
  if (record.tenantId !== quote.tenantId ||
      record.userId !== quote.userId ||
      record.quoteId !== quote.quoteId ||
      record.fundingReference !== quote.fundingReference ||
      record.amountKobo !== quote.ngnFundingKobo ||
      record.state !== "credited" ||
      !record.providerTransactionId ||
      !/^[0-9]{1,80}$/.test(record.providerTransactionId) ||
      !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(record.txRef))
    throw new Error("msn.fiat_intake.not_qualified");
}

/** NGN is exactly 2-decimal; reject floating point, signs and truncated kobo. */
function paymentKobo(value: string): bigint {
  if (typeof value !== "string" ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value))
    throw new Error("msn.fiat_intake.payment_amount_invalid");
  const [whole = "", decimals = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
}

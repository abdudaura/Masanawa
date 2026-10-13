import type { FlutterwaveFundingClient } from "@masanawa/providers";
import type { MsnConversionQuote } from "./admission.js";
import { verifyMsnFiatIntake, type MsnFiatIntakeReader } from "./fiat_intake.js";
import type { MsnPgPool } from "./store.js";

export type MsnFundingState = "awaiting_verified_funding" |
  "fiat_verified_backing_pending" | "backed_issued";
export interface MsnFundingStatus {
  readonly quoteId: string;
  readonly fundingRail: MsnConversionQuote["fundingRail"];
  readonly fundingReference: string;
  /** Funding metadata, NOT a spendable NGN wallet balance. */
  readonly ngnFundingKobo: string | null;
  readonly backingAsset: string;
  readonly backingNetwork: string;
  readonly state: MsnFundingState;
  readonly issuedMsnMicro: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
function identifier(s: string): string {
  if (typeof s !== "string" || !IDENTIFIER.test(s))
    throw new Error("msn.quote.identity_invalid");
  return s;
}
function bigintPositive(v: bigint): string {
  if (typeof v !== "bigint" || v <= 0n || v > 10n ** 30n)
    throw new Error("msn.quote.economics_invalid");
  return v.toString();
}
function dbText(v: unknown, name: string): string {
  if (typeof v !== "string" || !v) throw new Error("msn.quote.invalid_" + name);
  return v;
}
function dbBigint(v: unknown): bigint {
  if (typeof v !== "string" || !/^[1-9][0-9]*$/.test(v))
    throw new Error("msn.quote.invalid_economics");
  return BigInt(v);
}
function iso(v: unknown): string {
  const ms = v instanceof Date ? v.getTime() :
    typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isSafeInteger(ms)) throw new Error("msn.quote.invalid_date");
  return new Date(ms).toISOString();
}
function validateQuote(q: MsnConversionQuote, pricingHash: string): void {
  for (const s of [q.tenantId, q.userId, q.quoteId, q.fundingReference,
    q.providerQuoteReference]) identifier(s);
  if (!/^[0-9a-f]{64}$/.test(pricingHash) ||
      !/^[A-Z0-9_-]{2,32}$/.test(q.backingAsset) ||
      !/^[a-z0-9_-]{2,64}$/.test(q.backingNetwork) ||
      !Number.isSafeInteger(q.issuedAtMs) ||
      !Number.isSafeInteger(q.expiresAtMs) ||
      q.issuedAtMs >= q.expiresAtMs)
    throw new Error("msn.quote.invalid");
  bigintPositive(q.minimumSettledBackingUsdMicro);
  bigintPositive(q.pricePerMsnUsdMicro);
  if (q.fundingRail === "NGN_FLUTTERWAVE") {
    if (q.ngnFundingKobo === null || q.ngnFundingKobo > BigInt("9223372036854775807"))
      throw new Error("msn.quote.ngn_invalid");
    bigintPositive(q.ngnFundingKobo);
  } else if (q.fundingRail === "NOWPAYMENTS_CRYPTO") {
    if (q.ngnFundingKobo !== null) throw new Error("msn.quote.crypto_ngn_unexpected");
  } else throw new Error("msn.quote.rail_invalid");
}
function fromRow(r: Record<string, unknown>): MsnConversionQuote {
  const rail = r.funding_rail;
  if (rail !== "NGN_FLUTTERWAVE" && rail !== "NOWPAYMENTS_CRYPTO")
    throw new Error("msn.quote.invalid_rail");
  return Object.freeze({
    quoteId: dbText(r.quote_id, "quote_id"),
    tenantId: dbText(r.tenant_id, "tenant"),
    userId: dbText(r.user_id, "user"),
    fundingReference: dbText(r.funding_reference, "funding"),
    fundingRail: rail,
    ngnFundingKobo: r.ngn_funding_kobo === null ? null : dbBigint(r.ngn_funding_kobo),
    backingAsset: dbText(r.backing_asset, "asset"),
    backingNetwork: dbText(r.backing_network, "network"),
    minimumSettledBackingUsdMicro: dbBigint(r.minimum_settled_backing_usd_micro),
    pricePerMsnUsdMicro: dbBigint(r.price_per_msn_usd_micro),
    providerQuoteReference: dbText(r.provider_quote_reference, "provider_quote"),
    issuedAtMs: Date.parse(iso(r.issued_at)),
    expiresAtMs: Date.parse(iso(r.expires_at)),
  });
}

const PROJECTION = `SELECT q.tenant_id,q.user_id,q.quote_id,q.funding_rail,q.funding_reference,
 q.ngn_funding_kobo::text AS ngn_funding_kobo,q.backing_asset,q.backing_network,
 q.minimum_settled_backing_usd_micro::text AS minimum_settled_backing_usd_micro,
 q.price_per_msn_usd_micro::text AS price_per_msn_usd_micro,
 q.provider_quote_reference,q.pricing_evidence_sha256,q.issued_at,q.expires_at,
 v.provider_transaction_id,
 i.msn_credit_micro::text AS issued_msn_micro
 FROM commerce.msn_funding_quotes q
 LEFT JOIN commerce.msn_fiat_verifications v
   ON v.tenant_id=q.tenant_id AND v.quote_id=q.quote_id AND v.user_id=q.user_id
 LEFT JOIN commerce.msn_issuances i
   ON i.tenant_id=q.tenant_id AND i.quote_id=q.quote_id AND i.user_id=q.user_id`;
function fundingStatus(row: Record<string, unknown>): MsnFundingStatus {
  const q = fromRow(row);
  const micro = row.issued_msn_micro;
  if (micro !== null && (typeof micro !== "string" || !/^[1-9][0-9]*$/.test(micro)))
    throw new Error("msn.funding.invalid_issuance");
  const state: MsnFundingState = micro !== null ? "backed_issued" :
    row.provider_transaction_id !== null ? "fiat_verified_backing_pending" :
    "awaiting_verified_funding";
  // No unreceived backing or invented MSN valuation may appear in readback.
  return Object.freeze({
    quoteId:q.quoteId, fundingRail:q.fundingRail,
    fundingReference:q.fundingReference,
    ngnFundingKobo:q.ngnFundingKobo?.toString() ?? null,
    backingAsset:q.backingAsset,backingNetwork:q.backingNetwork,
    issuedMsnMicro:micro as string | null,
    state,issuedAt:new Date(q.issuedAtMs).toISOString(),
    expiresAt:new Date(q.expiresAtMs).toISOString(),
  });
}

/** Internal-only quote and verification journal; never expose its write methods
 * to a customer HTTP route. Real pricing, custody and operator qualification
 * remain external prerequisites; a hash is not provider approval. */
export function createMsnFundingJournal(pool: MsnPgPool) {
  async function findQuote(tenantId: string, userId: string, quoteId: string) {
    for (const s of [tenantId,userId,quoteId]) identifier(s);
    const q = await pool.query(
      PROJECTION + " WHERE q.tenant_id=$1 AND q.user_id=$2 AND q.quote_id=$3",
      [tenantId,userId,quoteId],
    );
    return q.rows[0] ?? null;
  }

  return Object.freeze({
    async saveQuote(q: MsnConversionQuote, pricingEvidenceSha256: string): Promise<void> {
      validateQuote(q,pricingEvidenceSha256);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO commerce.msn_funding_quotes
            (tenant_id,user_id,quote_id,funding_rail,funding_reference,
             ngn_funding_kobo,backing_asset,backing_network,
             minimum_settled_backing_usd_micro,price_per_msn_usd_micro,
             provider_quote_reference,pricing_evidence_sha256,issued_at,expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (tenant_id,quote_id) DO NOTHING`,
          [q.tenantId,q.userId,q.quoteId,q.fundingRail,q.fundingReference,
            q.ngnFundingKobo?.toString() ?? null,q.backingAsset,q.backingNetwork,
            q.minimumSettledBackingUsdMicro.toString(),q.pricePerMsnUsdMicro.toString(),
            q.providerQuoteReference,pricingEvidenceSha256,
            new Date(q.issuedAtMs).toISOString(),new Date(q.expiresAtMs).toISOString()],
        );
        const read = await client.query(
          PROJECTION + " WHERE q.tenant_id=$1 AND q.quote_id=$2 FOR UPDATE OF q",
          [q.tenantId,q.quoteId],
        );
        const record = read.rows[0];
        if (!record || record.pricing_evidence_sha256 !== pricingEvidenceSha256)
          throw new Error("msn.quote.replay_conflict");
        const old = fromRow(record);
        for (const field of ["tenantId","userId","quoteId","fundingRail",
          "fundingReference","ngnFundingKobo","backingAsset","backingNetwork",
          "minimumSettledBackingUsdMicro","pricePerMsnUsdMicro",
          "providerQuoteReference","issuedAtMs","expiresAtMs"] as const) {
          if (old[field] !== q[field]) throw new Error("msn.quote.replay_conflict");
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { client.release(); }
    },

    async listStatus(tenantId: string, userId: string): Promise<readonly MsnFundingStatus[]> {
      identifier(tenantId);identifier(userId);
      const result = await pool.query(
        PROJECTION +
        " WHERE q.tenant_id=$1 AND q.user_id=$2 ORDER BY q.issued_at DESC,q.quote_id DESC LIMIT 20",
        [tenantId,userId],
      );
      return Object.freeze(result.rows.map(fundingStatus));
    },

    /** Only an internally scheduled qualified provider verifier may call
     * this, never a client endpoint. Commit a verified fiat event, not MSN. */
    async verifyFiat(input: {
      readonly tenantId: string;readonly userId: string;readonly quoteId: string;
      readonly reader: MsnFiatIntakeReader;
      readonly provider: Pick<FlutterwaveFundingClient,"verifyByReference">;
      readonly observedAtMs: number;
      readonly signal?: AbortSignal;
    }): Promise<MsnFundingStatus> {
      const record = await findQuote(input.tenantId,input.userId,input.quoteId);
      if (!record) throw new Error("msn.quote.not_found");
      const quote = fromRow(record);
      // A real provider settlement *time* must be checked separately before
      // issuance. We conservatively refuse late fiat-verification promotion.
      if (input.observedAtMs > quote.expiresAtMs)
        throw new Error("msn.quote.expired");
      const verified = await verifyMsnFiatIntake({
        quote,reader:input.reader,provider:input.provider,
        observedAtMs:input.observedAtMs,
        ...(input.signal ? {signal:input.signal}:{}),
      });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO commerce.msn_fiat_verifications
             (tenant_id,user_id,quote_id,provider_transaction_id,
              provider_verification_sha256,verified_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (tenant_id,quote_id) DO NOTHING`,
          [quote.tenantId,quote.userId,quote.quoteId,verified.providerTransactionId,
            verified.providerVerificationSha256,new Date(verified.observedAtMs).toISOString()],
        );
        const check = await client.query(
          `SELECT provider_transaction_id,provider_verification_sha256
             FROM commerce.msn_fiat_verifications
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 FOR UPDATE`,
          [quote.tenantId,quote.userId,quote.quoteId],
        );
        if (check.rows[0]?.provider_transaction_id !== verified.providerTransactionId ||
            check.rows[0]?.provider_verification_sha256 !== verified.providerVerificationSha256)
          throw new Error("msn.quote.fiat_verification_conflict");
        await client.query("COMMIT");
      } catch(error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { client.release(); }
      const rows = await pool.query(PROJECTION +
        " WHERE q.tenant_id=$1 AND q.user_id=$2 AND q.quote_id=$3",
        [quote.tenantId,quote.userId,quote.quoteId],
      );
      if (!rows.rows[0]) throw new Error("msn.quote.readback_unavailable");
      return fundingStatus(rows.rows[0]);
    },
  });
}

import { MSN_SCALE, type MsnAdmission, type MsnConversionQuote } from "./admission.js";

export interface MsnPgQuery {
  query(sql: string, params?: unknown[]): Promise<{
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }>;
}
export interface MsnPgPool {
  connect(): Promise<MsnPgQuery & { release(): void }>;
  query: MsnPgQuery["query"];
}

export interface MsnBalance {
  readonly asset: "MSN";
  /** Decimal integer micros as string; no IEEE-754 conversion. */
  readonly spendableMicro: string;
}

/**
 * Database store; it does not establish financial eligibility.
 * Only call issue() after real authenticated session validation, currency
 * permission, independent signed provider settlement evidence, AML/risk checks,
 * reserved backing and admitMsnSettlement(). Never register issue as HTTP.
 */
export function createMsnLedgerStore(pool: MsnPgPool) {
  return Object.freeze({
    async readBalance(tenantId: string, userId: string): Promise<MsnBalance> {
      const result = await pool.query(
        `SELECT COALESCE(SUM(delta_micro),0)::text AS balance
           FROM commerce.msn_ledger_entries
          WHERE tenant_id=$1 AND user_id=$2 AND entry_side='customer'`,
        [tenantId, userId],
      );
      const raw = result.rows[0]?.balance;
      if (typeof raw !== "string" || !/^(0|[1-9][0-9]*)$/.test(raw))
        throw new Error("msn.balance.unavailable");
      return Object.freeze({ asset: "MSN" as const, spendableMicro: raw });
    },

    async issue(input: {
      readonly quote: MsnConversionQuote;
      readonly admission: MsnAdmission;
      /** SHA-256 of server-verified provider/custody proof. No customer data. */
      readonly verifiedEvidenceSha256: string;
    }): Promise<{ readonly quoteId: string; readonly msnCreditMicro: string; readonly replay: boolean }> {
      const { quote, admission: a } = input;
      if (!/^[0-9a-f]{64}$/.test(input.verifiedEvidenceSha256))
        throw new Error("msn.evidence.hash_required");
      if (a.quoteId !== quote.quoteId || a.userId !== quote.userId ||
          a.tenantId !== quote.tenantId || a.fundingReference !== quote.fundingReference ||
          a.backingAsset !== quote.backingAsset || a.backingNetwork !== quote.backingNetwork)
        throw new Error("msn.admission.quote_mismatch");
      // Recheck the economics at the persistence boundary. A reconstructed,
      // stale or malicious admission must not be able to enlarge an issuance.
      if (quote.pricePerMsnUsdMicro <= 0n ||
          quote.minimumSettledBackingUsdMicro <= 0n ||
          a.backingUsdMicro < quote.minimumSettledBackingUsdMicro ||
          (a.backingUsdMicro * MSN_SCALE) / quote.pricePerMsnUsdMicro !== a.msnCreditMicro)
        throw new Error("msn.admission.economics_mismatch");
      // Crypto balances remain the primary holdings. An on-chain crypto
      // deposit cannot ALSO mint MSN until F06 atomically reserves/debits the
      // same crypto liability. Never make two spendable claims on one deposit.
      if (quote.fundingRail !== "NGN_FLUTTERWAVE")
        throw new Error("msn.crypto.reservation_not_composed");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // A caller-supplied MsnAdmission and proof hash are never authority to
        // overwrite the immutable priced quote or fabricate fiat verification.
        // Re-bind the complete quote to the owner-scoped durable journal in
        // the SAME transaction that consumes NGN and posts both MSN entries.
        const persisted = await client.query(
          `SELECT q.user_id,q.funding_rail,q.funding_reference,
                  q.ngn_funding_kobo::text AS ngn_funding_kobo,
                  q.backing_asset,q.backing_network,
                  q.minimum_settled_backing_usd_micro::text AS minimum_backing,
                  q.price_per_msn_usd_micro::text AS price,
                  q.provider_quote_reference,q.issued_at,q.expires_at,
                  v.provider_transaction_id AS verified_provider_id
             FROM commerce.msn_funding_quotes q
             LEFT JOIN commerce.msn_fiat_verifications v
               ON v.tenant_id=q.tenant_id AND v.quote_id=q.quote_id
              AND v.user_id=q.user_id
            WHERE q.tenant_id=$1 AND q.user_id=$2 AND q.quote_id=$3
            FOR UPDATE OF q`,
          [a.tenantId, a.userId, a.quoteId],
        );
        const journal = persisted.rows[0];
        const recordedTime = (value: unknown): number =>
          value instanceof Date ? value.getTime() :
          typeof value === "string" ? Date.parse(value) : NaN;
        if (!journal || journal.user_id !== a.userId ||
            journal.funding_rail !== quote.fundingRail ||
            journal.funding_reference !== a.fundingReference ||
            journal.ngn_funding_kobo !== quote.ngnFundingKobo?.toString() ||
            journal.backing_asset !== a.backingAsset ||
            journal.backing_network !== a.backingNetwork ||
            journal.minimum_backing !== quote.minimumSettledBackingUsdMicro.toString() ||
            journal.price !== quote.pricePerMsnUsdMicro.toString() ||
            journal.provider_quote_reference !== quote.providerQuoteReference ||
            recordedTime(journal.issued_at) !== quote.issuedAtMs ||
            recordedTime(journal.expires_at) !== quote.expiresAtMs)
          throw new Error("msn.quote.persisted_terms_mismatch");
        if (typeof journal.verified_provider_id !== "string" ||
            !/^[0-9]{1,80}$/.test(journal.verified_provider_id))
          throw new Error("msn.ngn.fiat_verification_missing");

        const inserted = await client.query(
          `INSERT INTO commerce.msn_issuances (
              tenant_id,user_id,quote_id,funding_rail,funding_reference,
              provider_settlement_id,backing_asset,backing_network,
              backing_usd_micro,msn_credit_micro,price_per_msn_usd_micro,
              ngn_funding_kobo,verified_evidence_sha256
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT DO NOTHING RETURNING quote_id`,
          [a.tenantId, a.userId, a.quoteId, quote.fundingRail,
           a.fundingReference, a.providerSettlementId, a.backingAsset,
           a.backingNetwork, a.backingUsdMicro.toString(),
           a.msnCreditMicro.toString(), quote.pricePerMsnUsdMicro.toString(),
           quote.ngnFundingKobo?.toString() ?? null, input.verifiedEvidenceSha256],
        );
        if (inserted.rowCount === 1) {
          // Match creditFunding's lock order: funding intent, then the
          // canonical wallet advisory lock, to avoid an issuer/webhook deadlock.
          const funding = await client.query(
            `SELECT quote_id,amount_kobo::text AS amount_kobo,
                    provider_transaction_id,state
               FROM commerce.ngn_funding_intents
              WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3
              FOR UPDATE`,
            [a.tenantId, a.userId, a.fundingReference],
          );
          const fund = funding.rows[0];
          if (!fund || fund.state !== "credited" ||
              fund.quote_id !== a.quoteId ||
              fund.provider_transaction_id !== journal.verified_provider_id ||
              fund.amount_kobo !== quote.ngnFundingKobo?.toString()) {
            throw new Error("msn.ngn.funding_not_settled");
          }
          // Spend the NGN liability under the same wallet lock as billing.
          // The unique issuance settlement identifier is reserved globally.
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            "ngn-wallet:" + a.tenantId + ":" + a.userId,
          ]);
          const available = await client.query(
            `SELECT COALESCE(SUM(CASE WHEN direction='credit'
                    THEN amount_kobo ELSE -amount_kobo END),0)::text AS balance
               FROM commerce.ngn_wallet_entries
              WHERE tenant_id=$1 AND user_id=$2`,
            [a.tenantId, a.userId],
          );
          const current = available.rows[0]?.balance;
          if (typeof current !== "string" ||
              BigInt(current) < (quote.ngnFundingKobo ?? 0n)) {
            throw new Error("msn.ngn.insufficient_available");
          }
          await client.query(
            `INSERT INTO commerce.ngn_wallet_entries
               (tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,created_at)
             VALUES ($1,$2,$3,'debit',$4,'adjustment',$5,statement_timestamp())`,
            [a.tenantId, a.userId, "msn-convert:" + a.quoteId,
             quote.ngnFundingKobo!.toString(), "msn-convert:" + a.quoteId],
          );
          await client.query(
            `INSERT INTO commerce.msn_ledger_entries
             (tenant_id,quote_id,user_id,entry_side,delta_micro)
             VALUES ($1,$2,$3,'platform',$4),($1,$2,$3,'customer',$5)`,
            [a.tenantId, a.quoteId, a.userId, (-a.msnCreditMicro).toString(),
             a.msnCreditMicro.toString()],
          );
          // Deferred double-entry constraint is evaluated at COMMIT.
          await client.query("COMMIT");
          return Object.freeze({
            quoteId: a.quoteId, msnCreditMicro: a.msnCreditMicro.toString(), replay: false,
          });
        }
        // A provider settlement used by a different user, tenant or quote
        // conflicts globally. Only byte-for-byte matching issued economics can
        // be replayed; all else fails closed.
        const old = await client.query(
          `SELECT tenant_id,user_id,quote_id,funding_reference,
                  provider_settlement_id,backing_asset,backing_network,
                  backing_usd_micro::text AS backing_usd_micro,
                  msn_credit_micro::text AS msn_credit_micro,
                  price_per_msn_usd_micro::text AS price_per_msn_usd_micro,
                  ngn_funding_kobo::text AS ngn_funding_kobo,
                  verified_evidence_sha256
             FROM commerce.msn_issuances
            WHERE tenant_id=$1 AND quote_id=$2 FOR UPDATE`,
          [a.tenantId, a.quoteId],
        );
        const row = old.rows[0];
        if (!row ||
            row.tenant_id !== a.tenantId || row.user_id !== a.userId ||
            row.funding_reference !== a.fundingReference ||
            row.provider_settlement_id !== a.providerSettlementId ||
            row.backing_asset !== a.backingAsset ||
            row.backing_network !== a.backingNetwork ||
            row.backing_usd_micro !== a.backingUsdMicro.toString() ||
            row.msn_credit_micro !== a.msnCreditMicro.toString() ||
            row.price_per_msn_usd_micro !== quote.pricePerMsnUsdMicro.toString() ||
            row.ngn_funding_kobo !== (quote.ngnFundingKobo?.toString() ?? null) ||
            row.verified_evidence_sha256 !== input.verifiedEvidenceSha256) {
          throw new Error("msn.settlement.replay_conflict");
        }
        await client.query("COMMIT");
        return Object.freeze({
          quoteId: a.quoteId, msnCreditMicro: a.msnCreditMicro.toString(), replay: true,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  });
}

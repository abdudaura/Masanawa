import type { MsnAdmission, MsnConversionQuote } from "./admission.js";

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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
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

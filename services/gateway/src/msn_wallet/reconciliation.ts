import type { MsnPgPool } from "./store.js";

/**
 * Read-only accounting reconciliation for the STAGED 0112 MSN schema.
 * This checks recorded fiat and double-entry invariants, NOT whether crypto
 * was acquired, reserved, reconciled with a custodian or legally authorized.
 * It cannot mint, debit, pay, refund, or release financial rollout flags.
 */
export type MsnAccountingState =
  | "funding_pending"
  | "backing_pending"
  | "issued_accounting_consistent"
  | "anomaly";

export interface MsnReconciliationResult {
  readonly quoteId: string;
  readonly state: MsnAccountingState;
  readonly reasons: readonly string[];
  /** Always false: real custody cannot be inferred from internal SQL. */
  readonly custodyQualified: false;
}

export interface MsnReconciliationReport {
  readonly scanned: number;
  readonly results: readonly MsnReconciliationResult[];
  readonly truncated: boolean;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
function textValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !ID.test(value))
    throw new Error("msn.reconcile.invalid_" + name);
  return value;
}
function integer(value: unknown, name: string, allowZero = false): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error("msn.reconcile.invalid_" + name);
  const n = BigInt(value);
  if (!allowZero && n === 0n) throw new Error("msn.reconcile.invalid_" + name);
  return n;
}
function signedInteger(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^(0|-?[1-9][0-9]*)$/.test(value))
    throw new Error("msn.reconcile.invalid_" + name);
  return BigInt(value);
}

/**
 * Repeatable-read snapshot; only a trusted internal worker supplies tenantId.
 * No customer-facing API, no request-scoped arbitrary SQL, bounded rows.
 */
export function createMsnReconciler(pool: MsnPgPool) {
  return Object.freeze({
    async scan(tenantId: string, limit = 50): Promise<MsnReconciliationReport> {
      textValue(tenantId, "tenant");
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error("msn.reconcile.invalid_limit");
      const db = await pool.connect();
      try {
        await db.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const rows = await db.query(
          [
            "SELECT q.quote_id,q.funding_rail,q.user_id,q.funding_reference,",
            "q.ngn_funding_kobo::text AS expected_ngn_kobo,",
            "q.price_per_msn_usd_micro::text AS quote_price,",
            "q.backing_asset AS quote_asset,q.backing_network AS quote_network,",
            "v.provider_transaction_id AS verified_provider_id,",
            "i.provider_settlement_id AS custody_claim_id,",
            "i.funding_reference AS issuance_funding_reference,",
            "i.backing_asset AS issuance_asset,i.backing_network AS issuance_network,",
            "i.ngn_funding_kobo::text AS issuance_ngn_kobo,",
            "i.price_per_msn_usd_micro::text AS issuance_price,",
            "i.backing_usd_micro::text AS issuance_backing,",
            "i.msn_credit_micro::text AS issuance_credit,",
            "f.state AS funding_state,f.provider_transaction_id AS funding_provider_id,",
            "f.amount_kobo::text AS funding_amount_kobo,",
            "COALESCE(l.sides,0)::text AS ledger_sides,",
            "COALESCE(l.total,0)::text AS ledger_total,",
            "COALESCE(l.customer,0)::text AS ledger_customer,",
            "COALESCE(l.platform,0)::text AS ledger_platform",
            "FROM commerce.msn_funding_quotes q",
            "LEFT JOIN commerce.msn_fiat_verifications v",
            " ON v.tenant_id=q.tenant_id AND v.quote_id=q.quote_id AND v.user_id=q.user_id",
            "LEFT JOIN commerce.msn_issuances i",
            " ON i.tenant_id=q.tenant_id AND i.quote_id=q.quote_id AND i.user_id=q.user_id",
            "LEFT JOIN commerce.ngn_funding_intents f",
            " ON f.tenant_id=q.tenant_id AND f.user_id=q.user_id",
            " AND f.funding_reference=q.funding_reference",
            "LEFT JOIN LATERAL (SELECT count(*) AS sides,",
            " COALESCE(sum(e.delta_micro),0) AS total,",
            " COALESCE(sum(e.delta_micro) FILTER (WHERE e.entry_side='customer'),0) AS customer,",
            " COALESCE(sum(e.delta_micro) FILTER (WHERE e.entry_side='platform'),0) AS platform",
            " FROM commerce.msn_ledger_entries e",
            " WHERE e.tenant_id=q.tenant_id AND e.quote_id=q.quote_id AND e.user_id=q.user_id",
            ") l ON true",
            "WHERE q.tenant_id=$1",
            "ORDER BY q.issued_at DESC,q.quote_id DESC LIMIT $2",
          ].join(" "), [tenantId, limit + 1],
        );
        if (rows.rows.length > limit + 1)
          throw new Error("msn.reconcile.unbounded_read");
        const output: MsnReconciliationResult[] = [];
        for (const row of rows.rows.slice(0, limit)) {
          const id = textValue(row.quote_id, "quote");
          const reasons: string[] = [];
          const issued = row.custody_claim_id !== null;
          const verified = row.verified_provider_id !== null;
          const sides = integer(row.ledger_sides, "ledger_sides", true);
          const total = signedInteger(row.ledger_total, "ledger_total");
          const customer = signedInteger(row.ledger_customer, "ledger_customer");
          const platform = signedInteger(row.ledger_platform, "ledger_platform");
          if (issued) {
            textValue(row.custody_claim_id, "settlement_id");
            if (!verified && row.funding_rail === "NGN_FLUTTERWAVE")
              reasons.push("issuance_without_verified_fiat");
            if (row.issuance_funding_reference !== row.funding_reference ||
                row.issuance_asset !== row.quote_asset ||
                row.issuance_network !== row.quote_network ||
                row.issuance_price !== row.quote_price ||
                row.issuance_ngn_kobo !== row.expected_ngn_kobo)
              reasons.push("issuance_quote_mismatch");
            const credit = integer(row.issuance_credit, "issuance_credit");
            const backing = integer(row.issuance_backing, "issuance_backing");
            const price = integer(row.quote_price, "quote_price");
            if (backing * 1_000_000n / price !== credit)
              reasons.push("issuance_economics_mismatch");
            if (sides !== 2n || total !== 0n || customer !== credit || platform !== -credit)
              reasons.push("double_entry_mismatch");
          } else if (sides !== 0n || total !== 0n || customer !== 0n || platform !== 0n) {
            reasons.push("orphan_ledger_entries");
          }
          if (row.funding_rail === "NGN_FLUTTERWAVE" && (verified || issued)) {
            if (row.funding_state !== "credited" ||
                row.funding_amount_kobo !== row.expected_ngn_kobo)
              reasons.push("funding_not_currently_credited");
            if (verified && row.funding_provider_id !== row.verified_provider_id)
              reasons.push("fiat_provider_mismatch");
          }
          const state: MsnAccountingState = reasons.length ? "anomaly" :
            issued ? "issued_accounting_consistent" :
            verified ? "backing_pending" : "funding_pending";
          output.push(Object.freeze({
            quoteId: id, state, reasons: Object.freeze(reasons), custodyQualified: false as const,
          }));
        }
        await db.query("COMMIT");
        return Object.freeze({
          scanned: output.length, results: Object.freeze(output),
          truncated: rows.rows.length > limit,
        });
      } catch (error) {
        await db.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        db.release();
      }
    },
  });
}

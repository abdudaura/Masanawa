import type { MsnPgPool } from "./store.js";

/**
 * Canonical NGN funding-intent read. It does not credit a balance or establish
 * custody backing. A repeatable-read snapshot prevents an intent/ledger
 * mismatch caused by concurrent payment confirmation.
 */
export interface MsnFiatIntakeRecord {
  readonly tenantId: string;
  readonly userId: string;
  readonly fundingReference: string;
  readonly quoteId: string | null;
  readonly txRef: string;
  readonly amountKobo: bigint;
  readonly state: "creating" | "awaiting" | "credited" | "expired" | "failed";
  readonly providerTransactionId: string | null;
  readonly providerReference: string | null;
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
function identifier(value: string): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value))
    throw new Error("msn.fiat_intake.identity_invalid");
}
function stringValue(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(code);
  return value;
}
function amountKobo(value: unknown): bigint {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value))
    throw new Error("msn.fiat_intake.ledger_invalid");
  return BigInt(value);
}
export function createMsnFiatIntakeReader(pool: MsnPgPool) {
  return Object.freeze({
    async read(input: Readonly<{
      tenantId: string;
      userId: string;
      fundingReference: string;
    }>): Promise<MsnFiatIntakeRecord | null> {
      identifier(input.tenantId);
      identifier(input.userId);
      identifier(input.fundingReference);
      const client = await pool.connect();
      try {
        await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const result = await client.query(
          `SELECT tenant_id, user_id, funding_reference, quote_id, tx_ref,
                  amount_kobo::text AS amount_kobo, state,
                  provider_transaction_id, provider_reference
             FROM commerce.ngn_funding_intents
            WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3`,
          [input.tenantId, input.userId, input.fundingReference],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query("COMMIT");
          return null;
        }
        if (row.tenant_id !== input.tenantId ||
            row.user_id !== input.userId ||
            row.funding_reference !== input.fundingReference)
          throw new Error("msn.fiat_intake.owner_mismatch");
        const state = row.state;
        if (state !== "creating" && state !== "awaiting" && state !== "credited" &&
            state !== "expired" && state !== "failed")
          throw new Error("msn.fiat_intake.state_invalid");

        const entries = await client.query(
          `SELECT amount_kobo::text AS amount_kobo, provider_transaction_id
             FROM commerce.ngn_wallet_entries
            WHERE tenant_id=$1 AND user_id=$2 AND reason='funding'
              AND direction='credit' AND reference=$3`,
          [input.tenantId, input.userId, input.fundingReference],
        );
        const credited = entries.rows;
        if (credited.length > 1 ||
            (state === "credited" && credited.length !== 1) ||
            (state !== "credited" && credited.length !== 0))
          throw new Error("msn.fiat_intake.ledger_inconsistent");
        const intentAmount = amountKobo(row.amount_kobo);
        const transactionId = row.provider_transaction_id;
        if (state === "credited") {
          if (typeof transactionId !== "string" || !/^[0-9]{1,80}$/.test(transactionId) ||
              amountKobo(credited[0]?.amount_kobo) !== intentAmount ||
              credited[0]?.provider_transaction_id !== transactionId)
            throw new Error("msn.fiat_intake.ledger_inconsistent");
        }
        const record: MsnFiatIntakeRecord = Object.freeze({
          tenantId: input.tenantId, userId: input.userId,
          fundingReference: input.fundingReference,
          quoteId: row.quote_id === null ? null :
            stringValue(row.quote_id, "msn.fiat_intake.quote_invalid"),
          txRef: stringValue(row.tx_ref, "msn.fiat_intake.tx_ref_invalid"),
          amountKobo: intentAmount,
          state,
          providerTransactionId: transactionId === null ? null :
            stringValue(transactionId, "msn.fiat_intake.provider_id_invalid"),
          providerReference: row.provider_reference === null ? null :
            stringValue(row.provider_reference, "msn.fiat_intake.provider_reference_invalid"),
        });
        await client.query("COMMIT");
        return record;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  });
}

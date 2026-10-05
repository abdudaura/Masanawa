import type { Pool } from "pg";
import type {
  BillingFulfillmentRecord,
  BillingFulfillmentStore,
} from "@masanawa/providers";
import { withTransaction } from "../transaction.js";

interface BillingFulfillmentRow {
  tenant_id: string;
  user_id: string;
  fulfillment_reference: string;
  biller_code: string;
  item_code: string;
  item_name: string;
  customer_id: string;
  customer_name: string | null;
  amount: string;
  currency: "NGN";
  revision: number;
  state: BillingFulfillmentRecord["state"];
  provider_reference: string | null;
  provider_status: string | null;
  last_evidence_at: Date | null;
  delivery_code: string | null;
}

function toRecord(row: BillingFulfillmentRow): BillingFulfillmentRecord {
  return Object.freeze({
    fulfillmentReference: row.fulfillment_reference,
    billerCode: row.biller_code,
    itemCode: row.item_code,
    itemName: row.item_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    amount: row.amount,
    currency: row.currency,
    revision: row.revision,
    state: row.state,
    providerReference: row.provider_reference,
    providerStatus: row.provider_status,
    lastEvidenceAt: row.last_evidence_at?.toISOString() ?? null,
    deliveryCode: row.delivery_code,
  });
}

function sameTerms(
  left: BillingFulfillmentRecord,
  right: BillingFulfillmentRecord,
): boolean {
  return (
    left.fulfillmentReference === right.fulfillmentReference &&
    left.billerCode === right.billerCode &&
    left.itemCode === right.itemCode &&
    left.itemName === right.itemName &&
    left.customerId === right.customerId &&
    left.customerName === right.customerName &&
    left.amount === right.amount &&
    left.currency === right.currency
  );
}

export function createPostgresBillingFulfillmentStore(
  pool: Pool,
  identity: Readonly<{ tenantId: string; userId: string }>,
): BillingFulfillmentStore {
  return Object.freeze({
    async createIfAbsent(input) {
      return withTransaction(pool, async (client) => {
        const inserted = await client.query<BillingFulfillmentRow>(
          `INSERT INTO commerce.billing_fulfillments(
             tenant_id,user_id,fulfillment_reference,biller_code,item_code,item_name,
             customer_id,customer_name,amount,currency,revision,state,
             provider_reference,provider_status,last_evidence_at,delivery_code
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (tenant_id,user_id,fulfillment_reference) DO NOTHING
           RETURNING *`,
          [
            identity.tenantId,
            identity.userId,
            input.fulfillmentReference,
            input.billerCode,
            input.itemCode,
            input.itemName,
            input.customerId,
            input.customerName,
            input.amount,
            input.currency,
            input.revision,
            input.state,
            input.providerReference,
            input.providerStatus,
            input.lastEvidenceAt,
            input.deliveryCode ?? null,
          ],
        );
        if (inserted.rows[0]) {
          return Object.freeze({
            record: toRecord(inserted.rows[0]),
            created: true,
          });
        }
        const existing = await client.query<BillingFulfillmentRow>(
          `SELECT * FROM commerce.billing_fulfillments
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3`,
          [identity.tenantId,identity.userId,input.fulfillmentReference],
        );
        if (!existing.rows[0]) {
          throw new Error("financial.billing.fulfillment_insert_conflict");
        }
        return Object.freeze({
          record: toRecord(existing.rows[0]),
          created: false,
        });
      }, { isolation: "serializable" });
    },

    async read(reference) {
      const normalized = reference.trim();
      if (!normalized || normalized.length > 128) {
        throw new TypeError("financial.billing.fulfillment_reference_invalid");
      }
      return withTransaction(pool, async (client) => {
        const result = await client.query<BillingFulfillmentRow>(
          `SELECT * FROM commerce.billing_fulfillments
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3`,
          [identity.tenantId,identity.userId,normalized],
        );
        return result.rows[0] ? toRecord(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async compareAndSet(expectedRevision,next) {
      if (
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 1 ||
        next.revision !== expectedRevision + 1
      ) {
        throw new Error("financial.billing.fulfillment_revision_invalid");
      }
      return withTransaction(pool, async (client) => {
        const locked = await client.query<BillingFulfillmentRow>(
          `SELECT * FROM commerce.billing_fulfillments
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3
            FOR UPDATE`,
          [identity.tenantId,identity.userId,next.fulfillmentReference],
        );
        const currentRow = locked.rows[0];
        if (!currentRow) throw new Error("financial.billing.fulfillment_not_found");
        const current = toRecord(currentRow);
        if (current.revision !== expectedRevision) {
          throw new Error("financial.billing.fulfillment_revision_conflict");
        }
        if (!sameTerms(current,next)) {
          throw new Error("financial.billing.fulfillment_terms_immutable");
        }

        const updated = await client.query<BillingFulfillmentRow>(
          `UPDATE commerce.billing_fulfillments
              SET revision=$4,
                  state=$5,
                  provider_reference=$6,
                  provider_status=$7,
                  last_evidence_at=$8,
                  delivery_code=$9,
                  updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3
              AND revision=$10
            RETURNING *`,
          [
            identity.tenantId,
            identity.userId,
            next.fulfillmentReference,
            next.revision,
            next.state,
            next.providerReference,
            next.providerStatus,
            next.lastEvidenceAt,
            next.deliveryCode ?? null,
            expectedRevision,
          ],
        );
        if (!updated.rows[0]) {
          throw new Error("financial.billing.fulfillment_revision_conflict");
        }
        return toRecord(updated.rows[0]);
      }, { isolation: "serializable" });
    },
  });
}

export interface BillingWebhookAdmissionRepository {
  admitProviderWebhook(input: Readonly<{
    provider: string;
    fingerprint: string;
    eventKey: string;
    receivedAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>): Promise<Readonly<{ duplicate: boolean }>>;
}

export function createPostgresBillingWebhookRepository(
  pool: Pool,
): BillingWebhookAdmissionRepository {
  return Object.freeze({
    async admitProviderWebhook(input) {
      const provider = input.provider.trim();
      const fingerprint = input.fingerprint.trim();
      const eventKey = input.eventKey.trim();
      if (!provider || provider.length > 80) {
        throw new TypeError("financial.billing.webhook_provider_invalid");
      }
      if (!fingerprint || fingerprint.length > 160) {
        throw new TypeError("financial.billing.webhook_fingerprint_invalid");
      }
      if (!eventKey || eventKey.length > 300) {
        throw new TypeError("financial.billing.webhook_event_key_invalid");
      }
      const result = await pool.query(
        `INSERT INTO commerce.billing_webhook_admissions(
           provider,fingerprint,event_key,received_at
         )
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [provider,fingerprint,eventKey,input.receivedAt],
      );
      return Object.freeze({ duplicate: result.rowCount === 0 });
    },
  });
}

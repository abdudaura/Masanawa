import type { Pool } from "pg";
import {
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
} from "@masanawa/providers";
import { canonicalJson } from "@masanawa/security";
import { withTransaction } from "../transaction.js";

export interface ProviderWebhookAdmission {
  readonly duplicate: boolean;
}

export interface ProviderWebhookRepository {
  admitProviderWebhook(input: Readonly<{
    provider: string;
    fingerprint: string;
    eventKey: string;
    receivedAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>): Promise<ProviderWebhookAdmission>;
}

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`);
  const result = value.trim();
  if (result.length < 1 || result.length > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return result;
}

function instant(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("timestamp is invalid");
  return new Date(timestamp).toISOString();
}

function normalizeBillingRecord(
  record: BillingFulfillmentRecord,
): BillingFulfillmentRecord {
  const reference = bounded(
    record.fulfillmentReference,
    "fulfillmentReference",
    128,
  );
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new Error("financial.billing_revision_invalid");
  }
  return Object.freeze({ ...record, fulfillmentReference: reference });
}

export function createPostgresProviderWebhookRepository(
  pool: Pool,
): ProviderWebhookRepository {
  return Object.freeze({
    async admitProviderWebhook(input) {
      const provider = bounded(input.provider, "provider", 64);
      const fingerprint = bounded(input.fingerprint, "fingerprint", 160);
      const eventKey = bounded(input.eventKey, "eventKey", 256);
      const receivedAt = instant(input.receivedAt);
      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO commerce.provider_webhook_events(
             provider,fingerprint,event_key,received_at,payload
           ) VALUES ($1,$2,$3,$4,$5::jsonb)
           ON CONFLICT (provider,fingerprint) DO NOTHING`,
          [
            provider,
            fingerprint,
            eventKey,
            receivedAt,
            canonicalJson(input.payload),
          ],
        );
        return Object.freeze({ duplicate: result.rowCount === 0 });
      });
    },
  });
}

export function createPostgresBillingFulfillmentStore(
  pool: Pool,
  owner: Readonly<{ tenantId: string; userId: string }>,
): BillingFulfillmentStore {
  const tenantId = bounded(owner.tenantId, "tenantId", 160);
  const userId = bounded(owner.userId, "userId", 160);

  return Object.freeze({
    async createIfAbsent(input) {
      const record = normalizeBillingRecord(input);
      const now = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `financial:billing:${record.fulfillmentReference}`,
        ]);
        const existing = await client.query<{
          definition: BillingFulfillmentRecord;
          tenant_id: string;
          user_id: string;
        }>(
          `SELECT definition,tenant_id,user_id
             FROM commerce.billing_fulfillments
            WHERE fulfillment_reference=$1`,
          [record.fulfillmentReference],
        );
        if (existing.rows[0]) {
          if (
            existing.rows[0].tenant_id !== tenantId ||
            existing.rows[0].user_id !== userId
          ) {
            throw new Error("financial.billing_reference_scope_conflict");
          }
          return Object.freeze({
            record: normalizeBillingRecord(existing.rows[0].definition),
            created: false,
          });
        }
        await client.query(
          `INSERT INTO commerce.billing_fulfillments(
             fulfillment_reference,tenant_id,user_id,revision,state,
             definition,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
          [
            record.fulfillmentReference,
            tenantId,
            userId,
            record.revision,
            record.state,
            canonicalJson(record),
            now,
          ],
        );
        return Object.freeze({ record, created: true });
      });
    },

    async read(reference) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{
            definition: BillingFulfillmentRecord;
          }>(
            `SELECT definition
               FROM commerce.billing_fulfillments
              WHERE fulfillment_reference=$1
                AND tenant_id=$2
                AND user_id=$3`,
            [bounded(reference, "fulfillmentReference", 128), tenantId, userId],
          );
          return result.rows[0]
            ? normalizeBillingRecord(result.rows[0].definition)
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async compareAndSet(expectedRevision, input) {
      const record = normalizeBillingRecord(input);
      if (record.revision !== expectedRevision + 1) {
        throw new Error("financial.billing_revision_invalid");
      }
      const updatedAt = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        const result = await client.query<{
          definition: BillingFulfillmentRecord;
        }>(
          `UPDATE commerce.billing_fulfillments
              SET revision=$4,state=$5,definition=$6::jsonb,updated_at=$7
            WHERE fulfillment_reference=$1
              AND tenant_id=$2
              AND user_id=$3
              AND revision=$8
            RETURNING definition`,
          [
            record.fulfillmentReference,
            tenantId,
            userId,
            record.revision,
            record.state,
            canonicalJson(record),
            updatedAt,
            expectedRevision,
          ],
        );
        if (!result.rows[0]) {
          throw new Error("financial.billing_revision_conflict");
        }
        return normalizeBillingRecord(result.rows[0].definition);
      });
    },
  });
}

import type { Pool } from "pg";
import type { BillingFulfillmentRecord, BillingFulfillmentStore } from "@masanawa/providers";
import { canonicalJson } from "@masanawa/security";
import { withTransaction } from "../transaction.js";

export type CryptoPaymentState =
  | "dispatching"
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired"
  | "manual_review";

export interface CryptoPaymentIntent {
  readonly tenantId: string;
  readonly userId: string;
  readonly requestId: string;
  readonly orderId: string;
  readonly revision: number;
  readonly state: CryptoPaymentState;
  readonly priceAmount: number;
  readonly priceCurrency: string;
  readonly payCurrency: string;
  readonly minimumAmount: number;
  readonly estimatedAmount: number;
  readonly providerPaymentId: string | null;
  readonly purchaseId: string | null;
  readonly parentPaymentId: string | null;
  readonly payAddress: string | null;
  readonly payAmount: number | null;
  readonly actuallyPaid: number;
  readonly lastEvidenceHash: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProviderWebhookAdmission {
  readonly duplicate: boolean;
}

export interface FinancialOperationsRepository {
  createCryptoPaymentIntent(input: CryptoPaymentIntent): Promise<Readonly<{
    record: CryptoPaymentIntent;
    created: boolean;
  }>>;
  readCryptoPaymentIntent(input: Readonly<{
    tenantId: string;
    userId: string;
    requestId: string;
  }>): Promise<CryptoPaymentIntent | null>;
  readCryptoPaymentByProviderId(providerPaymentId: string): Promise<CryptoPaymentIntent | null>;
  readCryptoPaymentByOrderId(input: Readonly<{
    tenantId: string;
    orderId: string;
  }>): Promise<CryptoPaymentIntent | null>;
  compareAndSetCryptoPayment(
    expectedRevision: number,
    next: CryptoPaymentIntent,
  ): Promise<CryptoPaymentIntent>;
  admitProviderWebhook(input: Readonly<{
    provider: string;
    fingerprint: string;
    eventKey: string;
    receivedAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>): Promise<ProviderWebhookAdmission>;
}

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} is invalid`);
  return value;
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} is invalid`);
  return value;
}

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`);
  const result = value.trim();
  if (result.length < 1 || result.length > max) throw new TypeError(`${label} is invalid`);
  return result;
}

function optionalBounded(value: string | null, label: string, max: number): string | null {
  return value === null ? null : bounded(value, label, max);
}

function instant(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("timestamp is invalid");
  return new Date(timestamp).toISOString();
}

function normalizeCryptoPayment(input: CryptoPaymentIntent): CryptoPaymentIntent {
  const requestId = bounded(input.requestId, "requestId", 160);
  if (!/^request_/u.test(requestId)) throw new TypeError("requestId is invalid");
  const revision = input.revision;
  if (!Number.isSafeInteger(revision) || revision < 1) throw new TypeError("revision is invalid");
  const state: CryptoPaymentState = input.state;
  const allowed = new Set<CryptoPaymentState>([
    "dispatching","waiting","confirming","confirmed","sending","partially_paid",
    "finished","failed","refunded","expired","manual_review",
  ]);
  if (!allowed.has(state)) throw new TypeError("state is invalid");
  const createdAt = instant(input.createdAt);
  const updatedAt = instant(input.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new TypeError("updatedAt is invalid");
  return Object.freeze({
    tenantId: bounded(input.tenantId, "tenantId", 160),
    userId: bounded(input.userId, "userId", 160),
    requestId,
    orderId: bounded(input.orderId, "orderId", 128),
    revision,
    state,
    priceAmount: positive(input.priceAmount, "priceAmount"),
    priceCurrency: bounded(input.priceCurrency, "priceCurrency", 32).toUpperCase(),
    payCurrency: bounded(input.payCurrency, "payCurrency", 32).toUpperCase(),
    minimumAmount: positive(input.minimumAmount, "minimumAmount"),
    estimatedAmount: positive(input.estimatedAmount, "estimatedAmount"),
    providerPaymentId: optionalBounded(input.providerPaymentId, "providerPaymentId", 128),
    purchaseId: optionalBounded(input.purchaseId, "purchaseId", 128),
    parentPaymentId: optionalBounded(input.parentPaymentId, "parentPaymentId", 128),
    payAddress: optionalBounded(input.payAddress, "payAddress", 512),
    payAmount: input.payAmount === null ? null : positive(input.payAmount, "payAmount"),
    actuallyPaid: nonNegative(input.actuallyPaid, "actuallyPaid"),
    lastEvidenceHash: optionalBounded(input.lastEvidenceHash, "lastEvidenceHash", 160),
    createdAt,
    updatedAt,
  });
}

function cryptoFromRow(value: unknown): CryptoPaymentIntent {
  return normalizeCryptoPayment(value as CryptoPaymentIntent);
}

export function createPostgresFinancialOperationsRepository(
  pool: Pool,
): FinancialOperationsRepository {
  return Object.freeze({
    async createCryptoPaymentIntent(input) {
      const record = normalizeCryptoPayment(input);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `financial:crypto:${record.tenantId}:${record.userId}:${record.requestId}`,
        ]);
        const existing = await client.query<{ definition: unknown }>(
          `SELECT definition FROM commerce.crypto_payment_intents
           WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3`,
          [record.tenantId, record.userId, record.requestId],
        );
        if (existing.rows[0]) {
          const replay = cryptoFromRow(existing.rows[0].definition);
          const identity = (value: CryptoPaymentIntent) => ({
            tenantId: value.tenantId,
            userId: value.userId,
            requestId: value.requestId,
            orderId: value.orderId,
            priceAmount: value.priceAmount,
            priceCurrency: value.priceCurrency,
            payCurrency: value.payCurrency,
          });
          if (canonicalJson(identity(replay)) !== canonicalJson(identity(record))) {
            throw new Error("financial.crypto_request_conflict");
          }
          return Object.freeze({ record: replay, created: false });
        }
        await client.query(
          `INSERT INTO commerce.crypto_payment_intents(
             tenant_id,user_id,request_id,order_id,revision,state,
             price_amount,price_currency,pay_currency,minimum_amount,estimated_amount,
             provider_payment_id,purchase_id,parent_payment_id,pay_address,pay_amount,
             actually_paid,last_evidence_hash,created_at,updated_at,definition
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb
           )`,
          [
            record.tenantId,record.userId,record.requestId,record.orderId,record.revision,record.state,
            record.priceAmount,record.priceCurrency,record.payCurrency,record.minimumAmount,
            record.estimatedAmount,record.providerPaymentId,record.purchaseId,record.parentPaymentId,
            record.payAddress,record.payAmount,record.actuallyPaid,record.lastEvidenceHash,
            record.createdAt,record.updatedAt,canonicalJson(record),
          ],
        );
        return Object.freeze({ record, created: true });
      });
    },

    async readCryptoPaymentIntent(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: unknown }>(
          `SELECT definition FROM commerce.crypto_payment_intents
           WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3`,
          [input.tenantId,input.userId,input.requestId],
        );
        return result.rows[0] ? cryptoFromRow(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readCryptoPaymentByProviderId(providerPaymentId) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: unknown }>(
          `SELECT definition FROM commerce.crypto_payment_intents
           WHERE provider_payment_id=$1`,
          [bounded(providerPaymentId, "providerPaymentId", 128)],
        );
        return result.rows[0] ? cryptoFromRow(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readCryptoPaymentByOrderId(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: unknown }>(
          `SELECT definition FROM commerce.crypto_payment_intents
           WHERE tenant_id=$1 AND order_id=$2`,
          [input.tenantId,bounded(input.orderId, "orderId", 128)],
        );
        return result.rows[0] ? cryptoFromRow(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async compareAndSetCryptoPayment(expectedRevision, nextInput) {
      const next = normalizeCryptoPayment(nextInput);
      if (next.revision !== expectedRevision + 1) throw new Error("financial.crypto_revision_invalid");
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: unknown }>(
          `UPDATE commerce.crypto_payment_intents
              SET revision=$4,state=$5,provider_payment_id=$6,purchase_id=$7,parent_payment_id=$8,
                  pay_address=$9,pay_amount=$10,actually_paid=$11,last_evidence_hash=$12,
                  updated_at=$13,definition=$14::jsonb
            WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3 AND revision=$15
            RETURNING definition`,
          [
            next.tenantId,next.userId,next.requestId,next.revision,next.state,next.providerPaymentId,
            next.purchaseId,next.parentPaymentId,next.payAddress,next.payAmount,next.actuallyPaid,
            next.lastEvidenceHash,next.updatedAt,canonicalJson(next),expectedRevision,
          ],
        );
        if (!result.rows[0]) throw new Error("financial.crypto_revision_conflict");
        return cryptoFromRow(result.rows[0].definition);
      });
    },

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
          [provider,fingerprint,eventKey,receivedAt,canonicalJson(input.payload)],
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
  function normalized(record: BillingFulfillmentRecord): BillingFulfillmentRecord {
    const reference = bounded(record.fulfillmentReference, "fulfillmentReference", 128);
    if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
      throw new Error("financial.billing_revision_invalid");
    }
    return Object.freeze({ ...record, fulfillmentReference: reference });
  }
  return Object.freeze({
    async createIfAbsent(input) {
      const record = normalized(input);
      const now = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `financial:billing:${record.fulfillmentReference}`,
        ]);
        const existing = await client.query<{ definition: BillingFulfillmentRecord }>(
          "SELECT definition FROM commerce.billing_fulfillments WHERE fulfillment_reference=$1",
          [record.fulfillmentReference],
        );
        if (existing.rows[0]) {
          return Object.freeze({ record: normalized(existing.rows[0].definition), created: false });
        }
        await client.query(
          `INSERT INTO commerce.billing_fulfillments(
             fulfillment_reference,tenant_id,user_id,revision,state,definition,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
          [record.fulfillmentReference,tenantId,userId,record.revision,record.state,canonicalJson(record),now],
        );
        return Object.freeze({ record, created: true });
      });
    },
    async read(reference) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: BillingFulfillmentRecord }>(
          `SELECT definition FROM commerce.billing_fulfillments
           WHERE fulfillment_reference=$1 AND tenant_id=$2 AND user_id=$3`,
          [bounded(reference,"fulfillmentReference",128),tenantId,userId],
        );
        return result.rows[0] ? normalized(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },
    async compareAndSet(expectedRevision, input) {
      const record = normalized(input);
      if (record.revision !== expectedRevision + 1) throw new Error("financial.billing_revision_invalid");
      const updatedAt = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: BillingFulfillmentRecord }>(
          `UPDATE commerce.billing_fulfillments
              SET revision=$4,state=$5,definition=$6::jsonb,updated_at=$7
            WHERE fulfillment_reference=$1 AND tenant_id=$2 AND user_id=$3 AND revision=$8
            RETURNING definition`,
          [record.fulfillmentReference,tenantId,userId,record.revision,record.state,canonicalJson(record),updatedAt,expectedRevision],
        );
        if (!result.rows[0]) throw new Error("financial.billing_revision_conflict");
        return normalized(result.rows[0].definition);
      });
    },
  });
}

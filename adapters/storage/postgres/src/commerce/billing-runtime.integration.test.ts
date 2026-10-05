import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import {
  createPostgresBillingFulfillmentStore,
  createPostgresBillingWebhookRepository,
} from "./billing-runtime.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("billing runtime PostgreSQL acceptance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(
        new URL("../../../../../packages/commerce/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("scopes fulfillment evidence by tenant and user and enforces CAS", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const otherUserId = createCanonicalId("user");
    const store = createPostgresBillingFulfillmentStore(pool, {
      tenantId,
      userId,
    });
    const other = createPostgresBillingFulfillmentStore(pool, {
      tenantId,
      userId: otherUserId,
    });

    const initial = Object.freeze({
      fulfillmentReference: "bill-runtime-acceptance-1",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "08012345678",
      customerName: null,
      amount: "100",
      currency: "NGN" as const,
      revision: 1,
      state: "ready" as const,
      providerReference: null,
      providerStatus: null,
      lastEvidenceAt: null,
      deliveryCode: null,
    });

    const created = await store.createIfAbsent(initial);
    expect(created.created).toBe(true);
    await expect(other.read(initial.fulfillmentReference)).resolves.toBeNull();

    const dispatching = Object.freeze({
      ...initial,
      revision: 2,
      state: "dispatching" as const,
      lastEvidenceAt: "2026-10-05T01:00:00.000Z",
    });
    await expect(store.compareAndSet(1, dispatching)).resolves.toMatchObject({
      revision: 2,
      state: "dispatching",
    });

    await expect(store.compareAndSet(1, {
      ...dispatching,
      revision: 2,
    })).rejects.toThrow("fulfillment_revision_conflict");

    await expect(store.compareAndSet(2, {
      ...dispatching,
      itemCode: "CHANGED",
      revision: 3,
      state: "checking",
    })).rejects.toThrow("fulfillment_terms_immutable");
  });

  it("admits each provider webhook fingerprint/event only once", async () => {
    const repository = createPostgresBillingWebhookRepository(pool);
    const at = new Date().toISOString();

    await expect(repository.admitProviderWebhook({
      provider: "flutterwave",
      fingerprint: "fingerprint-acceptance-1",
      eventKey: "bill:reference-1:charge.completed",
      receivedAt: at,
      payload: { ignored: true },
    })).resolves.toEqual({ duplicate: false });

    await expect(repository.admitProviderWebhook({
      provider: "flutterwave",
      fingerprint: "fingerprint-acceptance-1",
      eventKey: "bill:reference-1:charge.completed",
      receivedAt: at,
      payload: { ignored: true },
    })).resolves.toEqual({ duplicate: true });

    await expect(repository.admitProviderWebhook({
      provider: "flutterwave",
      fingerprint: "different-fingerprint",
      eventKey: "bill:reference-1:charge.completed",
      receivedAt: at,
      payload: { ignored: true },
    })).resolves.toEqual({ duplicate: true });
  });
});

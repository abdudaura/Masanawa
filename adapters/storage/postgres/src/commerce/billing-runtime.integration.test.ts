import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestDatabase } from "../../../../../test/support/isolated-postgres.js";
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
  let isolated: Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>> | undefined;

  beforeAll(async () => {
    isolated = await createIsolatedPostgresTestDatabase(connectionString!);
    pool = isolated.pool;
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(
        new URL("../../../../../packages/commerce/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await isolated?.close();
  });

  it("scopes fulfillment evidence by tenant and user and enforces immutable terms", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const otherUserId = createCanonicalId("user");
    const store = createPostgresBillingFulfillmentStore(pool, {
      tenantId,
      userId,
    });
    const otherUser = createPostgresBillingFulfillmentStore(pool, {
      tenantId,
      userId: otherUserId,
    });
    const otherTenant = createPostgresBillingFulfillmentStore(pool, {
      tenantId: otherTenantId,
      userId,
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
    expect(created).toMatchObject({ created: true, record: initial });
    await expect(otherUser.read(initial.fulfillmentReference)).resolves.toBeNull();
    await expect(otherTenant.read(initial.fulfillmentReference)).resolves.toBeNull();

    const replay = await store.createIfAbsent({
      ...initial,
      itemCode: "SHOULD-NOT-REPLACE",
    });
    expect(replay.created).toBe(false);
    expect(replay.record).toEqual(initial);

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

  it("allows only one concurrent compare-and-set winner", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const store = createPostgresBillingFulfillmentStore(pool, { tenantId, userId });
    const initial = Object.freeze({
      fulfillmentReference: "bill-runtime-cas-race-1",
      billerCode: "BIL102",
      itemCode: "AT102",
      itemName: "MTN Airtime",
      customerId: "08055550123",
      customerName: null,
      amount: "200",
      currency: "NGN" as const,
      revision: 1,
      state: "ready" as const,
      providerReference: null,
      providerStatus: null,
      lastEvidenceAt: null,
      deliveryCode: null,
    });
    await store.createIfAbsent(initial);

    const outcomes = await Promise.allSettled([
      store.compareAndSet(1, {
        ...initial,
        revision: 2,
        state: "dispatching",
        lastEvidenceAt: "2026-10-05T01:10:00.000Z",
      }),
      store.compareAndSet(1, {
        ...initial,
        revision: 2,
        state: "checking",
        lastEvidenceAt: "2026-10-05T01:10:01.000Z",
      }),
    ]);

    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);

    const persisted = await store.read(initial.fulfillmentReference);
    expect(persisted?.revision).toBe(2);
    expect(["dispatching", "checking"]).toContain(persisted?.state);
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

    await expect(repository.admitProviderWebhook({
      provider: "flutterwave",
      fingerprint: "fingerprint-acceptance-2",
      eventKey: "bill:reference-2:charge.completed",
      receivedAt: at,
      payload: { ignored: true },
    })).resolves.toEqual({ duplicate: false });

    await expect(repository.admitProviderWebhook({
      provider: "other-provider",
      fingerprint: "fingerprint-acceptance-2",
      eventKey: "bill:reference-2:charge.completed",
      receivedAt: at,
      payload: { ignored: true },
    })).resolves.toEqual({ duplicate: false });
  });
});

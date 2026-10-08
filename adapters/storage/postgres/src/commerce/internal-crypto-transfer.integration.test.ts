import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoIntent } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresCryptoRepository } from "./crypto-repository.js";
import { createPostgresInternalCryptoTransferStore } from "./internal-crypto-transfer.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDb = connectionString ? describe : describe.skip;

describeDb("C06 real PostgreSQL atomic internal crypto transfer acceptance", () => {
  let pool: Pool;
  const tenantId = createCanonicalId("tenant");
  const senderUserId = createCanonicalId("user");
  const recipientUserId = createCanonicalId("user");
  const strangerUserId = createCanonicalId("user");
  const asset = "USDTTRC20";
  const network = "tron";
  const when = (n: number) =>
    toInstant(new Date(Date.parse("2026-10-08T00:00:00.000Z") + n));

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [
      { owner: "commerce",
        directory: fileURLToPath(new URL("../../../../../packages/commerce/migrations", import.meta.url)) },
      { owner: "identity",
        directory: fileURLToPath(new URL("../../../../../packages/identity/migrations", import.meta.url)) },
      { owner: "security",
        directory: fileURLToPath(new URL("../../../../../packages/security/migrations", import.meta.url)) },
    ]);
    await pool.query(
      "INSERT INTO identity.tenants (tenant_id,state,created_at,updated_at) " +
      "VALUES ($1,'active',clock_timestamp(),clock_timestamp()) ON CONFLICT DO NOTHING",
      [tenantId],
    );
    for (const [userId, suffix] of [
      [senderUserId, "sender"], [recipientUserId, "recipient"], [strangerUserId, "stranger"],
    ] as const) {
      await pool.query(
        "INSERT INTO identity.users (tenant_id,user_id,state,created_at,updated_at) " +
        "VALUES ($1,$2,'active',clock_timestamp(),clock_timestamp()) ON CONFLICT DO NOTHING",
        [tenantId,userId],
      );
      await pool.query(
        "INSERT INTO security.platform_user_profiles " +
        "(tenant_id,user_id,display_name,email,created_at,updated_at) " +
        "VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp()) ON CONFLICT DO NOTHING",
        [tenantId, userId, suffix, suffix + "-" + tenantId + "@masanawa.invalid"],
      );
    }
    const crypto = createPostgresCryptoRepository(pool);
    const requestId = createCanonicalId("request");
    const funding: CryptoIntent = {
      schemaVersion: 1, tenantId, userId: senderUserId, requestId,
      operation: "deposit", asset, network, amount: "10",
      targetAsset: null, destinationAddress: null, provider: "nowpayments",
      providerPaymentId: null, providerPayoutId: null,
      payAddress: null, providerPayAmount: null,
      providerDispatchStartedAt: when(0), status: "processing",
      createdAt: when(0), updatedAt: when(0),
    };
    await crypto.createIntent(funding);
    const paymentId = "c06-" + requestId;
    await crypto.bindProviderPayment({
      tenantId, userId: senderUserId, requestId, providerPaymentId: paymentId,
      payAddress: "c06-test-address", providerPayAmount: "10", updatedAt: when(1000),
    });
    await crypto.applyProviderPaymentEvent({
      tenantId, userId: senderUserId,
      event: {
        paymentId, parentPaymentId: null, orderId: requestId,
        status: "finished", priceAmount: "10", priceCurrency: asset,
        payAmount: "10", payCurrency: asset, actuallyPaid: "10",
        payloadHash: createHash("sha256").update(requestId).digest("hex"),
        observedAt: when(2000),
      },
    });
  });
  afterAll(async () => { await pool?.end(); });

  it("funded sender transfers exact asset/network; both user balances and liability stay balanced", async () => {
    const store = createPostgresInternalCryptoTransferStore(pool);
    const crypto = createPostgresCryptoRepository(pool);
    const quoteRequestId = createCanonicalId("request");
    const requestId = createCanonicalId("request");
    const quote = await store.quote({
      tenantId, senderUserId, recipientUserId, quoteRequestId,
      asset, network, amount: "4", policyRevision: "verified-test-policy",
    });
    expect(quote.recipientUserId).toBe(recipientUserId);
    expect((await store.quote({
      tenantId, senderUserId, recipientUserId, quoteRequestId,
      asset, network, amount: "4", policyRevision: "verified-test-policy",
    })).quoteId).toBe(quote.quoteId);
    await expect(store.quote({
      tenantId, senderUserId, recipientUserId, quoteRequestId,
      asset, network, amount: "5", policyRevision: "verified-test-policy",
    })).rejects.toThrow("crypto.internal.quote_replay_conflict");
    const receipt = await store.execute({
      tenantId, senderUserId, requestId, quoteId: quote.quoteId,
      policyRevision: "verified-test-policy",
    });
    expect(receipt.kind).toBe("internal-book-transfer");
    expect(receipt.status).toBe("completed");
    const replay = await store.execute({
      tenantId, senderUserId, requestId, quoteId: quote.quoteId,
      policyRevision: "verified-test-policy",
    });
    expect(replay.transferId).toBe(receipt.transferId);
    expect((await store.readByRequest({ tenantId,senderUserId,requestId }))?.transferId)
      .toBe(receipt.transferId);
    expect(await store.read({ tenantId, userId: strangerUserId,
      transferId: receipt.transferId })).toBeNull();
    expect((await store.read({ tenantId, userId: recipientUserId,
      transferId: receipt.transferId }))?.transferId).toBe(receipt.transferId);
    expect(Number(await crypto.readBalance({ tenantId,userId:senderUserId,asset,network })))
      .toBe(6);
    expect(Number(await crypto.readBalance({ tenantId,userId:recipientUserId,asset,network })))
      .toBe(4);
    expect(Number(await crypto.readAggregateLiability({ tenantId,asset,network })))
      .toBe(10);
    const counts = await pool.query<{ side: string; count: string }>(
      "SELECT side,count(*)::text AS count FROM commerce.crypto_internal_transfer_entries " +
      "WHERE tenant_id=$1 AND transfer_id=$2 GROUP BY side",
      [tenantId,receipt.transferId],
    );
    expect(Object.fromEntries(counts.rows.map(r => [r.side,Number(r.count)])))
      .toEqual({ debit: 1, credit: 1 });
    await expect(pool.query(
      "DELETE FROM commerce.crypto_internal_transfer_entries " +
      "WHERE tenant_id=$1 AND transfer_id=$2",
      [tenantId, receipt.transferId],
    )).rejects.toThrow(/immutable/i);
  });

  it("serializes two concurrent attempts to consume one quote", async () => {
    const store = createPostgresInternalCryptoTransferStore(pool);
    const quote = await store.quote({
      tenantId, senderUserId, recipientUserId,
      quoteRequestId: createCanonicalId("request"),
      asset, network, amount: "1", policyRevision: "verified-test-policy",
    });
    const executions = await Promise.allSettled([
      store.execute({ tenantId, senderUserId,
        requestId: createCanonicalId("request"), quoteId: quote.quoteId,
        policyRevision: "verified-test-policy" }),
      store.execute({ tenantId, senderUserId,
        requestId: createCanonicalId("request"), quoteId: quote.quoteId,
        policyRevision: "verified-test-policy" }),
    ]);
    expect(executions.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(executions.filter(item => item.status === "rejected")).toHaveLength(1);
    const checked = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM commerce.crypto_internal_transfers " +
      "WHERE tenant_id=$1 AND quote_id=$2",
      [tenantId, quote.quoteId],
    );
    expect(checked.rows[0]?.count).toBe("1");
  });

  it("denies an inactive recipient before accepting any quote", async () => {
    const store = createPostgresInternalCryptoTransferStore(pool);
    await pool.query(
      "UPDATE identity.users SET state='disabled',updated_at=clock_timestamp() " +
      "WHERE tenant_id=$1 AND user_id=$2",
      [tenantId, recipientUserId],
    );
    try {
      await expect(store.quote({
        tenantId, senderUserId, recipientUserId,
        quoteRequestId: createCanonicalId("request"),
        asset, network, amount: "1", policyRevision: "verified-test-policy",
      })).rejects.toThrow("crypto.internal.account_inactive");
    } finally {
      await pool.query(
        "UPDATE identity.users SET state='active',updated_at=clock_timestamp() " +
        "WHERE tenant_id=$1 AND user_id=$2",
        [tenantId, recipientUserId],
      );
    }
  });

  it("rejects self-transfers and unfunded quotes before approval", async () => {
    const store = createPostgresInternalCryptoTransferStore(pool);
    await expect(store.quote({
      tenantId, senderUserId, recipientUserId: senderUserId,
      quoteRequestId: createCanonicalId("request"),
      asset, network, amount: "1", policyRevision: "verified-test-policy",
    })).rejects.toThrow("crypto.internal.self_transfer");
    await expect(store.quote({
      tenantId, senderUserId, recipientUserId,
      quoteRequestId: createCanonicalId("request"),
      asset, network, amount: "999999", policyRevision: "verified-test-policy",
    })).rejects.toThrow("crypto.insufficient_balance");
  });
});

import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestDatabase } from "../../../../../test/support/isolated-postgres.js";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresNgnWalletRepository } from "./ngn-wallet.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R05 quote-scoped NGN funding creation", () => {
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

  function inputFor(owner: { tenantId: string; userId: string; quoteId: string },
    reference: string, amountKobo = 10_000) {
    const createdAt = new Date().toISOString();
    const uniqueRef = `${owner.userId}-${reference}`;
    return {
      tenantId: owner.tenantId,
      userId: owner.userId,
      quoteId: owner.quoteId,
      fundingReference: `funding-${uniqueRef}`,
      txRef: `wallet-${uniqueRef}`,
      amountKobo,
      expiresAt: new Date(Date.parse(createdAt) + 30 * 60_000).toISOString(),
      createdAt,
    };
  }

  it("uses one intent and txRef under concurrent duplicate quote confirmations", async () => {
    const owner = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      quoteId: createCanonicalId("quote"),
    };
    const repo = createPostgresNgnWalletRepository(pool);
    const refs = ["alpha", "beta", "gamma", "delta"].map(
      (ref) => inputFor(owner, ref),
    );
    const result = await Promise.all(refs.map((request) =>
      repo.createFundingIntent(request)));
    expect(new Set(result.map((row) => row.fundingReference)).size).toBe(1);
    expect(new Set(result.map((row) => row.txRef)).size).toBe(1);
    expect(result.every((row) => row.state === "creating")).toBe(true);
    const persisted = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM commerce.ngn_funding_intents
        WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
      [owner.tenantId, owner.userId, owner.quoteId],
    );
    expect(persisted.rows[0]?.count).toBe("1");
  });

  it("refuses a changed shortfall while a prior quote-linked account is active", async () => {
    const owner = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      quoteId: createCanonicalId("quote"),
    };
    const repo = createPostgresNgnWalletRepository(pool);
    const original = await repo.createFundingIntent(inputFor(owner, "first", 10_000));
    await expect(repo.createFundingIntent(inputFor(owner, "second", 5_000)))
      .rejects.toThrow("financial.wallet.funding_quote_shortfall_changed");
    const repeated = await repo.createFundingIntent(inputFor(owner, "third", 10_000));
    expect(repeated.fundingReference).toBe(original.fundingReference);
    expect(repeated.txRef).toBe(original.txRef);
  });

  it("keeps independent top-ups and different quotes separate", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const repo = createPostgresNgnWalletRepository(pool);
    const a = await repo.createFundingIntent(inputFor({
      tenantId, userId, quoteId: createCanonicalId("quote"),
    }, "quote-a"));
    const b = await repo.createFundingIntent(inputFor({
      tenantId, userId, quoteId: createCanonicalId("quote"),
    }, "quote-b"));
    expect(a.fundingReference).not.toBe(b.fundingReference);
    const topup = inputFor({ tenantId, userId, quoteId: "not-used" }, "topup");
    const [first, second] = await Promise.all([
      repo.createFundingIntent({ ...topup, quoteId: null }),
      repo.createFundingIntent({
        ...topup, fundingReference: `funding-${userId}-topup-two`,
        txRef: `wallet-${userId}-topup-two`, quoteId: null,
      }),
    ]);
    expect(first.fundingReference).not.toBe(second.fundingReference);
  });
});

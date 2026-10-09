import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresNgnWalletRepository } from "./ngn-wallet.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R05 persisted funding owner and latest recovery", () => {
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
  afterAll(async () => { await pool?.end(); });

  it("restores only the latest owner-and-quote matched intent after bind", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const otherUserId = createCanonicalId("user");
    const quoteId = createCanonicalId("quote");
    const anotherQuoteId = createCanonicalId("quote");
    const repo = createPostgresNgnWalletRepository(pool);
    const create = async (quote: string, ref: string, timestamp: number) => {
      const createdAt = new Date(timestamp).toISOString();
      return repo.createFundingIntent({
        tenantId, userId, quoteId: quote,
        fundingReference: `funding-${userId}-${ref}`,
        txRef: `wallet-${userId}-${ref}`,
        amountKobo: 10_000, createdAt,
        expiresAt: new Date(timestamp + 30 * 60_000).toISOString(),
      });
    };
    const earlier = await create(quoteId, "recovery-earlier", Date.now() - 60_000);
    const bound = await repo.bindFundingAccount({
      tenantId, userId, fundingReference: earlier.fundingReference,
      accountNumber: "0001112223", bankName: "Example Bank",
      providerOrderRef: "order-1", providerReference: "provider-1",
      providerExpiry: new Date(Date.now() + 15 * 60_000).toISOString(),
      boundAt: new Date().toISOString(),
    });
    const restored = await repo.readLatestQuoteFunding({ tenantId, userId, quoteId });
    expect(restored?.fundingReference).toBe(bound.fundingReference);
    expect(restored?.accountNumber).toBe("0001112223");
    expect(restored?.bankName).toBe("Example Bank");

    // Different quotes and users have no read access to these instructions.
    expect(await repo.readLatestQuoteFunding({
      tenantId, userId: otherUserId, quoteId,
    })).toBeNull();
    expect(await repo.readLatestQuoteFunding({
      tenantId, userId, quoteId: anotherQuoteId,
    })).toBeNull();

    // An expired first account can be followed by a new intent. The read
    // returns newest persisted recovery state, not the old bank coordinates.
    await pool.query(
      `UPDATE commerce.ngn_funding_intents
         SET expires_at=statement_timestamp() - interval '1 second'
         WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3`,
      [tenantId, userId, earlier.fundingReference],
    );
    const replacement = await create(quoteId, "recovery-second", Date.now());
    const latest = await repo.readLatestQuoteFunding({ tenantId, userId, quoteId });
    expect(latest?.fundingReference).toBe(replacement.fundingReference);
    expect(latest?.state).toBe("creating");
    expect(latest?.accountNumber).toBeNull();
  });
});

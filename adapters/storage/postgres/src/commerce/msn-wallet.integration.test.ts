import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { createMsnLedgerStore } from "../../../../../services/gateway/src/msn_wallet/store.js";

const url = process.env.MASANAWA_TEST_DATABASE_URL;
const db = url ? describe : describe.skip;

db("MSN canonical PostgreSQL ledger acceptance", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, [{
      owner: "commerce",
      directory: fileURLToPath(new URL("../../../../../packages/commerce/migrations", import.meta.url)),
    }]);
  });
  afterAll(async () => { await pool?.end(); });

  it("reads actual empty balances without sharing other tenant/user assets", async () => {
    const store = createMsnLedgerStore(pool);
    expect(await store.readBalance(randomUUID(), "fan-a"))
      .toEqual({ asset: "MSN", spendableMicro: "0" });
    expect(await store.readBalance(randomUUID(), "fan-b"))
      .toEqual({ asset: "MSN", spendableMicro: "0" });
  });

  it("rolls back one-sided posting on COMMIT", async () => {
    const tenant = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO commerce.msn_issuances
        (tenant_id,user_id,quote_id,funding_rail,funding_reference,
         provider_settlement_id,backing_asset,backing_network,
         backing_usd_micro,msn_credit_micro,price_per_msn_usd_micro,
         ngn_funding_kobo,verified_evidence_sha256)
         VALUES ($1,'fan','quote','NGN_FLUTTERWAVE','fund',$2,
         'USDTTRC20','tron',1000000,2000000,500000,10000,$3)`,
        [tenant, randomUUID(), "a".repeat(64)],
      );
      await client.query(
        `INSERT INTO commerce.msn_ledger_entries
         (tenant_id,quote_id,user_id,entry_side,delta_micro)
         VALUES ($1,'quote','fan','customer',2000000)`, [tenant],
      );
      await expect(client.query("COMMIT"))
        .rejects.toThrow("MSN issue is not double-entry balanced");
      await client.query("ROLLBACK").catch(() => undefined);
      const check = await pool.query(
        "SELECT count(*)::integer AS n FROM commerce.msn_issuances WHERE tenant_id=$1",
        [tenant],
      );
      expect(check.rows[0]?.n).toBe(0);
    } finally {
      client.release();
    }
  });

  it("commits balanced integer MSN only, preserves immutability and tenant fencing", async () => {
    const tenant = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO commerce.msn_issuances
         (tenant_id,user_id,quote_id,funding_rail,funding_reference,
          provider_settlement_id,backing_asset,backing_network,
          backing_usd_micro,msn_credit_micro,price_per_msn_usd_micro,
          ngn_funding_kobo,verified_evidence_sha256)
          VALUES ($1,'fan','quote','NGN_FLUTTERWAVE','fund',$2,
          'USDTTRC20','tron',1000000,2000000,500000,10000,$3)`,
        [tenant, randomUUID(), "b".repeat(64)],
      );
      await client.query(
        `INSERT INTO commerce.msn_ledger_entries
         (tenant_id,quote_id,user_id,entry_side,delta_micro)
         VALUES ($1,'quote','fan','platform',-2000000),
                ($1,'quote','fan','customer',2000000)`, [tenant],
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const store = createMsnLedgerStore(pool);
    expect(await store.readBalance(tenant, "fan"))
      .toEqual({ asset: "MSN", spendableMicro: "2000000" });
    expect(await store.readBalance(randomUUID(), "fan"))
      .toEqual({ asset: "MSN", spendableMicro: "0" });
    await expect(pool.query(
      "UPDATE commerce.msn_ledger_entries SET delta_micro=1 WHERE tenant_id=$1",
      [tenant],
    )).rejects.toThrow("MSN ledger/issuance is append-only");
  });
});

import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedPostgresTestDatabase } from "../../../../../test/support/isolated-postgres.js";
import { createCanonicalId, nowInstant, toInstant } from "@masanawa/contracts";
import type { CommerceFulfillmentAdmission, CommerceLedgerTransfer, CommerceQuote } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresCommerceRepository } from "./repository.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("commerce paid fulfillment PostgreSQL acceptance", () => {
  let pool: Pool;
  let isolated: Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>> | undefined;
  beforeAll(async () => {
    isolated = await createIsolatedPostgresTestDatabase(connectionString!);
    pool = isolated.pool;
    await runMigrations(pool, [{ owner: "commerce", directory: fileURLToPath(
      new URL("../../../../../packages/commerce/migrations", import.meta.url),
    ) }]);
  });
  afterAll(async () => { await isolated?.close(); });

  async function fixture(fallback = false, customerCredits = 100, floatCredits = 50) {
    const repository = createPostgresCommerceRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const createdAt = nowInstant();
    const quote: CommerceQuote = {
      schemaVersion: 1, tenantId, quoteId: createCanonicalId("quote"), offerId: createCanonicalId("offer"),
      offerRevision: 1, customerUserId: createCanonicalId("user"), originatingCharacterId: createCanonicalId("character"),
      creatorUserId: createCanonicalId("user"), priceCredits: 100, creatorCommissionCredits: 30,
      fulfillmentReserveCredits: 50, platformMarginCredits: 20, createdAt,
      expiresAt: toInstant(new Date(Date.parse(createdAt) + 900_000)),
    };
    await repository.createQuote(quote);
    const admission: CommerceFulfillmentAdmission = {
      schemaVersion: 1, tenantId, fulfillmentId: createCanonicalId("fulfillment"), quoteId: quote.quoteId,
      offerId: quote.offerId, offerRevision: 1, skillVersionId: createCanonicalId("skill-version"),
      originatingCharacterId: quote.originatingCharacterId,
      executorCharacterId: fallback ? createCanonicalId("character") : quote.originatingCharacterId,
      creatorUserId: quote.creatorUserId, fundingSource: fallback ? "platform" : "agent-float",
      reserveCredits: 50, creatorCommissionCredits: fallback ? 10 : 30,
      platformRevenueCredits: fallback ? 40 : 20, state: "admitted", createdAt,
    };
    const platformFloat = { tenantId, kind: "platform-float" as const, userId: null, characterId: null };
    const customer = { tenantId, kind: "customer-credit" as const, userId: quote.customerUserId, characterId: null };
    const agentFloat = { tenantId, kind: "agent-float" as const, userId: quote.creatorUserId, characterId: quote.originatingCharacterId };
    for (const [credit, amountCredits] of [[customer, customerCredits], [agentFloat, floatCredits]] as const) {
      if (amountCredits > 0) await repository.postTransfer({
        schemaVersion: 1, tenantId, ledgerEntryId: createCanonicalId("ledger-entry"),
        debit: { tenantId, kind: "external-clearing", userId: null, characterId: null }, credit,
        amountCredits, reason: "customer-topup", quoteId: null, fulfillmentId: null, createdAt,
      });
    }
    const transfers: CommerceLedgerTransfer[] = [{
      schemaVersion: 1, tenantId, ledgerEntryId: createCanonicalId("ledger-entry"), debit: customer,
      credit: platformFloat, amountCredits: 100, reason: "customer-payment", quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId, createdAt,
    }];
    if (!fallback) transfers.push({
      schemaVersion: 1, tenantId, ledgerEntryId: createCanonicalId("ledger-entry"), debit: agentFloat,
      credit: platformFloat, amountCredits: 50, reason: "fulfillment-reserve", quoteId: quote.quoteId,
      fulfillmentId: admission.fulfillmentId, createdAt,
    });
    const completion = {
      schemaVersion: 1 as const, tenantId, fulfillmentId: admission.fulfillmentId, state: "succeeded" as const,
      resultReference: "artifact:business-plan", resultHash: `sha256:${"a".repeat(64)}`,
      completedAt: toInstant(new Date(Date.parse(createdAt) + 1)),
    };
    return { repository, quote, admission, transfers, completion, customer, agentFloat };
  }

  it("rolls back admission and customer debit if creator capacity is insufficient", async () => {
    const f = await fixture(false, 100, 49);
    await expect(f.repository.admitFulfillment(f)).rejects.toMatchObject({ code: "commerce.insufficient_balance" });
    expect(await f.repository.readBalance(f.customer)).toBe(100);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(49);
    expect(await f.repository.readFulfillment(f.admission)).toBeNull();
  });

  it("rejects missing payment and altered admission economics before writing", async () => {
    const f = await fixture();
    await expect(f.repository.admitFulfillment({ ...f, transfers: [] })).rejects.toThrow();
    await expect(f.repository.admitFulfillment({ ...f,
      admission: { ...f.admission, creatorCommissionCredits: 31, platformRevenueCredits: 19 },
    })).rejects.toThrow();
    expect(await f.repository.readBalance(f.customer)).toBe(100);
    expect(await f.repository.readFulfillment(f.admission)).toBeNull();
  });

  it("charges once under concurrent admission and settles once under concurrent completion", async () => {
    const f = await fixture();
    await Promise.all([f.repository.admitFulfillment(f), f.repository.admitFulfillment(f)]);
    expect(await f.repository.readBalance(f.customer)).toBe(0);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(0);
    const receipts = await Promise.all([
      f.repository.completeFulfillment(f), f.repository.completeFulfillment(f),
    ]);
    expect(receipts[0]).toEqual(receipts[1]);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(50);
    expect(await f.repository.readCreatorCommercialSnapshot({
      tenantId: f.quote.tenantId, userId: f.quote.creatorUserId!, characterId: f.quote.originatingCharacterId,
    })).toEqual({ agentFloatCredits: 50, pendingEarningsCredits: 30, availableEarningsCredits: 0 });
    expect(await f.repository.readBalance({ tenantId: f.quote.tenantId,
      kind: "platform-revenue", userId: null, characterId: null })).toBe(20);
  });

  it("replays after repository restart and rejects a changed receipt without paying again", async () => {
    const f = await fixture();
    await f.repository.admitFulfillment(f);
    await f.repository.completeFulfillment(f);
    const restored = createPostgresCommerceRepository(pool);
    expect(await restored.completeFulfillment(f)).toEqual(f.completion);
    await expect(restored.completeFulfillment({ completion: { ...f.completion,
      resultHash: `sha256:${"b".repeat(64)}` } })).rejects.toMatchObject({ code: "commerce.fulfillment_completion_conflict" });
    expect(await restored.readBalance(f.agentFloat)).toBe(50);
  });

  it("rolls back both the completion receipt and earlier transfers if settlement fails", async () => {
    const f = await fixture();
    await f.repository.admitFulfillment(f);
    await pool.query(`CREATE OR REPLACE FUNCTION commerce.reject_test_creator_earning()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.tenant_id = TG_ARGV[0] AND NEW.reason = 'creator-earning' THEN
          RAISE EXCEPTION 'Injected settlement failure';
        END IF;
        RETURN NEW;
      END; $$`);
    await pool.query(`CREATE TRIGGER commerce_test_settlement_failure
      BEFORE INSERT ON commerce.ledger_entries FOR EACH ROW
      EXECUTE FUNCTION commerce.reject_test_creator_earning('${f.quote.tenantId}')`);
    try {
      await expect(f.repository.completeFulfillment(f)).rejects.toThrow("Injected settlement failure");
      expect(await f.repository.readFulfillmentCompletion(f.admission)).toBeNull();
      expect(await f.repository.readBalance(f.agentFloat)).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER commerce_test_settlement_failure ON commerce.ledger_entries");
      await pool.query("DROP FUNCTION commerce.reject_test_creator_earning()");
    }
    await f.repository.completeFulfillment(f);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(50);
  });

  it("settles fallback commission to the originating creator without reimbursing unreserved Float", async () => {
    const f = await fixture(true, 100, 0);
    await f.repository.admitFulfillment(f);
    await f.repository.completeFulfillment(f);
    expect(await f.repository.readCreatorCommercialSnapshot({
      tenantId: f.quote.tenantId, userId: f.quote.creatorUserId!, characterId: f.quote.originatingCharacterId,
    })).toEqual({ agentFloatCredits: 0, pendingEarningsCredits: 10, availableEarningsCredits: 0 });
    expect(await f.repository.readBalance({ tenantId: f.quote.tenantId,
      kind: "platform-revenue", userId: null, characterId: null })).toBe(40);
  });

  it("rejects unadmitted completion and keeps receipts and ledger history immutable", async () => {
    const f = await fixture();
    await expect(f.repository.completeFulfillment(f)).rejects.toMatchObject({ code: "commerce.fulfillment_not_admitted" });
    await f.repository.admitFulfillment(f);
    await f.repository.completeFulfillment(f);
    await expect(pool.query("DELETE FROM commerce.fulfillment_completions WHERE tenant_id=$1", [f.quote.tenantId])).rejects.toThrow();
    await expect(pool.query("UPDATE commerce.ledger_entries SET amount_credits=1 WHERE tenant_id=$1", [f.quote.tenantId])).rejects.toThrow();
  });
});

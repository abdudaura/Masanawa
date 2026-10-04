import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant, toInstant, type CharacterId } from "@masanawa/contracts";
import type { AgentFloatAllocationCommand } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresCommerceRepository } from "./repository.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("persistent Agent Float allocation PostgreSQL acceptance", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{ owner: "commerce", directory: fileURLToPath(
      new URL("../../../../../packages/commerce/migrations", import.meta.url),
    ) }]);
  });
  afterAll(async () => { await pool?.end(); });

  async function fixture(balance = 100) {
    const repository = createPostgresCommerceRepository(pool);
    const command: AgentFloatAllocationCommand = {
      schemaVersion: 1, tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"), requestId: createCanonicalId("request"), amountCredits: 60,
    };
    const customer = { tenantId: command.tenantId, kind: "customer-credit" as const,
      userId: command.userId, characterId: null };
    const agentFloat = { ...customer, kind: "agent-float" as const, characterId: command.characterId };
    async function fund(amountCredits: number) {
      if (amountCredits > 0) await repository.postTransfer({
        schemaVersion: 1, ledgerEntryId: createCanonicalId("ledger-entry"), tenantId: command.tenantId,
        debit: { tenantId: command.tenantId, kind: "external-clearing", userId: null, characterId: null },
        credit: customer, amountCredits, reason: "customer-topup", quoteId: null, fulfillmentId: null, createdAt: nowInstant(),
      });
    }
    await fund(balance);
    return { repository, command, customer, agentFloat, fund };
  }

  async function historyReceipt(f: Awaited<ReturnType<typeof fixture>>,
    createdAt = "2000-01-01T00:00:00.000Z", characterId: CharacterId = f.command.characterId) {
    const receipt = { ...f.command, characterId, amountCredits: 1,
      requestId: createCanonicalId("request"), ledgerEntryId: createCanonicalId("ledger-entry"),
      createdAt: toInstant(createdAt) };
    await f.repository.postTransfer({
      schemaVersion: 1, tenantId: receipt.tenantId, ledgerEntryId: receipt.ledgerEntryId,
      debit: f.customer, credit: { ...f.agentFloat, characterId }, amountCredits: 1,
      reason: "agent-float-topup", quoteId: null, fulfillmentId: null, createdAt: receipt.createdAt,
    });
    await pool.query(`INSERT INTO commerce.agent_float_allocations(
      tenant_id,user_id,request_id,character_id,amount_credits,ledger_entry_id,definition,created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [receipt.tenantId, receipt.userId,
      receipt.requestId, characterId, receipt.amountCredits, receipt.ledgerEntryId,
      JSON.stringify(receipt), receipt.createdAt]);
    return receipt;
  }

  it("returns one persisted receipt and transfer for duplicate requests", async () => {
    const f = await fixture();
    const [left, right] = await Promise.all([
      f.repository.allocateAgentFloat(f.command), f.repository.allocateAgentFloat(f.command),
    ]);
    expect(left).toEqual(right);
    expect(await f.repository.readBalance(f.customer)).toBe(40);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(60);
    const count = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM commerce.ledger_entries WHERE tenant_id=$1 AND reason='agent-float-topup'",
      [f.command.tenantId],
    );
    expect(count.rows[0]!.count).toBe("1");
  });

  it("replays committed custody after repository restart even after customer balance changes", async () => {
    const f = await fixture();
    const receipt = await f.repository.allocateAgentFloat(f.command);
    const restored = createPostgresCommerceRepository(pool);
    expect(await restored.readAgentFloatAllocation(f.command)).toEqual(receipt);
    expect(await restored.allocateAgentFloat(f.command)).toEqual(receipt);
    expect(await restored.readBalance(f.customer)).toBe(40);
  });

  it("rejects reused identity with changed amount or destination without another debit", async () => {
    const f = await fixture();
    await f.repository.allocateAgentFloat(f.command);
    for (const change of [{ amountCredits: 20 }, { characterId: createCanonicalId("character") }]) {
      await expect(f.repository.allocateAgentFloat({ ...f.command, ...change }))
        .rejects.toMatchObject({ code: "commerce.float_allocation_replay_conflict" });
    }
    expect(await f.repository.readBalance(f.customer)).toBe(40);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(60);
  });

  it("keeps read/replay identities tenant- and user-scoped", async () => {
    const f = await fixture();
    await f.repository.allocateAgentFloat(f.command);
    expect(await f.repository.readAgentFloatAllocation({ ...f.command, userId: createCanonicalId("user") })).toBeNull();
    expect(await f.repository.readAgentFloatAllocation({ ...f.command, tenantId: createCanonicalId("tenant") })).toBeNull();
    const other = await fixture();
    const receipt = await other.repository.allocateAgentFloat({ ...other.command, requestId: f.command.requestId });
    expect(receipt.tenantId).toBe(other.command.tenantId);
    expect(receipt.userId).toBe(other.command.userId);
    const siblingUserId = createCanonicalId("user");
    await f.repository.postTransfer({
      schemaVersion: 1, ledgerEntryId: createCanonicalId("ledger-entry"), tenantId: f.command.tenantId,
      debit: { tenantId: f.command.tenantId, kind: "external-clearing", userId: null, characterId: null },
      credit: { tenantId: f.command.tenantId, kind: "customer-credit", userId: siblingUserId, characterId: null },
      amountCredits: 100, reason: "customer-topup", quoteId: null, fulfillmentId: null, createdAt: nowInstant(),
    });
    const sibling = await f.repository.allocateAgentFloat({ ...f.command, userId: siblingUserId,
      characterId: createCanonicalId("character") });
    expect(sibling.userId).toBe(siblingUserId);
    expect(sibling.ledgerEntryId).not.toBe((await f.repository.readAgentFloatAllocation(f.command))!.ledgerEntryId);
    expect(await f.repository.readAgentFloatAllocation({ ...f.command, userId: siblingUserId })).toEqual(sibling);
    expect(await f.repository.readBalance(f.customer)).toBe(40);
  });

  it("rolls back an insufficient-funds command and can retry it after funding", async () => {
    const f = await fixture(59);
    await expect(f.repository.allocateAgentFloat(f.command)).rejects.toMatchObject({ code: "commerce.insufficient_balance" });
    expect(await f.repository.readAgentFloatAllocation(f.command)).toBeNull();
    expect(await f.repository.readBalance(f.customer)).toBe(59);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(0);
    await f.fund(1);
    await f.repository.allocateAgentFloat(f.command);
    expect(await f.repository.readBalance(f.customer)).toBe(0);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(60);
  });

  it("prevents concurrent distinct commands from overdrawing the same customer account", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      f.repository.allocateAgentFloat(f.command),
      f.repository.allocateAgentFloat({ ...f.command, requestId: createCanonicalId("request") }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(await f.repository.readBalance(f.customer)).toBe(40);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(60);
  });

  it("rolls back the ledger if command persistence fails, then safely retries", async () => {
    const f = await fixture();
    await pool.query(`CREATE OR REPLACE FUNCTION commerce.reject_test_float_command()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.tenant_id = TG_ARGV[0] THEN RAISE EXCEPTION 'Injected Float command failure'; END IF;
        RETURN NEW;
      END; $$`);
    await pool.query(`CREATE TRIGGER commerce_test_float_command_failure
      BEFORE INSERT ON commerce.agent_float_allocations FOR EACH ROW
      EXECUTE FUNCTION commerce.reject_test_float_command('${f.command.tenantId}')`);
    try {
      await expect(f.repository.allocateAgentFloat(f.command)).rejects.toThrow("Injected Float command failure");
      expect(await f.repository.readAgentFloatAllocation(f.command)).toBeNull();
      expect(await f.repository.readBalance(f.customer)).toBe(100);
      expect(await f.repository.readBalance(f.agentFloat)).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER commerce_test_float_command_failure ON commerce.agent_float_allocations");
      await pool.query("DROP FUNCTION commerce.reject_test_float_command()");
    }
    await f.repository.allocateAgentFloat(f.command);
    expect(await f.repository.readBalance(f.customer)).toBe(40);
  });

  it("keeps command and ledger evidence immutable", async () => {
    const f = await fixture();
    const receipt = await f.repository.allocateAgentFloat(f.command);
    await expect(pool.query("UPDATE commerce.agent_float_allocations SET amount_credits=1 WHERE tenant_id=$1", [f.command.tenantId])).rejects.toThrow();
    await expect(pool.query("DELETE FROM commerce.agent_float_allocations WHERE tenant_id=$1", [f.command.tenantId])).rejects.toThrow();
    await expect(pool.query("DELETE FROM commerce.ledger_entries WHERE tenant_id=$1 AND ledger_entry_id=$2",
      [f.command.tenantId, receipt.ledgerEntryId])).rejects.toThrow();
  });

  it.each(["amount", "customer", "character", "reason", "timestamp", "quote", "fulfillment", "source", "destination"])(
    "rejects a persisted receipt linked to mismatched ledger %s", async mismatch => {
      const f = await fixture();
      const createdAt = nowInstant();
      const ledgerEntryId = createCanonicalId("ledger-entry");
      await f.repository.postTransfer({
        schemaVersion: 1, tenantId: f.command.tenantId, ledgerEntryId,
        debit: mismatch === "source"
          ? { tenantId: f.command.tenantId, kind: "external-clearing", userId: null, characterId: null }
          : f.customer,
        credit: mismatch === "destination" ? { ...f.customer, userId: createCanonicalId("user") } : {
          ...f.agentFloat,
          userId: mismatch === "customer" ? createCanonicalId("user") : f.command.userId,
          characterId: mismatch === "character" ? createCanonicalId("character") : f.command.characterId,
        },
        amountCredits: mismatch === "amount" ? 50 : f.command.amountCredits,
        reason: mismatch === "reason" ? "customer-topup" : "agent-float-topup",
        quoteId: mismatch === "quote" ? createCanonicalId("quote") : null,
        fulfillmentId: mismatch === "fulfillment" ? createCanonicalId("fulfillment") : null,
        createdAt,
      });
      const receipt = { ...f.command, ledgerEntryId,
        createdAt: mismatch === "timestamp" ? "2000-01-01T00:00:00.000Z" : createdAt };
      await expect(pool.query(`INSERT INTO commerce.agent_float_allocations(
        tenant_id,user_id,request_id,character_id,amount_credits,ledger_entry_id,definition,created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [
        receipt.tenantId, receipt.userId, receipt.requestId, receipt.characterId,
        receipt.amountCredits, ledgerEntryId, JSON.stringify(receipt), receipt.createdAt,
      ])).rejects.toMatchObject({ code: "23514" });
      expect(await f.repository.readAgentFloatAllocation(f.command)).toBeNull();
    },
  );

  it("cannot attach a second request identity to an already receipted transfer", async () => {
    const f = await fixture();
    const receipt = await f.repository.allocateAgentFloat(f.command);
    const alias = { ...receipt, requestId: createCanonicalId("request") };
    await expect(pool.query(`INSERT INTO commerce.agent_float_allocations(
      tenant_id,user_id,request_id,character_id,amount_credits,ledger_entry_id,definition,created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [
      alias.tenantId, alias.userId, alias.requestId, alias.characterId,
      alias.amountCredits, alias.ledgerEntryId, JSON.stringify(alias), alias.createdAt,
    ])).rejects.toMatchObject({ code: "23505" });
    expect(await f.repository.readAgentFloatAllocation(alias)).toBeNull();
    expect(await f.repository.readBalance(f.customer)).toBe(40);
    expect(await f.repository.readBalance(f.agentFloat)).toBe(60);
  });

  it("returns empty history without revealing another tenant or user's receipts", async () => {
    const f = await fixture();
    await f.repository.allocateAgentFloat(f.command);
    for (const scope of [
      { tenantId: f.command.tenantId, userId: createCanonicalId("user") },
      { tenantId: createCanonicalId("tenant"), userId: f.command.userId },
    ]) expect(await f.repository.listAgentFloatAllocations(scope)).toEqual({ allocations: [], nextBeforeRequestId: null });
  });

  it("paginates equal timestamps deterministically with no duplicate or missing receipts", async () => {
    const f = await fixture();
    const receipts = [];
    for (let index = 0; index < 5; index++) receipts.push(await historyReceipt(f));
    const expected = receipts.map(r => r.requestId).sort().reverse();
    const first = await f.repository.listAgentFloatAllocations({ ...f.command, limit: 2 });
    expect(first.allocations.map(r => r.requestId)).toEqual(expected.slice(0, 2));
    expect(first.nextBeforeRequestId).toBe(expected[1]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.allocations)).toBe(true);
    expect(Object.isFrozen(first.allocations[0])).toBe(true);
    const second = await createPostgresCommerceRepository(pool).listAgentFloatAllocations({
      ...f.command, limit: 2, beforeRequestId: first.nextBeforeRequestId,
    });
    expect(second.allocations.map(r => r.requestId)).toEqual(expected.slice(2, 4));
    const last = await f.repository.listAgentFloatAllocations({
      ...f.command, limit: 2, beforeRequestId: second.nextBeforeRequestId,
    });
    expect(last.allocations.map(r => r.requestId)).toEqual(expected.slice(4));
    expect(last.nextBeforeRequestId).toBeNull();
    const end = await f.repository.listAgentFloatAllocations({ ...f.command,
      beforeRequestId: last.allocations[0]!.requestId });
    expect(end).toEqual({ allocations: [], nextBeforeRequestId: null });
  });

  it("keeps the next page stable when a newer allocation arrives between reads", async () => {
    const f = await fixture();
    const older = await historyReceipt(f, "2000-01-01T00:00:00.000Z");
    const newer = await historyReceipt(f, "2001-01-01T00:00:00.000Z");
    const first = await f.repository.listAgentFloatAllocations({ ...f.command, limit: 1 });
    expect(first.allocations).toEqual([newer]);
    const latest = await historyReceipt(f, "2002-01-01T00:00:00.000Z");
    const next = await f.repository.listAgentFloatAllocations({ ...f.command, limit: 1,
      beforeRequestId: first.nextBeforeRequestId });
    expect(next.allocations).toEqual([older]);
    expect(next.nextBeforeRequestId).toBeNull();
    const refresh = await f.repository.listAgentFloatAllocations({ ...f.command, limit: 1 });
    expect(refresh.allocations).toEqual([latest]);
    expect(await f.repository.readBalance(f.customer)).toBe(97);
  });

  it("filters by Character and rejects missing or out-of-scope cursor identities", async () => {
    const f = await fixture();
    const own = await historyReceipt(f);
    const otherCharacterId = createCanonicalId("character");
    const otherCharacter = await historyReceipt(f, "2001-01-01T00:00:00.000Z", otherCharacterId);
    expect((await f.repository.listAgentFloatAllocations(f.command)).allocations).toEqual([own]);
    expect((await f.repository.listAgentFloatAllocations({ ...f.command, characterId: null })).allocations)
      .toEqual([otherCharacter, own]);
    const other = await fixture();
    const foreign = await other.repository.allocateAgentFloat(other.command);
    for (const cursor of [createCanonicalId("request"), foreign.requestId, otherCharacter.requestId]) {
      await expect(f.repository.listAgentFloatAllocations({ ...f.command, beforeRequestId: cursor }))
        .rejects.toMatchObject({ code: "commerce.float_history_cursor_unavailable" });
    }
    await expect(f.repository.listAgentFloatAllocations({ ...f.command, userId: createCanonicalId("user"),
      beforeRequestId: own.requestId })).rejects.toMatchObject({ code: "commerce.float_history_cursor_unavailable" });
    await expect(f.repository.listAgentFloatAllocations({ ...f.command, tenantId: createCanonicalId("tenant"),
      beforeRequestId: own.requestId })).rejects.toMatchObject({ code: "commerce.float_history_cursor_unavailable" });
  });
});

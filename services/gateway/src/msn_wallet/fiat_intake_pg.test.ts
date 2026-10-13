import { describe, expect, it } from "vitest";
import { createMsnFiatIntakeReader, type MsnFiatIntakeRecord } from "./fiat_intake_pg.js";
import type { MsnPgPool } from "./store.js";

const key = { tenantId: "tenant-a", userId: "fan-a", fundingReference: "fund-a" };
const intent = {
  ...{ tenant_id: "tenant-a", user_id: "fan-a", funding_reference: "fund-a" },
  quote_id: "quote-a", tx_ref: "tx-a", amount_kobo: "15025", state: "credited",
  provider_transaction_id: "921", provider_reference: "FLW-921",
};
const funding = { amount_kobo: "15025", provider_transaction_id: "921" };
type FixtureOption = {
  intent?: Record<string, unknown> | null;
  entry?: Record<string, unknown> | null;
  failAt?: "intent" | "entry";
};
function fixture(options: FixtureOption = {}) {
  const sql: string[] = [], params: unknown[][] = [];
  let released = false;
  const query = async (command: string, args: unknown[] = []) => {
    sql.push(command); params.push(args);
    if (command.includes("FROM commerce.ngn_funding_intents")) {
      if (options.failAt === "intent") throw new Error("database-unavailable");
      return { rows: options.intent === null ? [] : [options.intent ?? intent], rowCount: 1 };
    }
    if (command.includes("FROM commerce.ngn_wallet_entries")) {
      if (options.failAt === "entry") throw new Error("database-unavailable");
      return { rows: options.entry === null ? [] : [options.entry ?? funding], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const pool: MsnPgPool = {
    connect: async () => ({ query, release() { released = true; } }),
    query,
  };
  return { reader: createMsnFiatIntakeReader(pool), sql, params, released: () => released };
}
describe("Canonical PostgreSQL MSN fiat intake snapshot", () => {
  it("reads only scoped canonical funding intent and funding ledger in repeatable-read snapshot", async () => {
    const f = fixture();
    const result = await f.reader.read(key);
    expect(result).toMatchObject({
      tenantId: "tenant-a", userId: "fan-a",
      quoteId: "quote-a", amountKobo: 15_025n,
      state: "credited", providerTransactionId: "921",
    } satisfies Partial<MsnFiatIntakeRecord>);
    expect(f.sql[0]).toContain("REPEATABLE READ READ ONLY");
    expect(f.sql[1]).toContain("WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3");
    expect(f.sql[2]).toContain("reason='funding'");
    expect(f.params[1]).toEqual(["tenant-a", "fan-a", "fund-a"]);
    expect(f.params[2]).toEqual(["tenant-a", "fan-a", "fund-a"]);
    expect(f.sql.at(-1)).toBe("COMMIT");
    expect(f.released()).toBe(true);
  });

  it("returns absent without querying another tenant's entries or inventing zero", async () => {
    const f = fixture({ intent: null });
    expect(await f.reader.read(key)).toBeNull();
    expect(f.sql.some(s => s.includes("FROM commerce.ngn_wallet_entries"))).toBe(false);
    expect(f.released()).toBe(true);
  });

  it.each([
    ["missing funding entry", { entry: null }],
    ["wrong funded amount", { entry: { ...funding, amount_kobo: "15024" } }],
    ["different provider transaction", { entry: { ...funding, provider_transaction_id: "922" } }],
    ["no verified provider id", { intent: { ...intent, provider_transaction_id: null } }],
    ["inconsistent state", { intent: { ...intent, state: "awaiting" } }],
    ["invalid amount", { intent: { ...intent, amount_kobo: "15.025" } }],
    ["wrong owner", { intent: { ...intent, tenant_id: "tenant-b" } }],
  ] as const)("rejects %s without partial response", async (_label, bad) => {
    const f = fixture(bad);
    await expect(f.reader.read(key)).rejects.toThrow();
    expect(f.sql).toContain("ROLLBACK");
    expect(f.released()).toBe(true);
  });

  it("allows genuinely awaiting funding with no credit but does not call it paid", async () => {
    const f = fixture({ intent: { ...intent, state: "awaiting", provider_transaction_id: null }, entry: null });
    expect(await f.reader.read(key)).toMatchObject({ state: "awaiting", providerTransactionId: null });
  });

  it.each(["intent", "entry"] as const)("rolls back and releases on database %s failure", async failAt => {
    const f = fixture({ failAt });
    await expect(f.reader.read(key)).rejects.toThrow("database-unavailable");
    expect(f.sql).toContain("ROLLBACK");
    expect(f.released()).toBe(true);
  });

  it("rejects malformed identity before requesting a database connection", async () => {
    const f = fixture();
    await expect(f.reader.read({ ...key, tenantId: "tenant a" }))
      .rejects.toThrow("identity_invalid");
    expect(f.sql).toEqual([]);
  });
});

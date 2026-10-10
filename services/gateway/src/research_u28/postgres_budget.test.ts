import { describe, expect, it } from "vitest";
import { postgresResearchBudget, type ResearchPool } from "./postgres_budget.js";

describe("U28 atomic PostgreSQL budget adapter (SQL-contract checks)", () => {
  it("reserves with tenant/user/day guarded update and charges exactly once", async () => {
    const seen: string[] = [];
    const pool: ResearchPool = {
      async connect() {
        return {
          async query(sql) {
            seen.push(sql);
            if (sql.includes("RETURNING used_units")) {
              return { rows: [{ used_units: 1 }] as never[], rowCount: 1 };
            }
            if (sql.includes("RETURNING units,budget_day")) {
              return { rows: [{ units: 1, budget_day: "2026-10-08" }] as never[], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          },
          release() { seen.push("RELEASE"); },
        };
      },
    };
    const budget = postgresResearchBudget({ pool, dailyLimit: 20 });
    const actor = { tenantId: "tenant_a", userId: "user_b" };
    const requestId = "00000000-0000-4000-8000-000000000001";
    expect(await budget.reserve({ actor, requestId, units: 1 })).toBe(true);
    await budget.settle({ actor, requestId, consumed: true });
    expect(seen.filter((line) => line === "BEGIN")).toHaveLength(2);
    expect(seen.filter((line) => line === "COMMIT")).toHaveLength(2);
    expect(seen.join("\n")).toContain("used_units+$4 <= $5");
    expect(seen.join("\n")).toContain("status='reserved'");
    expect(seen.filter((line) => line === "RELEASE")).toHaveLength(2);
  });
  it("rejects quota overflow before making a provider request", async () => {
    let rollbacks = 0;
    const pool: ResearchPool = {
      async connect() {
        return {
          async query(sql) {
            if (sql === "ROLLBACK") rollbacks++;
            return { rows: [], rowCount: 0 };
          },
          release() {},
        };
      },
    };
    const budget = postgresResearchBudget({ pool, dailyLimit: 1 });
    const success = await budget.reserve({
      actor: { tenantId: "tenant_1", userId: "user_2" },
      requestId: "00000000-0000-4000-8000-000000000001", units: 1,
    });
    expect(success).toBe(false);
    expect(rollbacks).toBe(1);
  });
});

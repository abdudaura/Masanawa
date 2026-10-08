import { describe, expect, it } from "vitest";
import { initializePostgresPolicyRevision, type PolicyBootstrapClient } from "./policy-bootstrap.js";
function fixture(initial: Record<string, string> = {}) {
  const policies = new Map(Object.entries(initial));
  const statements: string[] = [];
  const client: PolicyBootstrapClient = {
    async query(sql, values) {
      statements.push(sql);
      const tenant = String(values[0]);
      if (sql.startsWith("INSERT")) {
        if (!policies.has(tenant)) policies.set(tenant, String(values[1]));
        return { rows: [] };
      }
      const revision = policies.get(tenant);
      return { rows: revision === undefined ? [] : [{ revision }] };
    },
  };
  return { policies, statements, client };
}
describe("first-run platform policy", () => {
  it("provisions absent state and accepts repeated startup", async () => {
    const f = fixture();
    await initializePostgresPolicyRevision(f.client, "tenant", "v1");
    await initializePostgresPolicyRevision(f.client, "tenant", "v1");
    expect(f.policies.get("tenant")).toBe("v1");
    expect(f.statements.every(sql => !sql.includes("DO UPDATE"))).toBe(true);
  });
  it("rejects a stale configured revision without overwriting current policy", async () => {
    const f = fixture({ tenant: "v2" });
    await expect(initializePostgresPolicyRevision(f.client, "tenant", "v1")).rejects.toThrow("platform.policy_revision_mismatch");
    expect(f.policies.get("tenant")).toBe("v2");
  });
  it("keeps tenants separate", async () => {
    const f = fixture({ other: "v2" });
    await initializePostgresPolicyRevision(f.client, "tenant", "v1");
    expect([...f.policies]).toEqual([["other", "v2"], ["tenant", "v1"]]);
  });
  it("fails closed when the policy cannot be read", async () => {
    const client: PolicyBootstrapClient = { async query() { return { rows: [] }; } };
    await expect(initializePostgresPolicyRevision(client, "tenant", "v1")).rejects.toThrow("platform.policy_revision_mismatch");
  });
  it("rejects empty or unbounded revisions before database writes", async () => {
    const f = fixture();
    for (const revision of ["", " ", "x".repeat(161)]) {
      await expect(initializePostgresPolicyRevision(f.client, "tenant", revision)).rejects.toThrow(TypeError);
    }
    expect(f.statements).toHaveLength(0);
  });
});

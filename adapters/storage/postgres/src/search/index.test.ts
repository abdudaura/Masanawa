import { describe, expect, it, vi } from "vitest";
import { createPostgresSearchStore } from "./index.js";

describe("canonical public search PostgreSQL projections", () => {
  it.each(["masana", "rooms", "posts", "videos"] as const)(
    "%s scopes to tenant and public approval, retains bounded cursor", async kind => {
      const query = vi.fn(async (_sql: string, _args: unknown[]) => ({ rows: [
        { id: "z", title: "Maths", subtitle: "teacher" },
        { id: "y", title: "Algebra", subtitle: "teacher" },
      ] }));
      const store = createPostgresSearchStore({ query } as never);
      const page = await store.search({ tenantId: "t_a", q: "Math%", kind, limit: 1, cursor: null });
      const [sql, args] = query.mock.calls[0]!;
      expect(sql).toContain("tenant_id=$1");
      expect(sql).toContain("approved");
      expect(sql).not.toMatch(/identity\.users|human_dm|talks\.|twin/i);
      expect(args).toEqual(["t_a", "%Math\\%%", null, 2]);
      expect(page).toEqual({ items: [{ kind, id: "z", title: "Maths", subtitle: "teacher" }], nextCursor: "z" });
    }
  );
  it("rejects unscoped usage", async () => {
    const query = vi.fn();
    const store = createPostgresSearchStore({ query } as never);
    await expect(store.search({ tenantId: "", kind: "posts", q: "abc", limit: 10, cursor: null }))
      .rejects.toThrow("invalid_search_scope");
    expect(query).not.toHaveBeenCalled();
  });
});

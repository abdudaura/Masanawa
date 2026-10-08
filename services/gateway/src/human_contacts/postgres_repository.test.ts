import { describe, expect, it } from "vitest";
import { createPostgresHumanContactRepository, type HumanContactSqlPool } from "./postgres_repository.js";

describe("C01 SQL contact admission", () => {
  it("looks up only active non-self public humans in tenant and checks both block directions", async () => {
    let sql = ""; let params: readonly unknown[] = [];
    const pool: HumanContactSqlPool = {
      async query(query, values) {
        sql = query; params = values ?? [];
        return { rows: [{ user_id: "user_bo", handle: "bob", display_name: "Bob", avatar_url: null, admission_policy: "requests", status: "pending", requested_by: "user_al" }] as never, rowCount: 1 };
      },
    };
    const result = await createPostgresHumanContactRepository(pool).lookup({ tenantId: "tenant_1", viewerId: "user_al", handle: "bob" });
    expect(params).toEqual(["tenant_1", "user_al", "bob"]);
    expect(sql).toContain("identity.users target");
    expect(sql).toContain("target.state = 'active'");
    expect(sql).toContain("sp.blocked = true");
    expect(sql).toContain("COALESCE(pref.discoverable_by_handle, true) = true");
    expect(sql).toContain("sp.viewer_user_id = p.user_id");
    expect(sql).toContain("p.user_id <> $2");
    expect(result).toMatchObject({ status: "outgoing", canMessage: false });
  });
  it("updates one privacy field without resetting the other", async () => {
    let sql = ""; let params: unknown[] = [];
    const pool: HumanContactSqlPool = {
      async query(q, values) {
        sql = q; params = values ?? [];
        return { rows: [{ admission_policy: "requests", discoverable_by_handle: false }] as never, rowCount: 1 };
      },
    };
    const result = await createPostgresHumanContactRepository(pool).setOwnPreferences({
      tenantId: "t", userId: "user_al", discoverableByHandle: false,
    });
    expect(params).toEqual(["t","user_al",null,false]);
    expect(sql).toContain("COALESCE($3::text,talks.human_dm_preferences.admission_policy)");
    expect(sql).toContain("COALESCE($4::boolean,talks.human_dm_preferences.discoverable_by_handle)");
    expect(result).toEqual({ policy: "requests", discoverableByHandle: false });
  });

  it("requests exactly once with pair uniqueness and without reset after decline", async () => {
    let sql = "";
    const pool: HumanContactSqlPool = {
      async query(query) { sql = query; return { rows: [{ status: "pending", requested_by: "user_bo" }] as never, rowCount: 1 }; },
    };
    const value = await createPostgresHumanContactRepository(pool).request({ tenantId: "t", requesterId: "user_al", handle: "bob" });
    expect(value).toBe("existing");
    expect(sql).toContain("ON CONFLICT (tenant_id,first_user_id,second_user_id)");
    expect(sql).toContain("DO UPDATE SET status=talks.human_dm_contact_requests.status");
    expect(sql).toContain("LEAST($2,user_id)");
    expect(sql).toContain("admission_policy");
    expect(sql).toContain("RETURNING status, requested_by");
    expect(sql).toContain("sp.blocked = true");
  });
  it("accept/decline only pending request from the other person and fail closed on block", async () => {
    let sql = ""; let params: readonly unknown[] = [];
    const pool: HumanContactSqlPool = {
      async query(query, values) { sql = query; params = values ?? []; return { rows: [{ first_user_id: "user_al" }] as never, rowCount: 1 }; },
    };
    const allowed = await createPostgresHumanContactRepository(pool).respond({ tenantId: "t", recipientId: "user_bo", requesterId: "user_al", accept: true });
    expect(allowed).toBe(true);
    expect(params).toEqual(["t", "user_bo", "user_al", "accepted"]);
    expect(sql).toContain("e.requested_by=$3");
    expect(sql).toContain("(e.status='pending' OR e.status=$4)");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("u.state='active'");
  });
  it("removes blocked contacts from list and makes limit parameterized", async () => {
    let sql = ""; let params: readonly unknown[] = [];
    const pool: HumanContactSqlPool = {
      async query(query, values) { sql=query; params=values??[]; return { rows: [] as never, rowCount: 0 }; },
    };
    expect(await createPostgresHumanContactRepository(pool).list({ tenantId:"t", userId:"user_al", limit: 30 })).toEqual([]);
    expect(sql).toContain("LIMIT $3");
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("sp.blocked=true");
    expect(params).toEqual(["t","user_al",30]);
  });
});

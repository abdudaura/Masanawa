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
  it("revoker sees explicit recovery eligibility without auto-granted messaging", async () => {
    const pool: HumanContactSqlPool = {
      async query() {
        return { rows: [{
          user_id: "user_bo", handle: "bob", display_name: "Bob",
          avatar_url: null, admission_policy: "anyone", status: "declined",
          requested_by: "user_al", revoked_by: "user_al",
        }] as never, rowCount: 1 };
      },
    };
    const repo = createPostgresHumanContactRepository(pool);
    expect(await repo.lookup({ tenantId: "t", viewerId: "user_al", handle: "bob" }))
      .toMatchObject({ status: "revoked", canMessage: false });
    expect(await repo.lookup({ tenantId: "t", viewerId: "user_bo", handle: "bob" }))
      .toMatchObject({ status: "declined", canMessage: false });
  });

  it("a revoke records the actor and cannot be replaced by the peer", async () => {
    let sql = ""; let params: unknown[] = [];
    const pool: HumanContactSqlPool = {
      async query(q, v) { sql=q; params=v??[]; return { rows: [{ first_user_id: "user_al" }] as never, rowCount: 1 }; },
    };
    expect(await createPostgresHumanContactRepository(pool).revoke({
      tenantId: "t", actorId: "user_al", otherUserId: "user_bo",
    })).toBe(true);
    expect(params).toEqual(["t", "user_al", "user_bo"]);
    expect(sql).toContain("revoked_by=$2");
    expect(sql).toContain("e.revoked_by IS NULL OR e.revoked_by=$2");
    // Authorization is rechecked in SQL, even if a previously valid token
    // outlives account disablement; disabled peers may still be revoked.
    expect(sql).toContain("SELECT 1 FROM identity.users actor");
    expect(sql).toContain("actor.tenant_id=e.tenant_id");
    expect(sql).toContain("actor.user_id=$2 AND actor.state='active'");
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
    expect(sql).toContain("revoked_by=EXCLUDED.requested_by");
    expect(sql).toContain("THEN 'pending'");
    expect(sql).toContain("revoked_by=CASE");
    expect(sql).toContain("request_revision=CASE");
    expect(sql).toContain("updated_at=CASE");
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
    const allowed = await createPostgresHumanContactRepository(pool).respond({ tenantId: "t", recipientId: "user_bo", requesterId: "user_al", requestRevision: "1", accept: true });
    expect(allowed).toBe(true);
    expect(params).toEqual(["t", "user_bo", "user_al", "accepted", "1"]);
    expect(sql).toContain("e.request_revision=$5::bigint");
    expect(sql).toContain("e.requested_by=$3");
    // Final consent is immutable for a request revision; same-result retries
    // succeed but cannot modify ordering or flip acceptance.
    expect(sql).toContain("AND (e.status='pending' OR e.status=$4)");
    expect(sql).not.toContain("(e.status='declined' AND $4='accepted')");
    expect(sql).not.toContain("(e.status='accepted' AND $4='declined')");
    expect(sql).toContain("WHEN e.status=$4 THEN e.updated_at ELSE clock_timestamp()");
    expect(sql).toContain("e.revoked_by IS NULL");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
    expect(sql).toContain("p.user_id IN ($2,$3)");
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
    expect(params).toEqual(["t","user_al",30,null,null]);
    expect(sql).toContain("edge.revoked_by IS NULL");
    expect(sql).toContain("edge.revoked_by=$2");
  });

  it("pages tenant-owned contacts by microsecond timestamp and stable user ID", async () => {
    const observed: { sql: string; args: readonly unknown[] }[] = [];
    const timestamp = "2026-10-08T11:00:00.123456Z";
    const record = (id: string) => ({
      user_id: id, handle: id, display_name: id, avatar_url: null,
      status: "accepted", requested_by: "user_al", revoked_by: null,
      updated_at: new Date("2026-10-08T11:00:00Z"),
      cursor_updated_at: timestamp, request_revision: "1",
    });
    const pool: HumanContactSqlPool = {
      async query(sql, values) {
        observed.push({ sql, args: values ?? [] });
        return { rows: (observed.length === 1
          ? [record("user_aa"), record("user_bb"), record("user_cc")]
          : [record("user_cc")]) as never, rowCount: null };
      },
    };
    const repository = createPostgresHumanContactRepository(pool);
    const first = await repository.listPage!({ tenantId: "t", userId: "user_al", limit: 2, after: null });
    expect(first.contacts.map(item => item.userId)).toEqual(["user_aa", "user_bb"]);
    expect(first.next).toEqual({ updatedAt: timestamp, userId: "user_bb" });
    expect(observed[0]?.args).toEqual(["t", "user_al", 3, null, null]);
    for (const predicate of ["edge.updated_at < $4::timestamptz", "other.user_id > $5::text", "LIMIT $3", "HH24:MI:SS.US", "sp.blocked=true", "recipient.state='active'"]) {
      expect(observed[0]?.sql).toContain(predicate);
    }
    const second = await repository.listPage!({
      tenantId: "t", userId: "user_al", limit: 2, after: first.next,
    });
    expect(second.contacts.map(item => item.userId)).toEqual(["user_cc"]);
    expect(second.next).toBeNull();
    expect(observed[1]?.args).toEqual(["t", "user_al", 3, timestamp, "user_bb"]);
  });
});

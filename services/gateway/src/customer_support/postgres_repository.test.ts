
import { describe, expect, it } from "vitest";
import { createPostgresSupportTicketStore, type SupportSqlPool } from "./postgres_repository.js";

const row = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  kind: "billing_quote", reference_mask: "••••1234", operation_phase: "pending",
  summary: "Payment is not confirmed yet.", status:"queued",resolution:null,
  created_at:"2026-10-08T15:00:00Z",updated_at:"2026-10-08T15:00:00Z",
};
describe("U29 PostgreSQL boundary", () => {
  it("requires owner+tenant for read/list and hides raw financial reference",async () => {
    const queries: Array<{sql:string;params:readonly unknown[]|undefined}> = [];
    const pool:SupportSqlPool={async query<Row>(sql:string,params?:readonly unknown[]){
      queries.push({sql,params});return {rowCount:1,rows:[row] as unknown as Row[]};
    }};
    const store=createPostgresSupportTicketStore(pool);
    const list=await store.list({tenantId:"T",userId:"A",limit:20});
    const read=await store.read({tenantId:"T",userId:"A",id:row.id});
    expect(list[0]).toMatchObject({referenceMask:"••••1234"});
    expect(JSON.stringify(read)).not.toContain("raw-operation-ref");
    for (const q of queries) {
      expect(q.sql).toMatch(/tenant_id=\$1 AND user_id=\$2/);
      expect(q.params?.slice(0,2)).toEqual(["T","A"]);
      expect(q.sql).not.toMatch(/SELECT \*/);
    }
  });

  it("scopes idempotency to owner, retaining digest and rejecting reused keys with altered digest",async () => {
    const queries: Array<{sql:string;params:readonly unknown[]|undefined}> = [];
    const pool:SupportSqlPool={async query<Row>(sql:string,params?:readonly unknown[]){
      queries.push({sql,params});return {rowCount:0,rows:[] as Row[]};
    }};
    const result=await createPostgresSupportTicketStore(pool).create({
      tenantId:"T",userId:"A",id:row.id,requestKey:row.id,requestDigest:"a".repeat(64),
      kind:"billing_quote",reference:"hidden-full-ref-1234",referenceMask:"••••1234",
      operationPhase:"pending",summary:row.summary,createdAt:row.created_at,
    });
    expect(result).toBeNull();
    expect(queries[0]?.sql).toContain("ON CONFLICT (tenant_id, user_id, request_key)");
    expect(queries[0]?.sql).toContain("request_digest = EXCLUDED.request_digest");
    expect(queries[0]?.params?.slice(0,2)).toEqual(["T","A"]);
    expect(queries[0]?.params?.[6]).toBe("hidden-full-ref-1234");
  });
});


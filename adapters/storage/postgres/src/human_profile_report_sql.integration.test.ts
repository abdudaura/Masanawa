import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

// Explicit disposable PostgreSQL only. Never run this on a production DSN.
// All schema and fixture writes are enclosed in a transaction that is rolled
// back, including on assertion failure.
const url=process.env.MASANAWA_TEST_DATABASE_URL;
const allowed=process.env.MASANAWA_RUN_DISPOSABLE_SQL_TESTS==="yes" &&
  typeof url==="string" && /(?:test|disposable|ci)/i.test(new URL(url).pathname);

describe("R15 human profile report PostgreSQL proof (disposable DB)",()=>{
  it.skipIf(!allowed)("uses existing migration to persist and deduplicate tenant/reporter request",async()=>{
    const client=new Client({connectionString:url});
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE SCHEMA IF NOT EXISTS talks");
      const migration=readFileSync(fileURLToPath(new URL(
        "../../../../packages/talks/migrations/0009_talk_safety.sql",import.meta.url,
      )),"utf8");
      await client.query(migration);
      const tenant="r15-test-"+Date.now();
      const request="human-profile-"+Date.now();
      const values=[
        tenant,"report-first","reporter-a","profile","human-a",
        "impersonation","Concern",""+request,
      ];
      const sql=`INSERT INTO talks.safety_reports(
        tenant_id,report_id,reporter_user_id,target_kind,target_id,reason,
        detail,client_request_id,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())
        ON CONFLICT(tenant_id,reporter_user_id,client_request_id)
        DO UPDATE SET report_id=talks.safety_reports.report_id
        RETURNING report_id,target_id`;
      const first=await client.query(sql,values);
      const retry=await client.query(sql,[...values.slice(0,1),"report-second",...values.slice(2)]);
      expect(first.rows[0].report_id).toBe("report-first");
      expect(retry.rows[0].report_id).toBe("report-first");
      expect(retry.rows[0].target_id).toBe("human-a");
      const count=await client.query(
        "SELECT count(*)::int AS count FROM talks.safety_reports WHERE tenant_id=$1",
        [tenant],
      );
      expect(count.rows[0].count).toBe(1);
      const other=await client.query(sql,[
        tenant,"report-other","reporter-b","profile","human-a",
        "impersonation","Concern",request,
      ]);
      expect(other.rows[0].report_id).toBe("report-other");
    } finally {
      try { await client.query("ROLLBACK"); } finally { await client.end(); }
    }
  });
});

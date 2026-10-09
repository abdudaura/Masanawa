import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R15 persona reports against real PostgreSQL", () => {
  let pool: Pool;
  const tenant = "tenant-" + randomUUID();
  const key = "key-" + randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{
      owner: "talks",
      directory: fileURLToPath(
        new URL("../../../../packages/talks/migrations", import.meta.url),
      ),
    }]);
  });
  afterAll(async () => { await pool?.end(); });

  async function send(reporter: string, reportId: string) {
    const result = await pool.query<{ report_id: string }>(
      "INSERT INTO talks.safety_reports(" +
      "tenant_id,report_id,reporter_user_id,target_kind,target_id," +
      "reason,detail,client_request_id,created_at)" +
      "VALUES($1,$2,$3,'persona','expert-wazobia','harassment'," +
      "'Repeated interruptions',$4,NOW())" +
      "ON CONFLICT(tenant_id,reporter_user_id,client_request_id) DO UPDATE " +
      "SET report_id=talks.safety_reports.report_id RETURNING report_id",
      [tenant,reportId,reporter,key],
    );
    return result.rows[0]?.report_id;
  }

  it("A retry preserves report identity while B gets a separate report", async () => {
    const first = "report-" + randomUUID();
    expect(await send("reporter-a", first)).toBe(first);
    expect(await send("reporter-a", "report-" + randomUUID())).toBe(first);
    const second = "report-" + randomUUID();
    expect(await send("reporter-b", second)).toBe(second);
    const read = await pool.query<{
      reporter_user_id: string; report_id: string;
    }>(
      "SELECT reporter_user_id,report_id FROM talks.safety_reports " +
      "WHERE tenant_id=$1 AND client_request_id=$2 ORDER BY reporter_user_id",
      [tenant,key],
    );
    expect(read.rows).toEqual([
      { reporter_user_id: "reporter-a", report_id: first },
      { reporter_user_id: "reporter-b", report_id: second },
    ]);
  });

  it("Postgres constraint rejects malformed reason", async () => {
    await expect(pool.query(
      "INSERT INTO talks.safety_reports(" +
      "tenant_id,report_id,reporter_user_id,target_kind,target_id," +
      "reason,client_request_id,created_at)" +
      "VALUES($1,$2,'reporter-a','persona','expert-wazobia'," +
      "'invalid',$3,NOW())",
      [tenant,"report-"+randomUUID(),"key-"+randomUUID()],
    )).rejects.toThrow();
  });
});

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { beforeAll,afterAll,describe,expect,it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "../security/platform-session.js";
import {
  createPostgresAccountDeletionRepository,
  createPostgresAccountDeletionChallengeRepository,
} from "./account-deletion.js";
import { createPostgresAccountDeletionQueue } from "./account-deletion-queue.js";

const uri=process.env.MASANAWA_TEST_DATABASE_URL;
const describeDb=uri?describe:describe.skip;

describeDb("R12 durable reconciliation leases",()=>{
  let pool:Pool;
  const tenantId=createCanonicalId("tenant");
  let userId=createCanonicalId("user");
  let requestId=randomUUID();
  const now=new Date().toISOString();

  beforeAll(async()=>{
    pool=new Pool({connectionString:uri});
    const directory=(owner:string)=>fileURLToPath(
      new URL(`../../../../../packages/${owner}/migrations`,import.meta.url));
    await runMigrations(pool,[
      {owner:"events",directory:directory("events")},
      {owner:"security",directory:directory("security")},
      {owner:"identity",directory:directory("identity")},
    ]);
    const profile=await createPostgresPlatformSessionRepository(pool).createProfile({
      tenantId,channel:"email",
      identifier:`r12-lease-${randomUUID()}@example.com`,
      name:"Reconciliation Lease",locale:"en",createdAt:now,
    });
    userId=profile.userId;
    const opened=await createPostgresAccountDeletionRepository(pool).open({
      tenantId,userId,requestId,now,
    });
    requestId=opened.requestId;
    const codes=createPostgresAccountDeletionChallengeRepository(pool);
    const codeHash="e".repeat(64);
    await codes.put({
      tenantId,userId,requestId,codeHash,channel:"email",
      now,expiresAt:new Date(Date.parse(now)+600000).toISOString(),
      resendAfter:new Date(Date.parse(now)+60000).toISOString(),
    });
    const verified=await codes.verify({
      tenantId,userId,requestId,codeHash,expectedRevision:1,now,
    });
    expect(verified.result).toBe("accepted");
  });
  afterAll(async()=>{await pool?.end();});

  it("reclaims expired leases, rejects stale acknowledgments, and records review only once",async()=>{
    const queue=createPostgresAccountDeletionQueue(pool);
    const first=await queue.claim(tenantId);
    expect(first?.requestId).toBe(requestId);
    expect(first?.attempt).toBe(1);
    await pool.query(
      `UPDATE identity.account_deletion_worker_jobs
          SET leased_until=clock_timestamp()-interval '1 second'
        WHERE request_id=$1::uuid`,[requestId],
    );
    const second=await queue.claim(tenantId);
    expect(second?.attempt).toBe(2);
    expect(second?.token).not.toBe(first?.token);
    if(!first||!second)throw new Error("Expected two claims");
    await expect(queue.park(first,{
      findingCodes:["ngn-wallet"],admissionFenced:false,
      retrySeconds:3600,now:new Date().toISOString(),
    })).rejects.toThrow("account_deletion.worker_stale_lease");
    await queue.park(second,{
      findingCodes:["ngn-wallet"],admissionFenced:false,
      retrySeconds:3600,now:new Date().toISOString(),
    });
    const request=await createPostgresAccountDeletionRepository(pool).read({tenantId,userId});
    expect(request?.phase).toBe("awaiting-settlement");
    expect(request?.outstandingObligations).toEqual([
      "financial:ngn-wallet",
      "financial:admission-fence-unqualified",
      "privacy:processor-cleanup-unqualified",
    ]);
    const history=await pool.query<{phase:string}>(
      `SELECT phase FROM identity.account_deletion_events
        WHERE request_id=$1::uuid ORDER BY revision`,[requestId],
    );
    expect(history.rows.map(row=>row.phase)).toEqual([
      "requested","identity-verified","awaiting-settlement",
    ]);
    const after=await queue.claim(tenantId);
    expect(after).toBeNull();
  });
});

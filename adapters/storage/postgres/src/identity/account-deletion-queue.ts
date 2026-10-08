import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export interface DeletionJobLease {
  requestId: string;
  tenantId: string;
  userId: string;
  token: string;
  attempt: number;
}

export function createPostgresAccountDeletionQueue(pool: Pool) {
  return Object.freeze({
    async claim(tenantFilter?:string): Promise<DeletionJobLease | null> {
      return withTransaction(pool, async client => {
        await client.query(
          `INSERT INTO identity.account_deletion_worker_jobs(request_id,tenant_id,user_id)
           SELECT r.request_id,r.tenant_id,r.user_id
             FROM identity.account_deletion_requests r
             LEFT JOIN identity.account_deletion_worker_jobs j
               ON j.request_id=r.request_id
            WHERE r.phase IN ('identity-verified','awaiting-settlement')
              AND ($1::text IS NULL OR r.tenant_id=$1)
              AND j.request_id IS NULL
            ORDER BY r.updated_at,r.request_id
            LIMIT 100
           ON CONFLICT (request_id) DO NOTHING`,
          [tenantFilter??null],
        );
        const found = await client.query<{
          request_id:string;tenant_id:string;user_id:string;attempts:number;
        }>(
          `SELECT j.request_id::text,j.tenant_id,j.user_id,j.attempts
             FROM identity.account_deletion_worker_jobs j
             JOIN identity.account_deletion_requests r USING(request_id)
            WHERE r.phase IN ('identity-verified','awaiting-settlement')
              AND ($1::text IS NULL OR j.tenant_id=$1)
              AND j.next_attempt_at<=clock_timestamp()
              AND (j.state<>'leased' OR j.leased_until<=clock_timestamp())
            ORDER BY j.next_attempt_at,j.request_id
            LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,
          [tenantFilter??null],
        );
        const row = found.rows[0];
        if (!row) return null;
        const token = randomUUID();
        await client.query(
          `UPDATE identity.account_deletion_worker_jobs
              SET state='leased',lease_token=$2::uuid,
                  leased_until=clock_timestamp()+interval '2 minutes',
                  attempts=attempts+1,updated_at=clock_timestamp()
            WHERE request_id=$1::uuid`,
          [row.request_id,token],
        );
        return {requestId:row.request_id,tenantId:row.tenant_id,
          userId:row.user_id,token,attempt:row.attempts+1};
      });
    },
    async park(lease:DeletionJobLease,input: Readonly<{
      findingCodes:readonly string[];
      admissionFenced:boolean;
      retrySeconds:number;
      now:string;
    }>):Promise<void> {
      if(!Number.isSafeInteger(input.retrySeconds)||input.retrySeconds<60||
         input.retrySeconds>86400||!Number.isFinite(Date.parse(input.now))||
         input.findingCodes.some(code=>!/^[a-z0-9-]{3,80}$/u.test(code))) {
        throw new Error("account_deletion.worker_invalid_outcome");
      }
      await withTransaction(pool,async client=>{
        const req=await client.query<{phase:string;revision:string;updated_at:Date|string}>(
          `SELECT phase,revision::text,updated_at FROM identity.account_deletion_requests
            WHERE request_id=$1::uuid AND tenant_id=$2 AND user_id=$3 FOR UPDATE`,
          [lease.requestId,lease.tenantId,lease.userId],
        );
        const existing=req.rows[0];
        if(!existing)throw new Error("account_deletion.not_found");
        const job=await client.query<{lease_token:string;leased_until:Date|string}>(
          `SELECT lease_token::text,leased_until
             FROM identity.account_deletion_worker_jobs
            WHERE request_id=$1::uuid AND state='leased' FOR UPDATE`,
          [lease.requestId],
        );
        const serverNow=await client.query<{at:Date|string}>("SELECT clock_timestamp() AS at");
        if(!job.rows[0]||job.rows[0].lease_token!==lease.token||
            new Date(job.rows[0].leased_until).getTime()<=new Date(serverNow.rows[0]!.at).getTime()) {
          throw new Error("account_deletion.worker_stale_lease");
        }
        if(existing.phase!=="identity-verified"&&existing.phase!=="awaiting-settlement") {
          throw new Error("account_deletion.worker_state_conflict");
        }
        if(existing.phase==="identity-verified") {
          // No request is marked completed by the reconciliation worker.
          const obligations=Array.from(new Set([
            ...input.findingCodes.map(x=>"financial:"+x),
            ...(!input.admissionFenced?["financial:admission-fence-unqualified"]:[]),
            "privacy:processor-cleanup-unqualified",
          ]));
          const at=new Date(Math.max(Date.parse(input.now),
            new Date(existing.updated_at).getTime())).toISOString();
          await client.query(
            `UPDATE identity.account_deletion_requests
                SET phase='awaiting-settlement',revision=revision+1,
                    outstanding_obligations=$2::jsonb,updated_at=$3
              WHERE request_id=$1::uuid`,
            [lease.requestId,JSON.stringify(obligations),at],
          );
          await client.query(
            `INSERT INTO identity.account_deletion_events(request_id,revision,phase,occurred_at)
             VALUES ($1::uuid,$2,'awaiting-settlement',$3)`,
            [lease.requestId,Number(existing.revision)+1,at],
          );
        }
        const outcome=input.findingCodes.length?"financial_holds":"review_required";
        const result=await client.query(
          `UPDATE identity.account_deletion_worker_jobs
              SET state='waiting',lease_token=NULL,leased_until=NULL,
                  last_outcome=$3,next_attempt_at=$4::timestamptz+
                    ($5*interval '1 second'),updated_at=$4
            WHERE request_id=$1::uuid AND lease_token=$2::uuid`,
          [lease.requestId,lease.token,outcome,input.now,input.retrySeconds],
        );
        if(result.rowCount!==1)throw new Error("account_deletion.worker_stale_lease");
      });
    },
    async fail(lease:DeletionJobLease,delaySeconds:number):Promise<void> {
      if(!Number.isSafeInteger(delaySeconds)||delaySeconds<60||delaySeconds>86400) {
        throw new Error("account_deletion.worker_invalid_retry");
      }
      const result=await pool.query(
        `UPDATE identity.account_deletion_worker_jobs
            SET state='ready',lease_token=NULL,leased_until=NULL,
                last_outcome='retryable_error',
                next_attempt_at=clock_timestamp()+($3*interval '1 second'),
                updated_at=clock_timestamp()
          WHERE request_id=$1::uuid AND state='leased' AND lease_token=$2::uuid
            AND leased_until>clock_timestamp()`,
        [lease.requestId,lease.token,delaySeconds],
      );
      if(result.rowCount!==1)throw new Error("account_deletion.worker_stale_lease");
    },
  });
}

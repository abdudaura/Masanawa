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
    async claim(): Promise<DeletionJobLease | null> {
      return withTransaction(pool, async client => {
        await client.query(
          `INSERT INTO identity.account_deletion_worker_jobs(request_id,tenant_id,user_id)
           SELECT request_id,tenant_id,user_id
             FROM identity.account_deletion_requests
            WHERE phase IN ('identity-verified','awaiting-settlement')
           ON CONFLICT (request_id) DO NOTHING`,
        );
        const found = await client.query<{
          request_id:string;tenant_id:string;user_id:string;attempts:number;
        }>(
          `SELECT j.request_id::text,j.tenant_id,j.user_id,j.attempts
             FROM identity.account_deletion_worker_jobs j
             JOIN identity.account_deletion_requests r USING(request_id)
            WHERE r.phase IN ('identity-verified','awaiting-settlement')
              AND j.next_attempt_at<=clock_timestamp()
              AND (j.state<>'leased' OR j.leased_until<=clock_timestamp())
            ORDER BY j.next_attempt_at,j.request_id
            LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,
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
          WHERE request_id=$1::uuid AND state='leased' AND lease_token=$2::uuid`,
        [lease.requestId,lease.token,delaySeconds],
      );
      if(result.rowCount!==1)throw new Error("account_deletion.worker_stale_lease");
    },
  });
}

import type { Pool } from "pg";
import {
  openAccountDeletionRequest,
  transitionAccountDeletion,
  type AccountDeletionRequest,
  type AccountDeletionRepository,
  type AccountDeletionPhase,
} from "@masanawa/identity";
import { withTransaction } from "../transaction.js";

type StoredRequest = {
  request_id: string;
  tenant_id: string;
  user_id: string;
  phase: AccountDeletionPhase;
  revision: string;
  outstanding_obligations: unknown;
  last_error_code: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const columns = `request_id::text,tenant_id,user_id,phase,revision::text,
                 outstanding_obligations,last_error_code,created_at,updated_at`;

function convert(row: StoredRequest): AccountDeletionRequest {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1 ||
      !Array.isArray(row.outstanding_obligations) ||
      row.outstanding_obligations.some((value: unknown) => typeof value !== "string")) {
    throw new Error("account_deletion.corrupt_record");
  }
  return Object.freeze({
    requestId: row.request_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    phase: row.phase,
    revision,
    outstandingObligations: Object.freeze([...row.outstanding_obligations] as string[]),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
  });
}

export function createPostgresAccountDeletionRepository(pool: Pool): AccountDeletionRepository {
  return Object.freeze<AccountDeletionRepository>({
    async open(input) {
      const candidate = openAccountDeletionRequest(input);
      return withTransaction(pool, async (client) => {
        // (tenant_id,user_id) is unique; retries get the same durable request.
        const inserted = await client.query<StoredRequest>(
          `INSERT INTO identity.account_deletion_requests
             (request_id,tenant_id,user_id,phase,revision,outstanding_obligations,created_at,updated_at)
           VALUES ($1::uuid,$2,$3,$4,$5,'[]'::jsonb,$6,$6)
           ON CONFLICT (tenant_id,user_id) DO NOTHING
           RETURNING ${columns}`,
          [candidate.requestId,candidate.tenantId,candidate.userId,
           candidate.phase,candidate.revision,candidate.createdAt],
        );
        if (inserted.rows[0]) {
          await client.query(
            `INSERT INTO identity.account_deletion_events(request_id,revision,phase,occurred_at)
             VALUES ($1::uuid,1,'requested',$2)`,
            [candidate.requestId,candidate.createdAt],
          );
          return convert(inserted.rows[0]);
        }
        const existing = await client.query<StoredRequest>(
          `SELECT ${columns} FROM identity.account_deletion_requests
            WHERE tenant_id=$1 AND user_id=$2`,
          [input.tenantId,input.userId],
        );
        if (!existing.rows[0]) throw new Error("account_deletion.create_conflict");
        return convert(existing.rows[0]);
      });
    },
    async read(input) {
      const result = await pool.query<StoredRequest>(
        `SELECT ${columns} FROM identity.account_deletion_requests
          WHERE tenant_id=$1 AND user_id=$2`,
        [input.tenantId,input.userId],
      );
      return result.rows[0] ? convert(result.rows[0]) : null;
    },
    async transition(input) {
      return withTransaction(pool, async (client) => {
        const locked = await client.query<StoredRequest>(
          `SELECT ${columns} FROM identity.account_deletion_requests
            WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
          [input.tenantId,input.userId],
        );
        if (!locked.rows[0]) throw new Error("account_deletion.not_found");
        const previous = convert(locked.rows[0]);
        const next = transitionAccountDeletion(previous, {
          expectedRevision: input.expectedRevision,
          target: input.target,
          now: input.now,
          ...(input.identityReauthenticated !== undefined
            ? { identityReauthenticated: input.identityReauthenticated } : {}),
          ...(input.cleanupComplete !== undefined
            ? { cleanupComplete: input.cleanupComplete } : {}),
          ...(input.outstandingObligations !== undefined
            ? { outstandingObligations: input.outstandingObligations } : {}),
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
        });
        const updated = await client.query<StoredRequest>(
          `UPDATE identity.account_deletion_requests
              SET phase=$4,revision=$5,outstanding_obligations=$6::jsonb,
                  last_error_code=$7,updated_at=$8
            WHERE tenant_id=$1 AND user_id=$2 AND revision=$3
            RETURNING ${columns}`,
          [input.tenantId,input.userId,previous.revision,next.phase,next.revision,
           JSON.stringify(next.outstandingObligations),next.lastErrorCode ?? null,next.updatedAt],
        );
        if (updated.rowCount !== 1 || !updated.rows[0]) {
          throw new Error("account_deletion.conflict");
        }
        await client.query(
          `INSERT INTO identity.account_deletion_events(request_id,revision,phase,occurred_at)
           VALUES ($1::uuid,$2,$3,$4)`,
          [next.requestId,next.revision,next.phase,next.updatedAt],
        );
        return convert(updated.rows[0]);
      });
    },
  });
}

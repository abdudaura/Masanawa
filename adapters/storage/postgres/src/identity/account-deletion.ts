import { timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import {
  openAccountDeletionRequest,
  transitionAccountDeletion,
  type AccountDeletionRequest,
  type AccountDeletionRepository,
  type AccountDeletionPhase,
  type AccountDeletionChallengeRepository,
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

function equalHash(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/u.test(left) || !/^[0-9a-f]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function createPostgresAccountDeletionChallengeRepository(
  pool: Pool,
): AccountDeletionChallengeRepository {
  return Object.freeze<AccountDeletionChallengeRepository>({
    async put(input) {
      await withTransaction(pool, async (client) => {
        const request = await client.query<{ phase: string }>(
          `SELECT phase FROM identity.account_deletion_requests
            WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3::uuid FOR UPDATE`,
          [input.tenantId, input.userId, input.requestId],
        );
        if (request.rows[0]?.phase !== "requested") {
          throw new Error("account_deletion.verification_not_available");
        }
        const current = await client.query<{
          resend_after: Date | string; consumed_at: Date | string | null;
        }>(
          `SELECT resend_after,consumed_at FROM identity.account_deletion_challenges
            WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
          [input.tenantId,input.userId],
        );
        const existing = current.rows[0];
        if (existing && existing.consumed_at === null &&
            Date.parse(String(existing.resend_after)) > Date.parse(input.now)) {
          throw new Error("account_deletion.challenge_cooldown");
        }
        await client.query(
          `INSERT INTO identity.account_deletion_challenges
             (tenant_id,user_id,request_id,code_hash,channel,created_at,expires_at,resend_after)
           VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8)
           ON CONFLICT (tenant_id,user_id) DO UPDATE
             SET request_id=EXCLUDED.request_id,code_hash=EXCLUDED.code_hash,
                 channel=EXCLUDED.channel,attempts=0,consumed_at=NULL,
                 created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at,
                 resend_after=EXCLUDED.resend_after`,
          [input.tenantId,input.userId,input.requestId,input.codeHash,input.channel,
           input.now,input.expiresAt,input.resendAfter],
        );
      });
    },
    async consume(input) {
      return withTransaction(pool, async (client) => {
        const found = await client.query<{
          request_id: string; code_hash: string; attempts: number; max_attempts: number;
          consumed_at: Date | string | null; expires_at: Date | string;
        }>(
          `SELECT request_id::text,code_hash,attempts,max_attempts,consumed_at,expires_at
             FROM identity.account_deletion_challenges
            WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
          [input.tenantId,input.userId],
        );
        const row = found.rows[0];
        if (!row || row.request_id !== input.requestId) return "missing";
        if (row.consumed_at || row.attempts >= row.max_attempts) return "locked";
        if (new Date(row.expires_at).getTime() <= Date.parse(input.now)) return "expired";
        if (!equalHash(row.code_hash,input.codeHash)) {
          await client.query(
            `UPDATE identity.account_deletion_challenges SET attempts=attempts+1
              WHERE tenant_id=$1 AND user_id=$2`,
            [input.tenantId,input.userId],
          );
          return row.attempts + 1 >= row.max_attempts ? "locked" : "invalid";
        }
        await client.query(
          `UPDATE identity.account_deletion_challenges SET consumed_at=$3
            WHERE tenant_id=$1 AND user_id=$2`,
          [input.tenantId,input.userId,input.now],
        );
        return "accepted";
      });
    },
    async cancel(input) {
      await pool.query(
        `DELETE FROM identity.account_deletion_challenges
          WHERE tenant_id=$1 AND user_id=$2 AND code_hash=$3 AND consumed_at IS NULL`,
        [input.tenantId,input.userId,input.codeHash],
      );
    },
  });
}

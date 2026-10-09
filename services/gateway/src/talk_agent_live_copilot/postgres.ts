import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "@masanawa/postgres";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  CopilotTurnStore,
  CopilotTurnOutcome,
  LiveStageHostAuthorizer,
} from "./copilot.js";

/** Adapter to the existing authenticated session authorizer, not a new token path. */
export function createPostgresStageHostAuthorizer(
  pool: Pick<Pool, "query">,
  sessions: Readonly<{
    authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<PlatformSessionIdentity>;
  }>,
): LiveStageHostAuthorizer {
  return Object.freeze<LiveStageHostAuthorizer>({
    authorize: request => sessions.authorize(request),
    async isCurrentHost({ tenantId, talkId, userId }) {
      const row = await pool.query(
        "SELECT 1 FROM talks.talks t WHERE t.tenant_id=$1 AND t.talk_id=$2 " +
        "AND t.host_user_id=$3 AND t.state='live' " +
        "AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement se " +
        "WHERE se.tenant_id=t.tenant_id AND se.target_kind='talk' " +
        "AND se.target_id=t.talk_id AND se.visibility<>'public') LIMIT 1",
        [tenantId, talkId, userId],
      );
      return row.rows.length === 1;
    },
  });
}

function transcriptHash(input: Readonly<{
  tenantId: string; talkId: string; seatId: string; userId: string; transcript: string;
}>): string {
  return createHash("sha256")
    .update(JSON.stringify([input.tenantId, input.talkId, input.seatId, input.userId, input.transcript]), "utf8")
    .digest("hex");
}
type StoredOutcome = "running" | CopilotTurnOutcome;
interface ExistingClaim {
  talk_id: string;
  seat_id: string;
  transcript_hash: string;
  state: StoredOutcome;
}
interface CountRow {
  count: string | number;
}

/**
 * SQL claim and hourly cap share a per-tenant/Host/Talk transaction advisory
 * lock; two nodes cannot both observe a free final slot. Never releases an
 * uncertain claim to re-execute an audio publication.
 *
 * REQUIRES the proposed U15 table to be reviewed/migrated by F04. This file
 * does not register a competing migration or touch shared Gateway composition.
 */
export function createPostgresCopilotTurnStore(
  pool: Pick<Pool, "connect">,
): CopilotTurnStore {
  return Object.freeze<CopilotTurnStore>({
    async acquire(request) {
      const client: PoolClient = await pool.connect();
      const hash = transcriptHash(request);
      const scope = [request.tenantId, request.talkId, request.userId];
      try {
        await client.query("BEGIN");
        // Stable lock serializes requests from multiple workers for this Host/Talk.
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [JSON.stringify(scope)],
        );
        const seen = await client.query<ExistingClaim>(
          "SELECT talk_id,seat_id,transcript_hash,state " +
          "FROM talks.live_copilot_turns WHERE tenant_id=$1 AND host_user_id=$2 " +
          "AND request_id=$3 LIMIT 1 FOR UPDATE",
          [request.tenantId, request.userId, request.requestId],
        );
        const old = seen.rows[0];
        if (old) {
          await client.query("COMMIT");
          if (old.talk_id !== request.talkId ||
              old.seat_id !== request.seatId || old.transcript_hash !== hash) {
            return { kind: "conflict" as const };
          }
          return old.state === "running"
            ? { kind: "in_progress" as const }
            : { kind: "replay" as const, outcome: old.state };
        }
        const usage = await client.query<CountRow>(
          "SELECT COUNT(*) AS count FROM talks.live_copilot_turns " +
          "WHERE tenant_id=$1 AND talk_id=$2 AND host_user_id=$3 " +
          "AND created_at >= $4::timestamptz - INTERVAL '1 hour' " +
          "AND created_at <= $4::timestamptz",
          [request.tenantId, request.talkId, request.userId, request.now],
        );
        if (Number(usage.rows[0]?.count ?? 0) >= request.maxPerHour) {
          await client.query("COMMIT");
          return { kind: "budget_exhausted" as const };
        }
        await client.query(
          "INSERT INTO talks.live_copilot_turns (" +
          "tenant_id,talk_id,seat_id,host_user_id,request_id,transcript_hash,state,created_at,updated_at" +
          ") VALUES($1,$2,$3,$4,$5,$6,'running',$7,$7)",
          [request.tenantId, request.talkId, request.seatId, request.userId,
            request.requestId, hash, request.now],
        );
        await client.query("COMMIT");
        return { kind: "acquired" as const };
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* retain original error */ }
        throw error;
      } finally {
        client.release();
      }
    },
    async finish(request) {
      const hash = transcriptHash(request);
      const update = await pool.connect();
      try {
        const result = await update.query(
          "UPDATE talks.live_copilot_turns SET state=$1,updated_at=now() " +
          "WHERE tenant_id=$2 AND host_user_id=$3 AND request_id=$4 " +
          "AND talk_id=$5 AND seat_id=$6 AND transcript_hash=$7 AND state='running' " +
          "RETURNING request_id",
          [request.outcome, request.tenantId, request.userId, request.requestId,
            request.talkId, request.seatId, hash],
        );
        if (result.rows.length !== 1) {
          throw new Error("talks.copilot_claim_finalization_failed");
        }
      } finally {
        update.release();
      }
    },
  });
}

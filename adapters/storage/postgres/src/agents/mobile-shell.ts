import type { Pool } from "pg";
import { parseCanonicalId, toInstant } from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import type {
  MobileShellActionRecord,
  MobileShellEvent,
  MobileShellRepository,
  MobileTurnCommand,
  MobilePushRepository,
  MobileAgentActivityRepository,
} from "@masanawa/agents";
import { withTransaction } from "../transaction.js";

function command(row: any): MobileTurnCommand {
  return Object.freeze({
    scope: Object.freeze({
      tenantId: parseCanonicalId("tenant", row.tenant_id),
      userId: parseCanonicalId("user", row.user_id),
      characterId: parseCanonicalId("character", row.character_id),
      relationshipId: parseCanonicalId("relationship", row.relationship_id),
    }),
    characterSessionId: parseCanonicalId("character-session", row.character_session_id),
    requestId: parseCanonicalId("request", row.request_id),
    kind: row.kind,
    userText: row.user_text,
    payloadHash: row.payload_hash,
    state: row.state,
    agentRunId: row.agent_run_id ? parseCanonicalId("agent-run", row.agent_run_id) : null,
    reply: row.reply,
    parts: Object.freeze(Array.isArray(row.parts) ? [...row.parts] : []),
    failureCode: row.failure_code,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function event(row: any): MobileShellEvent {
  return Object.freeze({
    cursor: String(row.event_cursor),
    type: row.event_type,
    payload: Object.freeze({ ...(row.payload ?? {}) }),
    createdAt: toInstant(row.created_at),
  });
}

function action(row: any): MobileShellActionRecord {
  return Object.freeze({
    scope: Object.freeze({
      tenantId: parseCanonicalId("tenant", row.tenant_id),
      userId: parseCanonicalId("user", row.user_id),
      characterId: parseCanonicalId("character", row.character_id),
      relationshipId: parseCanonicalId("relationship", row.relationship_id),
    }),
    characterSessionId: parseCanonicalId("character-session", row.character_session_id),
    documentId: row.document_id,
    revision: row.revision,
    tokenHash: row.token_hash,
    actionId: row.action_id,
    nodeId: row.node_id,
    valuesHash: row.values_hash,
    state: row.state,
    result: row.result ? Object.freeze({ ...row.result }) : null,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

export function createPostgresMobileShellRepository(pool: Pool): MobileShellRepository {
  return Object.freeze({
    async claimTurn(input: Parameters<MobileShellRepository["claimTurn"]>[0]) {
      return withTransaction(pool, async client => {
        const result = await client.query(
          `INSERT INTO agents.mobile_turn_commands(
             tenant_id,user_id,character_id,relationship_id,character_session_id,
             request_id,kind,user_text,payload_hash,state
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
           ON CONFLICT DO NOTHING RETURNING *`,
          [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
           input.characterSessionId,input.requestId,input.kind,input.userText,input.payloadHash],
        );
        if (result.rows[0]) {
          return Object.freeze({ state: "created" as const, command: command(result.rows[0]) });
        }
        const replay = await client.query(
          `SELECT * FROM agents.mobile_turn_commands
            WHERE tenant_id=$1 AND request_id=$2 FOR SHARE`,
          [input.scope.tenantId,input.requestId],
        );
        const row = replay.rows[0];
        if (!row ||
            row.user_id !== input.scope.userId ||
            row.character_id !== input.scope.characterId ||
            row.relationship_id !== input.scope.relationshipId ||
            row.character_session_id !== input.characterSessionId ||
            row.kind !== input.kind ||
            row.user_text !== input.userText ||
            row.payload_hash !== input.payloadHash) {
          throw new Error("mobile turn request conflict");
        }
        return Object.freeze({ state: "existing" as const, command: command(row) });
      });
    },

    async completeTurn(input: Parameters<MobileShellRepository["completeTurn"]>[0]) {
      const result = await pool.query(
        `UPDATE agents.mobile_turn_commands
            SET state='completed', agent_run_id=$5, reply=$6, parts=$7::jsonb,
                failure_code=NULL, updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND user_id=$2 AND relationship_id=$3 AND request_id=$4
            AND state='pending'
          RETURNING *`,
        [input.scope.tenantId,input.scope.userId,input.scope.relationshipId,input.requestId,
         input.agentRunId,input.reply,canonicalJson(input.parts)],
      );
      if (!result.rows[0]) {
        const replay = await pool.query(
          `SELECT * FROM agents.mobile_turn_commands
            WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
              AND relationship_id=$4 AND request_id=$5`,
          [input.scope.tenantId,input.scope.userId,input.scope.characterId,
           input.scope.relationshipId,input.requestId],
        );
        const current = replay.rows[0] ? command(replay.rows[0]) : null;
        if (current?.state === "completed" && current.agentRunId === input.agentRunId) return current;
        throw new Error("mobile turn completion conflict");
      }
      return command(result.rows[0]);
    },

    async failTurn(input: Parameters<MobileShellRepository["failTurn"]>[0]) {
      const result = await pool.query(
        `UPDATE agents.mobile_turn_commands
            SET state='failed', agent_run_id=COALESCE(agent_run_id,$5),
                failure_code=$6, updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND user_id=$2 AND relationship_id=$3 AND request_id=$4
            AND state='pending'
          RETURNING *`,
        [input.scope.tenantId,input.scope.userId,input.scope.relationshipId,input.requestId,
         input.agentRunId,input.failureCode],
      );
      if (!result.rows[0]) {
        const replay = await pool.query(
          `SELECT * FROM agents.mobile_turn_commands
            WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
              AND relationship_id=$4 AND request_id=$5`,
          [input.scope.tenantId,input.scope.userId,input.scope.characterId,
           input.scope.relationshipId,input.requestId],
        );
        const current = replay.rows[0] ? command(replay.rows[0]) : null;
        if (current?.state === "failed") return current;
        throw new Error("mobile turn failure conflict");
      }
      return command(result.rows[0]);
    },

    async readTurn(input: Parameters<MobileShellRepository["readTurn"]>[0]) {
      const result = await pool.query(
        `SELECT * FROM agents.mobile_turn_commands
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
            AND relationship_id=$4 AND request_id=$5`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,input.requestId],
      );
      return result.rows[0] ? command(result.rows[0]) : null;
    },

    async listHistory(input: Parameters<MobileShellRepository["listHistory"]>[0]) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
        throw new RangeError("history limit out of range");
      }
      const before = input.before ? new Date(input.before) : null;
      if (before && Number.isNaN(before.getTime())) throw new TypeError("invalid history cursor");
      const result = await pool.query(
        `SELECT * FROM agents.mobile_turn_commands
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND relationship_id=$4
            AND state='completed'
            AND ($5::timestamptz IS NULL OR created_at < $5::timestamptz)
          ORDER BY created_at DESC, request_id DESC LIMIT $6`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
         before?.toISOString() ?? null,input.limit],
      );
      const messages: any[] = [];
      for (const row of result.rows.reverse()) {
        const c = command(row);
        messages.push(Object.freeze({
          key: `user:${c.requestId}`, direction: "user" as const, requestId: c.requestId,
          text: c.userText, parts: Object.freeze([]), agentRunId: null, createdAt: c.createdAt,
        }));
        messages.push(Object.freeze({
          key: `assistant:${c.requestId}`, direction: "assistant" as const, requestId: c.requestId,
          replyToKey: `user:${c.requestId}`,
          text: c.reply ?? "", parts: c.parts, agentRunId: c.agentRunId, createdAt: c.updatedAt,
        }));
      }
      return Object.freeze(messages);
    },

    async appendEvent(input: Parameters<MobileShellRepository["appendEvent"]>[0]) {
      const result = await pool.query(
        `INSERT INTO agents.mobile_shell_events(
           tenant_id,user_id,character_id,relationship_id,character_session_id,event_type,payload
         ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
         input.characterSessionId,input.type,canonicalJson(input.payload)],
      );
      return event(result.rows[0]);
    },

    async listEvents(input: Parameters<MobileShellRepository["listEvents"]>[0]) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
        throw new RangeError("event limit out of range");
      }
      const after = input.after === undefined ? 0 : Number(input.after);
      if (!Number.isSafeInteger(after) || after < 0) throw new TypeError("invalid event cursor");
      const result = await pool.query(
        `SELECT * FROM agents.mobile_shell_events
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND relationship_id=$4
            AND event_cursor > $5
          ORDER BY event_cursor ASC LIMIT $6`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,after,input.limit],
      );
      return Object.freeze(result.rows.map(event));
    },

    async claimAction(input: Parameters<MobileShellRepository["claimAction"]>[0]) {
      return withTransaction(pool, async client => {
        const result = await client.query(
          `INSERT INTO agents.mobile_shell_actions(
             tenant_id,user_id,character_id,relationship_id,character_session_id,
             document_id,revision,token_hash,action_id,node_id,values_hash,state
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
           ON CONFLICT DO NOTHING RETURNING *`,
          [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
           input.characterSessionId,input.documentId,input.revision,input.tokenHash,input.actionId,input.nodeId,input.valuesHash],
        );
        if (result.rows[0]) return Object.freeze({ created: true, record: action(result.rows[0]) });
        const replay = await client.query(
          `SELECT * FROM agents.mobile_shell_actions
            WHERE tenant_id=$1 AND user_id=$2 AND relationship_id=$3
              AND document_id=$4 AND revision=$5 FOR SHARE`,
          [input.scope.tenantId,input.scope.userId,input.scope.relationshipId,input.documentId,input.revision],
        );
        const row = replay.rows[0];
        if (!row || row.character_id !== input.scope.characterId ||
            row.character_session_id !== input.characterSessionId ||
            row.token_hash !== input.tokenHash || row.action_id !== input.actionId ||
            row.node_id !== input.nodeId || row.values_hash !== input.valuesHash) {
          throw new Error("mobile shell action conflict");
        }
        return Object.freeze({ created: false, record: action(row) });
      });
    },

    async settleAction(input: Parameters<MobileShellRepository["settleAction"]>[0]) {
      const result = await pool.query(
        `UPDATE agents.mobile_shell_actions
            SET state=$6, result=$7::jsonb, updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND relationship_id=$4
            AND document_id=$5 AND revision=$8
            AND state='pending' RETURNING *`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
         input.documentId,input.state,canonicalJson(input.result ?? {}),input.revision],
      );
      if (!result.rows[0]) {
        const replay = await pool.query(
          `SELECT * FROM agents.mobile_shell_actions
            WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
              AND relationship_id=$4 AND document_id=$5 AND revision=$6`,
          [input.scope.tenantId,input.scope.userId,input.scope.characterId,
           input.scope.relationshipId,input.documentId,input.revision],
        );
        const current = replay.rows[0] ? action(replay.rows[0]) : null;
        if (current && current.state === input.state) return current;
        throw new Error("mobile shell action settlement conflict");
      }
      return action(result.rows[0]);
    },

    async readAction(input: Parameters<MobileShellRepository["readAction"]>[0]) {
      const result = await pool.query(
        `SELECT * FROM agents.mobile_shell_actions
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND relationship_id=$4
            AND document_id=$5 AND revision=$6`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,input.scope.relationshipId,
         input.documentId,input.revision],
      );
      return result.rows[0] ? action(result.rows[0]) : null;
    },
  });
}


export function createPostgresMobilePushRepository(pool: Pool): MobilePushRepository {
  return Object.freeze({
    async register(input: Parameters<MobilePushRepository["register"]>[0]) {
      if (
        input.installationId.trim().length < 16 ||
        input.installationId.length > 128 ||
        input.token.trim().length < 16 ||
        input.token.length > 4096
      ) {
        throw new TypeError("Invalid push registration");
      }
      const result = await withTransaction(pool, async (client) => {
        // A revocation may race mobile token refresh. The same User row lock
        // forces registration either before deletion (then removed) or denied.
        const user = await client.query<{ state: string }>(
          `SELECT state FROM identity.users
            WHERE tenant_id=$1 AND user_id=$2 FOR SHARE`,
          [input.tenantId,input.userId],
        );
        if (user.rows[0]?.state !== "active") {
          throw new Error("push.account_inactive");
        }
        return client.query(
          `INSERT INTO agents.mobile_push_registrations(
             tenant_id,user_id,installation_id,platform,token
           ) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id,user_id,installation_id)
           DO UPDATE SET platform=EXCLUDED.platform,token=EXCLUDED.token,
                         updated_at=clock_timestamp()
           RETURNING *`,
          [input.tenantId,input.userId,input.installationId,input.platform,input.token],
        );
      });
      const row = result.rows[0]!;
      return Object.freeze({
        tenantId: parseCanonicalId("tenant", row.tenant_id),
        userId: parseCanonicalId("user", row.user_id),
        installationId: row.installation_id,
        platform: row.platform,
        token: row.token,
        createdAt: toInstant(row.created_at),
        updatedAt: toInstant(row.updated_at),
      });
    },
    async unregister(input: Parameters<MobilePushRepository["unregister"]>[0]) {
      await pool.query(
        `DELETE FROM agents.mobile_push_registrations
          WHERE tenant_id=$1 AND user_id=$2 AND installation_id=$3`,
        [input.tenantId,input.userId,input.installationId],
      );
    },
    async list(input: Parameters<MobilePushRepository["list"]>[0]) {
      const result = await pool.query(
        `SELECT * FROM agents.mobile_push_registrations
          WHERE tenant_id=$1 AND user_id=$2
          ORDER BY updated_at DESC LIMIT 32`,
        [input.tenantId,input.userId],
      );
      return Object.freeze(result.rows.map((row: any) => Object.freeze({
        tenantId: parseCanonicalId("tenant", row.tenant_id),
        userId: parseCanonicalId("user", row.user_id),
        installationId: row.installation_id,
        platform: row.platform,
        token: row.token,
        createdAt: toInstant(row.created_at),
        updatedAt: toInstant(row.updated_at),
      })));
    },
  });
}


export function createPostgresMobileAgentActivityRepository(
  pool: Pool,
): MobileAgentActivityRepository {
  return Object.freeze({
    async setPresence(input: Parameters<MobileAgentActivityRepository["setPresence"]>[0]) {
      if (
        !Number.isSafeInteger(input.durationMs) ||
        input.durationMs < 5_000 ||
        input.durationMs > 24 * 60 * 60 * 1000
      ) {
        throw new RangeError("Invalid presence duration");
      }
      await pool.query(
        `INSERT INTO agents.mobile_presence(
          tenant_id,user_id,character_id,relationship_id,state,expires_at
        ) VALUES($1,$2,$3,$4,$5,clock_timestamp()+($6::bigint * interval '1 millisecond'))
        ON CONFLICT (tenant_id,user_id,character_id)
        DO UPDATE SET relationship_id=EXCLUDED.relationship_id,
                      state=EXCLUDED.state,
                      expires_at=EXCLUDED.expires_at,
                      updated_at=clock_timestamp()`,
        [input.scope.tenantId,input.scope.userId,input.scope.characterId,
         input.scope.relationshipId,input.state,input.durationMs],
      );
    },

    async list(input: Parameters<MobileAgentActivityRepository["list"]>[0]) {
      if (input.characterIds.length === 0) return Object.freeze([]);
      const result = await pool.query(
        `WITH wanted AS (
           SELECT unnest($3::text[]) AS character_id
         ),
         active AS (
           SELECT character_id, count(*)::int AS active_work_count
           FROM agents.mobile_turn_commands
           WHERE tenant_id=$1 AND user_id=$2 AND state='pending'
             AND character_id = ANY($3::text[])
           GROUP BY character_id
         )
         SELECT w.character_id,
                CASE
                  WHEN p.expires_at > clock_timestamp() THEN p.state
                  WHEN COALESCE(a.active_work_count,0) > 0 THEN 'working'
                  ELSE 'available'
                END AS presence,
                COALESCE(a.active_work_count,0)::int AS active_work_count
         FROM wanted w
         LEFT JOIN agents.mobile_presence p
           ON p.tenant_id=$1 AND p.user_id=$2 AND p.character_id=w.character_id
         LEFT JOIN active a ON a.character_id=w.character_id`,
        [input.tenantId,input.userId,[...input.characterIds]],
      );
      return Object.freeze(result.rows.map((row: any) => Object.freeze({
        characterId: parseCanonicalId("character", row.character_id),
        presence: row.presence,
        activeWorkCount: Number(row.active_work_count) || 0,
      })));
    },
  });
}

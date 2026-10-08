import {
  assertTalkLiveSession,
  launchTalkLivePolicy,
  transitionTalkLiveSession,
  type TalkLiveSession as CanonicalTalkLiveSession,
} from "@masanawa/agents";
import { toInstant } from "@masanawa/contracts";
import type {
  TalkLiveRepository,
  TalkLiveSessionView,
  TalkLiveState,
  TalkLiveStateView,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkLiveSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string, unknown> {
  host_user_id: string;
  state: string;
}

interface SessionRow extends Record<string, unknown> {
  session_id: string;
  role: "host" | "speaker" | "listener";
  connection_state: "connected" | "disconnected";
  is_muted: boolean;
}

interface RuntimeRow extends Record<string, unknown> {
  state: TalkLiveState;
  reconnect_grace_ends_at: string | Date | null;
}

interface CanonicalRuntimeRow extends Record<string, unknown> {
  revision: number;
  session_json: unknown;
}

async function syncCanonicalHostState(
  pool: TalkLiveSqlPool,
  tenantId: string,
  talkId: string,
  type: "host_disconnected" | "host_reconnected" | "host_grace_expired",
  now: string,
  reconnectGraceMs: number,
): Promise<void> {
  const policy = Object.freeze({
    ...launchTalkLivePolicy,
    hostReconnectGraceMs: reconnectGraceMs,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await pool.query<CanonicalRuntimeRow>(
      `SELECT revision,session_json
         FROM talks.live_canonical
        WHERE tenant_id=$1 AND talk_id=$2
        LIMIT 1`,
      [tenantId, talkId],
    );
    const row = result.rows[0];
    if (!row) return;
    const session = row.session_json as CanonicalTalkLiveSession;
    assertTalkLiveSession(session, policy);

    if (type === "host_disconnected" && session.state !== "live") return;
    if (type === "host_reconnected" && session.state !== "host_reconnecting") return;
    if (type === "host_grace_expired") {
      if (session.state !== "host_reconnecting" || session.hostReconnectDeadline === null) return;
      if (Date.parse(now) < Date.parse(session.hostReconnectDeadline)) return;
    }

    const command =
      type === "host_disconnected"
        ? ({ type: "host_disconnected", expectedRevision: session.revision } as const)
        : type === "host_reconnected"
          ? ({ type: "host_reconnected", expectedRevision: session.revision } as const)
          : ({ type: "host_grace_expired", expectedRevision: session.revision } as const);
    const transitioned = transitionTalkLiveSession(
      session,
      command,
      toInstant(now),
      policy,
    );
    const updated = await pool.query(
      `UPDATE talks.live_canonical
          SET revision=$4,session_json=$5::jsonb,updated_at=$6
        WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3`,
      [
        tenantId,
        talkId,
        session.revision,
        transitioned.session.revision,
        JSON.stringify(transitioned.session),
        now,
      ],
    );
    if ((updated.rowCount ?? 0) > 0) return;
  }
  throw new Error("Talk live revision conflict");
}

function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function currentState(
  pool: TalkLiveSqlPool,
  tenantId: string,
  talkId: string,
  now: string,
  reconnectGraceMs: number,
): Promise<TalkLiveStateView | null> {
  const talk = await pool.query<TalkRow>(
    `SELECT host_user_id, state
       FROM talks.talks
      WHERE tenant_id = $1 AND talk_id = $2
      LIMIT 1`,
    [tenantId, talkId],
  );
  if (!talk.rows[0]) return null;

  // A terminal Talk is authoritative even if its runtime projection is stale.
  // Do not expire or resurrect presence records after the Talk has ended.
  if (talk.rows[0].state === "ended") {
    const canonical = await pool.query<{ end_reason: string | null }>(
      `SELECT session_json->>'endReason' AS end_reason
         FROM talks.live_canonical
        WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
      [tenantId, talkId],
    );
    const value = canonical.rows[0]?.end_reason;
    const endReason =
      value === "host_grace_expired" || value === "host_ended" || value === "platform_ended"
        ? value
        : null;
    return Object.freeze({
      talkId,
      state: "ended",
      hostConnected: false,
      listenerCount: 0,
      aiGenerationAllowed: false,
      reconnectGraceEndsAt: null,
      endReason,
    });
  }

  const staleBefore = new Date(Date.parse(now) - 15_000).toISOString();
  const stale = await pool.query<{ role: "host" | "listener" }>(
    `UPDATE talks.live_sessions
        SET connection_state = 'disconnected',
            disconnected_at = COALESCE(disconnected_at, $3)
      WHERE tenant_id = $1
        AND talk_id = $2
        AND connection_state = 'connected'
        AND last_seen_at < $4
      RETURNING role`,
    [tenantId, talkId, now, staleBefore],
  );
  if (stale.rows.some((row) => row.role === "host")) {
    const graceEndsAt = new Date(Date.parse(now) + reconnectGraceMs).toISOString();
    await pool.query(
      `INSERT INTO talks.live_runtime (
        tenant_id, talk_id, host_user_id, state,
        reconnect_grace_ends_at, updated_at
      ) VALUES ($1,$2,$3,'reconnecting',$4,$5)
      ON CONFLICT (tenant_id, talk_id) DO UPDATE
        SET state = 'reconnecting',
            reconnect_grace_ends_at = EXCLUDED.reconnect_grace_ends_at,
            updated_at = EXCLUDED.updated_at`,
      [tenantId, talkId, talk.rows[0].host_user_id, graceEndsAt, now],
    );
    await pool.query(
      `UPDATE talks.talks
          SET state = 'reconnecting',
              updated_at = $3
        WHERE tenant_id = $1 AND talk_id = $2
          AND state <> 'ended'`,
      [tenantId, talkId, now],
    );
    await syncCanonicalHostState(
      pool,
      tenantId,
      talkId,
      "host_disconnected",
      now,
      reconnectGraceMs,
    );
  }

  const runtime = await pool.query<RuntimeRow>(
    `SELECT state, reconnect_grace_ends_at
       FROM talks.live_runtime
      WHERE tenant_id = $1 AND talk_id = $2
      LIMIT 1`,
    [tenantId, talkId],
  );
  let state: TalkLiveState =
    runtime.rows[0]?.state ??
    (talk.rows[0].state === "ended" ? "ended" : "reconnecting");
  let grace = iso(runtime.rows[0]?.reconnect_grace_ends_at ?? null);

  if (
    state === "reconnecting" &&
    grace !== null &&
    Date.parse(grace) <= Date.parse(now)
  ) {
    await pool.query(
      `UPDATE talks.live_runtime
          SET state = 'ended',
              reconnect_grace_ends_at = NULL,
              updated_at = $3
        WHERE tenant_id = $1 AND talk_id = $2`,
      [tenantId, talkId, now],
    );
    await pool.query(
      `UPDATE talks.talks
          SET state = 'ended',
              ended_at = COALESCE(ended_at, $3),
              updated_at = $3
        WHERE tenant_id = $1 AND talk_id = $2
          AND state <> 'ended'`,
      [tenantId, talkId, now],
    );
    await syncCanonicalHostState(
      pool,
      tenantId,
      talkId,
      "host_grace_expired",
      now,
      reconnectGraceMs,
    );
    state = "ended";
    grace = null;
  }

  const counts = await pool.query<{ host_count: string | number; listener_count: string | number }>(
    `SELECT
       count(*) FILTER (WHERE role = 'host' AND connection_state = 'connected')::int AS host_count,
       count(*) FILTER (WHERE role = 'listener' AND connection_state = 'connected')::int AS listener_count
       FROM talks.live_sessions
      WHERE tenant_id = $1 AND talk_id = $2`,
    [tenantId, talkId],
  );
  const hostConnected = Number(counts.rows[0]?.host_count ?? 0) > 0;
  const listenerCount = Number(counts.rows[0]?.listener_count ?? 0);
  let endReason: "host_grace_expired" | "host_ended" | "platform_ended" | null = null;
  if(state==="ended"){
    const canonical=await pool.query<{end_reason:string|null}>(
      `SELECT session_json->>'endReason' AS end_reason
         FROM talks.live_canonical
        WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
      [tenantId,talkId],
    );
    const value=canonical.rows[0]?.end_reason;
    if(value==="host_grace_expired"||value==="host_ended"||value==="platform_ended"){
      endReason=value;
    }
  }

  return Object.freeze({
    talkId,
    state,
    hostConnected,
    listenerCount,
    aiGenerationAllowed: state === "live" && hostConnected,
    reconnectGraceEndsAt: grace,
    endReason,
  });
}

function sessionView(
  row: SessionRow,
  state: TalkLiveStateView,
  talkId: string,
): TalkLiveSessionView {
  return Object.freeze({
    sessionId: row.session_id,
    talkId,
    role: row.role,
    state: state.state,
    canPublishAudio:
      row.role !== "listener" && !row.is_muted && state.state === "live",
    canHearAudio: state.state !== "ended",
    aiGenerationAllowed: state.aiGenerationAllowed,
    reconnectGraceEndsAt: state.reconnectGraceEndsAt,
    endReason: state.endReason ?? null,
  });
}

export function createPostgresTalkLiveRepository(
  pool: TalkLiveSqlPool,
): TalkLiveRepository {
  return Object.freeze<TalkLiveRepository>({
    async connect(input) {
      const talk = await pool.query<TalkRow>(
        `SELECT host_user_id, state
           FROM talks.talks
          WHERE tenant_id = $1 AND talk_id = $2
          LIMIT 1`,
        [input.tenantId, input.talkId],
      );
      const talkRow = talk.rows[0];
      if (!talkRow) return null;
      if (talkRow.state === "ended") throw new Error("talks.live.ended");

      const before = await currentState(
        pool,
        input.tenantId,
        input.talkId,
        input.now,
        input.reconnectGraceMs,
      );
      if (before?.state === "ended") throw new Error("talks.live.ended");

      let role: "host" | "speaker" | "listener" =
        talkRow.host_user_id === input.userId ? "host" : "listener";
      let isMuted = false;
      if (role !== "host") {
        const seat = await pool.query<{ is_muted: boolean }>(
          `SELECT is_muted
             FROM talks.talk_seats
            WHERE tenant_id = $1 AND talk_id = $2
              AND user_id = $3 AND active = true AND kind = 'human'
            LIMIT 1`,
          [input.tenantId, input.talkId, input.userId],
        );
        if (seat.rows[0]) {
          role = "speaker";
          isMuted = seat.rows[0].is_muted;
        }
      }
      // The database permits only one connected human Host session per Talk.
      // A resumed Host atomically supersedes its previous lease, rather than
      // failing the unique index during app/network restarts. The old session
      // ID immediately stops authorizing heartbeat or new media credentials.
      const sessionWrite = await pool.query(
        `INSERT INTO talks.live_sessions (
          tenant_id, talk_id, session_id, user_id, role, is_muted,
          connection_state, connected_at, last_seen_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'connected',$7,$7)${role === "host" ? `
        ON CONFLICT (tenant_id, talk_id)
          WHERE role = 'host' AND connection_state = 'connected'
        DO UPDATE SET
          session_id = EXCLUDED.session_id,
          connected_at = EXCLUDED.connected_at,
          last_seen_at = EXCLUDED.last_seen_at,
          disconnected_at = NULL,
          is_muted = false
        WHERE talks.live_sessions.user_id = EXCLUDED.user_id` : ""}`,
        [
          input.tenantId,
          input.talkId,
          input.sessionId,
          input.userId,
          role,
          isMuted,
          input.now,
        ],
      );
      if (sessionWrite.rowCount === 0) {
        // Never steal an unrelated user's Host lease if storage is corrupt.
        throw new Error("talks.live.host_session_owner_mismatch");
      }

      if (role === "host") {
        await pool.query(
          `INSERT INTO talks.live_runtime (
            tenant_id, talk_id, host_user_id, state,
            reconnect_grace_ends_at, updated_at
          ) VALUES ($1,$2,$3,'live',NULL,$4)
          ON CONFLICT (tenant_id, talk_id) DO UPDATE
            SET host_user_id = EXCLUDED.host_user_id,
                state = 'live',
                reconnect_grace_ends_at = NULL,
                updated_at = EXCLUDED.updated_at`,
          [input.tenantId, input.talkId, input.userId, input.now],
        );
        await pool.query(
          `UPDATE talks.talks
              SET state = 'live',
                  started_at = COALESCE(started_at, $3),
                  ended_at = NULL,
                  updated_at = $3
            WHERE tenant_id = $1 AND talk_id = $2`,
          [input.tenantId, input.talkId, input.now],
        );
        await syncCanonicalHostState(
          pool,
          input.tenantId,
          input.talkId,
          "host_reconnected",
          input.now,
          input.reconnectGraceMs,
        );
      }

      const state = await currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
      return sessionView(
        {
          session_id: input.sessionId,
          role,
          connection_state: "connected",
          is_muted: isMuted,
        },
        state!,
        input.talkId,
      );
    },

    async heartbeat(input) {
      const before = await currentState(
        pool,
        input.tenantId,
        input.talkId,
        input.now,
        input.reconnectGraceMs,
      );
      if (!before || before.state === "ended") return null;

      const session = await pool.query<SessionRow>(
        `UPDATE talks.live_sessions
            SET last_seen_at = $5,
                connection_state = 'connected'
          WHERE tenant_id = $1
            AND talk_id = $2
            AND session_id = $3
            AND user_id = $4
            AND connection_state = 'connected'
          RETURNING session_id, role, connection_state, is_muted`,
        [
          input.tenantId,
          input.talkId,
          input.sessionId,
          input.userId,
          input.now,
        ],
      );
      const row = session.rows[0];
      if (!row) return null;

      if (row.role === "host") {
        await pool.query(
          `UPDATE talks.live_runtime
              SET state = 'live',
                  reconnect_grace_ends_at = NULL,
                  updated_at = $3
            WHERE tenant_id = $1 AND talk_id = $2`,
          [input.tenantId, input.talkId, input.now],
        );
        await pool.query(
          `UPDATE talks.talks
              SET state = 'live',
                  ended_at = NULL,
                  updated_at = $3
            WHERE tenant_id = $1 AND talk_id = $2
              AND state <> 'ended'`,
          [input.tenantId, input.talkId, input.now],
        );
        await syncCanonicalHostState(
          pool,
          input.tenantId,
          input.talkId,
          "host_reconnected",
          input.now,
          input.reconnectGraceMs,
        );
      }

      const state = await currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
      return state ? sessionView(row, state, input.talkId) : null;
    },

    async disconnect(input) {
      const session = await pool.query<SessionRow>(
        `UPDATE talks.live_sessions
            SET connection_state = 'disconnected',
                disconnected_at = $5,
                last_seen_at = $5
          WHERE tenant_id = $1
            AND talk_id = $2
            AND session_id = $3
            AND user_id = $4
            AND connection_state = 'connected'
          RETURNING session_id, role, connection_state, is_muted`,
        [
          input.tenantId,
          input.talkId,
          input.sessionId,
          input.userId,
          input.now,
        ],
      );
      const row = session.rows[0];
      if (!row) return null;

      if (row.role === "host") {
        const graceEndsAt = new Date(
          Date.parse(input.now) + input.reconnectGraceMs,
        ).toISOString();
        await pool.query(
          `UPDATE talks.live_runtime
              SET state = 'reconnecting',
                  reconnect_grace_ends_at = $3,
                  updated_at = $4
            WHERE tenant_id = $1 AND talk_id = $2`,
          [input.tenantId, input.talkId, graceEndsAt, input.now],
        );
        await pool.query(
          `UPDATE talks.talks
              SET state = 'reconnecting',
                  updated_at = $3
            WHERE tenant_id = $1 AND talk_id = $2
              AND state <> 'ended'`,
          [input.tenantId, input.talkId, input.now],
        );
        await syncCanonicalHostState(
          pool,
          input.tenantId,
          input.talkId,
          "host_disconnected",
          input.now,
          input.reconnectGraceMs,
        );
      }

      return currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
    },

    async state(input) {
      return currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
    },
  });
}


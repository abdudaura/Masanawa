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
  role: "host" | "listener";
  connection_state: "connected" | "disconnected";
}

interface RuntimeRow extends Record<string, unknown> {
  state: TalkLiveState;
  reconnect_grace_ends_at: string | Date | null;
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

  return Object.freeze({
    talkId,
    state,
    hostConnected,
    listenerCount,
    aiGenerationAllowed: state === "live" && hostConnected,
    reconnectGraceEndsAt: grace,
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
    canPublishAudio: row.role === "host" && state.state === "live",
    canHearAudio: state.state !== "ended",
    aiGenerationAllowed: state.aiGenerationAllowed,
    reconnectGraceEndsAt: state.reconnectGraceEndsAt,
  });
}

export function createPostgresTalkLiveRepository(
  pool: TalkLiveSqlPool,
): TalkLiveRepository {
  return Object.freeze({
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

      const role = talkRow.host_user_id === input.userId ? "host" : "listener";
      await pool.query(
        `INSERT INTO talks.live_sessions (
          tenant_id, talk_id, session_id, user_id, role,
          connection_state, connected_at, last_seen_at
        ) VALUES ($1,$2,$3,$4,$5,'connected',$6,$6)`,
        [
          input.tenantId,
          input.talkId,
          input.sessionId,
          input.userId,
          role,
          input.now,
        ],
      );

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
      }

      const state = await currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
      return sessionView(
        {
          session_id: input.sessionId,
          role,
          connection_state: "connected",
        },
        state!,
        input.talkId,
      );
    },

    async heartbeat(input) {
      const session = await pool.query<SessionRow>(
        `UPDATE talks.live_sessions
            SET last_seen_at = $5,
                connection_state = 'connected'
          WHERE tenant_id = $1
            AND talk_id = $2
            AND session_id = $3
            AND user_id = $4
          RETURNING session_id, role, connection_state`,
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
          RETURNING session_id, role, connection_state`,
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
      }

      return currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
    },

    async state(input) {
      return currentState(pool, input.tenantId, input.talkId, input.now, input.reconnectGraceMs);
    },
  });
}

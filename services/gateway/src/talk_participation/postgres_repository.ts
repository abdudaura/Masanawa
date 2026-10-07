import type {
  TalkHandStatus,
  TalkHostControlsView,
  TalkHostParticipantAction,
  TalkHostParticipantView,
  TalkHostRequestAction,
  TalkHostRequestRecord,
  TalkHostRequestView,
  TalkParticipationRepository,
  TalkParticipationView,
  TalkReaction,
  TalkRequestDecision,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkParticipationSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface ViewerRow extends Record<string, unknown> {
  reaction: TalkReaction | null;
  hand_status: TalkHandStatus | null;
}

interface TalkAuthorityRow extends Record<string, unknown> {
  host_user_id: string;
  host_name: string;
  state: "draft" | "live" | "reconnecting" | "ended";
}

interface RequestRow extends Record<string, unknown> {
  request_id: string;
  requester_user_id: string | null;
  kind: "human_speaker" | "sponsored_expert" | "sponsored_twin";
  display_name: string;
  detail: string;
  avatar_url: string | null;
  amount_label: string | null;
  participant_id: string;
  participant_kind: "human" | "expert" | "twin";
  persona_id: string | null;
  commerce_authorization_id: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
}

interface ParticipantRow extends Record<string, unknown> {
  participant_id: string;
  user_id: string | null;
  kind: "human" | "expert" | "twin";
  display_name: string;
  avatar_url: string | null;
  is_muted: boolean;
  state: "active" | "removed";
}

interface CountRow extends Record<string, unknown> {
  total_count: string | number;
  ai_count: string | number;
}

function viewer(row: ViewerRow | undefined): TalkParticipationView {
  return Object.freeze({
    handStatus: row?.hand_status ?? "idle",
    reaction: row?.reaction ?? null,
  });
}

function requestRecord(row: RequestRow): TalkHostRequestRecord {
  return Object.freeze({
    requestId: row.request_id,
    requesterUserId: row.requester_user_id,
    kind: row.kind,
    displayName: row.display_name,
    detail: row.detail,
    avatarUrl: row.avatar_url,
    amountLabel: row.amount_label,
    participantId: row.participant_id,
    participantKind: row.participant_kind,
    personaId: row.persona_id,
    commerceAuthorizationId: row.commerce_authorization_id,
    status: row.status,
  });
}

function requestView(row: RequestRow): TalkHostRequestView {
  return Object.freeze({
    requestId: row.request_id,
    kind: row.kind,
    displayName: row.display_name,
    detail: row.detail,
    avatarUrl: row.avatar_url,
    amountLabel: row.amount_label,
  });
}

function participantView(row: ParticipantRow): TalkHostParticipantView {
  return Object.freeze({
    participantId: row.participant_id,
    displayName: row.display_name,
    kind: row.kind,
    isHost: false,
    isMuted: row.is_muted,
    avatarUrl: row.avatar_url,
  });
}

async function authority(
  pool: TalkParticipationSqlPool,
  tenantId: string,
  talkId: string,
): Promise<TalkAuthorityRow | null> {
  const result = await pool.query<TalkAuthorityRow>(
    `SELECT host_user_id, host_name, state
       FROM talks.talks
      WHERE tenant_id = $1 AND talk_id = $2
      LIMIT 1`,
    [tenantId, talkId],
  );
  return result.rows[0] ?? null;
}

async function readHostControls(
  pool: TalkParticipationSqlPool,
  input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
  }>,
): Promise<TalkHostControlsView | null> {
  const talk = await authority(pool, input.tenantId, input.talkId);
  if (!talk) return null;
  if (talk.host_user_id !== input.hostUserId) {
    throw new Error("talks.host_required");
  }

  const [requests, participants] = await Promise.all([
    pool.query<RequestRow>(
      `SELECT request_id, requester_user_id, kind, display_name, detail,
              avatar_url, amount_label, participant_id, participant_kind,
              persona_id, commerce_authorization_id, status
         FROM talks.seat_requests
        WHERE tenant_id = $1 AND talk_id = $2 AND status = 'pending'
        ORDER BY created_at ASC, request_id ASC`,
      [input.tenantId, input.talkId],
    ),
    pool.query<ParticipantRow>(
      `SELECT participant_id, user_id, kind, display_name, avatar_url,
              is_muted, state
         FROM talks.participants
        WHERE tenant_id = $1 AND talk_id = $2 AND state = 'active'
        ORDER BY joined_at ASC, participant_id ASC`,
      [input.tenantId, input.talkId],
    ),
  ]);

  return Object.freeze({
    requests: Object.freeze(requests.rows.map(requestView)),
    participants: Object.freeze([
      Object.freeze({
        participantId: talk.host_user_id,
        displayName: talk.host_name,
        kind: "human" as const,
        isHost: true,
        isMuted: false,
        avatarUrl: null,
      }),
      ...participants.rows.map(participantView),
    ]),
  });
}

async function requestById(
  pool: TalkParticipationSqlPool,
  tenantId: string,
  talkId: string,
  requestId: string,
): Promise<TalkHostRequestRecord | null> {
  const result = await pool.query<RequestRow>(
    `SELECT request_id, requester_user_id, kind, display_name, detail,
            avatar_url, amount_label, participant_id, participant_kind,
            persona_id, commerce_authorization_id, status
       FROM talks.seat_requests
      WHERE tenant_id = $1 AND talk_id = $2 AND request_id = $3
      LIMIT 1`,
    [tenantId, talkId, requestId],
  );
  return result.rows[0] ? requestRecord(result.rows[0]) : null;
}

async function readViewerState(
  pool: TalkParticipationSqlPool,
  input: Readonly<{ tenantId: string; talkId: string; userId: string }>,
): Promise<TalkParticipationView | null> {
  const result = await pool.query<ViewerRow>(
    `SELECT p.reaction, p.hand_status
       FROM talks.talks t
       LEFT JOIN talks.participation p
         ON p.tenant_id = t.tenant_id
        AND p.talk_id = t.talk_id
        AND p.user_id = $3
      WHERE t.tenant_id = $1 AND t.talk_id = $2
      LIMIT 1`,
    [input.tenantId, input.talkId, input.userId],
  );
  const row = result.rows[0];
  return row ? viewer(row) : null;
}

function finalizedActionMatches(
  request: TalkHostRequestRecord,
  action: TalkHostRequestAction,
): boolean {
  return (
    (action === "accept" && request.status === "accepted") ||
    (action === "decline" && request.status === "declined")
  );
}

export function createPostgresTalkParticipationRepository(
  pool: TalkParticipationSqlPool,
): TalkParticipationRepository {
  return Object.freeze({
    async readViewer(input) {
      return readViewerState(pool, input);
    },

    async setReaction(input) {
      const updated = await pool.query<ViewerRow>(
        `INSERT INTO talks.participation AS p (
           tenant_id, talk_id, user_id, reaction, reaction_changed_at,
           hand_status, hand_request_id, updated_at
         )
         SELECT $1,$2,$3,$4,$5,'idle',NULL,$5
           FROM talks.talks t
          WHERE t.tenant_id = $1
            AND t.talk_id = $2
            AND t.state IN ('live','reconnecting','ended')
         ON CONFLICT (tenant_id, talk_id, user_id) DO UPDATE
           SET reaction = EXCLUDED.reaction,
               reaction_changed_at = EXCLUDED.reaction_changed_at,
               updated_at = EXCLUDED.updated_at
         WHERE p.reaction IS NOT DISTINCT FROM EXCLUDED.reaction
            OR p.reaction_changed_at IS NULL
            OR p.reaction_changed_at <=
               EXCLUDED.reaction_changed_at - ($6::int * interval '1 millisecond')
         RETURNING reaction, hand_status`,
        [
          input.tenantId,
          input.talkId,
          input.userId,
          input.reaction,
          input.changedAt,
          input.minimumIntervalMs,
        ],
      );
      if (updated.rows[0]) return viewer(updated.rows[0]);

      const existing = await readViewerState(pool, {
        tenantId: input.tenantId,
        talkId: input.talkId,
        userId: input.userId,
      });
      if (!existing) return null;
      if (existing.reaction === input.reaction) return existing;
      throw new Error("talks.reaction_rate_limited");
    },

    async setHandRaised(input) {
      const talk = await authority(pool, input.tenantId, input.talkId);
      if (!talk) return null;
      if (talk.host_user_id === input.userId) {
        throw new Error("talks.host_cannot_raise_hand");
      }
      if (talk.state === "ended" || talk.state === "draft") {
        throw new Error("talks.not_live");
      }

      const active = await pool.query<{ participant_id: string }>(
        `SELECT participant_id
           FROM talks.participants
          WHERE tenant_id = $1
            AND talk_id = $2
            AND user_id = $3
            AND kind = 'human'
            AND state = 'active'
          LIMIT 1`,
        [input.tenantId, input.talkId, input.userId],
      );
      if (active.rows[0]) {
        const accepted = await pool.query<ViewerRow>(
          `INSERT INTO talks.participation (
             tenant_id, talk_id, user_id, reaction, reaction_changed_at,
             hand_status, hand_request_id, updated_at
           ) VALUES ($1,$2,$3,NULL,NULL,'accepted',NULL,$4)
           ON CONFLICT (tenant_id, talk_id, user_id) DO UPDATE
             SET hand_status = 'accepted',
                 hand_request_id = NULL,
                 updated_at = EXCLUDED.updated_at
           RETURNING reaction, hand_status`,
          [input.tenantId, input.talkId, input.userId, input.changedAt],
        );
        return viewer(accepted.rows[0]);
      }

      if (input.raised) {
        const request = await pool.query<{
          request_id: string;
          participant_id: string;
        }>(
          `INSERT INTO talks.seat_requests AS r (
             tenant_id, talk_id, request_id, requester_user_id, kind,
             display_name, detail, avatar_url, amount_label,
             participant_id, participant_kind, persona_id,
             commerce_authorization_id, status, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,'human_speaker',$5,'Wants to speak',NULL,NULL,
             $6,'human',NULL,NULL,'pending',$7,$7
           )
           ON CONFLICT (tenant_id, talk_id, requester_user_id)
             WHERE kind = 'human_speaker'
               AND status = 'pending'
               AND requester_user_id IS NOT NULL
           DO UPDATE SET
             display_name = EXCLUDED.display_name,
             updated_at = EXCLUDED.updated_at
           RETURNING request_id, participant_id`,
          [
            input.tenantId,
            input.talkId,
            input.requestId,
            input.userId,
            input.userName,
            input.participantId,
            input.changedAt,
          ],
        );
        const requestRow = request.rows[0];
        if (!requestRow) throw new Error("talks.request_unavailable");

        const state = await pool.query<ViewerRow>(
          `INSERT INTO talks.participation (
             tenant_id, talk_id, user_id, reaction, reaction_changed_at,
             hand_status, hand_request_id, updated_at
           ) VALUES ($1,$2,$3,NULL,NULL,'raised',$4,$5)
           ON CONFLICT (tenant_id, talk_id, user_id) DO UPDATE
             SET hand_status = 'raised',
                 hand_request_id = EXCLUDED.hand_request_id,
                 updated_at = EXCLUDED.updated_at
           RETURNING reaction, hand_status`,
          [
            input.tenantId,
            input.talkId,
            input.userId,
            requestRow.request_id,
            input.changedAt,
          ],
        );
        return viewer(state.rows[0]);
      }

      const current = await readViewerState(pool, {
        tenantId: input.tenantId,
        talkId: input.talkId,
        userId: input.userId,
      });
      if (!current) return null;
      if (current.handStatus === "accepted") return current;

      await pool.query(
        `UPDATE talks.seat_requests
            SET status = 'cancelled',
                updated_at = $4
          WHERE tenant_id = $1
            AND talk_id = $2
            AND requester_user_id = $3
            AND kind = 'human_speaker'
            AND status = 'pending'`,
        [input.tenantId, input.talkId, input.userId, input.changedAt],
      );
      const lowered = await pool.query<ViewerRow>(
        `INSERT INTO talks.participation (
           tenant_id, talk_id, user_id, reaction, reaction_changed_at,
           hand_status, hand_request_id, updated_at
         ) VALUES ($1,$2,$3,NULL,NULL,'idle',NULL,$4)
         ON CONFLICT (tenant_id, talk_id, user_id) DO UPDATE
           SET hand_status = 'idle',
               hand_request_id = NULL,
               updated_at = EXCLUDED.updated_at
         RETURNING reaction, hand_status`,
        [input.tenantId, input.talkId, input.userId, input.changedAt],
      );
      return viewer(lowered.rows[0]);
    },

    async readHostControls(input) {
      return readHostControls(pool, input);
    },

    async actOnRequest(input): Promise<TalkRequestDecision | null> {
      const talk = await authority(pool, input.tenantId, input.talkId);
      if (!talk) return null;
      if (talk.host_user_id !== input.hostUserId) {
        throw new Error("talks.host_required");
      }
      if (talk.state === "ended" || talk.state === "draft") {
        throw new Error("talks.not_live");
      }

      const existing = await requestById(
        pool,
        input.tenantId,
        input.talkId,
        input.requestId,
      );
      if (!existing) throw new Error("talks.request_not_found");
      if (existing.status !== "pending") {
        if (!finalizedActionMatches(existing, input.action)) {
          throw new Error("talks.request_finalized");
        }
        const controls = await readHostControls(pool, input);
        if (!controls) return null;
        return Object.freeze({ request: existing, controls });
      }

      if (input.action === "decline") {
        const decided = await pool.query<RequestRow>(
          `UPDATE talks.seat_requests
              SET status = 'declined',
                  updated_at = $4
            WHERE tenant_id = $1
              AND talk_id = $2
              AND request_id = $3
              AND status = 'pending'
            RETURNING request_id, requester_user_id, kind, display_name, detail,
                      avatar_url, amount_label, participant_id, participant_kind,
                      persona_id, commerce_authorization_id, status`,
          [
            input.tenantId,
            input.talkId,
            input.requestId,
            input.changedAt,
          ],
        );
        const row = decided.rows[0];
        if (!row) throw new Error("talks.request_finalized");
        if (row.requester_user_id) {
          await pool.query(
            `UPDATE talks.participation
                SET hand_status = 'declined',
                    hand_request_id = NULL,
                    updated_at = $4
              WHERE tenant_id = $1
                AND talk_id = $2
                AND user_id = $3`,
            [
              input.tenantId,
              input.talkId,
              row.requester_user_id,
              input.changedAt,
            ],
          );
        }
        const controls = await readHostControls(pool, input);
        if (!controls) return null;
        return Object.freeze({ request: requestRecord(row), controls });
      }

      if (
        existing.participantKind !== "human" &&
        !existing.commerceAuthorizationId
      ) {
        throw new Error("talks.ai_commerce_required");
      }

      const counts = await pool.query<CountRow>(
        `SELECT count(*)::int AS total_count,
                count(*) FILTER (WHERE kind IN ('expert','twin'))::int AS ai_count
           FROM talks.participants
          WHERE tenant_id = $1 AND talk_id = $2 AND state = 'active'`,
        [input.tenantId, input.talkId],
      );
      const total = Number(counts.rows[0]?.total_count ?? 0);
      const ai = Number(counts.rows[0]?.ai_count ?? 0);
      if (1 + total >= input.maxSeats) throw new Error("talks.seat_capacity");
      if (
        existing.participantKind !== "human" &&
        ai >= input.maxAiSeats
      ) {
        throw new Error("talks.ai_seat_capacity");
      }

      const accepted = await pool.query<RequestRow>(
        `WITH accepted AS (
           UPDATE talks.seat_requests
              SET status = 'accepted',
                  updated_at = $4
            WHERE tenant_id = $1
              AND talk_id = $2
              AND request_id = $3
              AND status = 'pending'
            RETURNING request_id, requester_user_id, kind, display_name, detail,
                      avatar_url, amount_label, participant_id, participant_kind,
                      persona_id, commerce_authorization_id, status
         ),
         admitted AS (
           INSERT INTO talks.participants (
             tenant_id, talk_id, participant_id, user_id, kind, display_name,
             avatar_url, is_muted, state, source_request_id, joined_at, updated_at
           )
           SELECT $1,$2,a.participant_id,a.requester_user_id,a.participant_kind,
                  a.display_name,a.avatar_url,false,'active',a.request_id,$4,$4
             FROM accepted a
           ON CONFLICT (tenant_id, talk_id, participant_id) DO UPDATE
             SET user_id = EXCLUDED.user_id,
                 kind = EXCLUDED.kind,
                 display_name = EXCLUDED.display_name,
                 avatar_url = EXCLUDED.avatar_url,
                 is_muted = false,
                 state = 'active',
                 source_request_id = EXCLUDED.source_request_id,
                 updated_at = EXCLUDED.updated_at
           RETURNING participant_id
         )
         SELECT a.request_id, a.requester_user_id, a.kind, a.display_name,
                a.detail, a.avatar_url, a.amount_label, a.participant_id,
                a.participant_kind, a.persona_id,
                a.commerce_authorization_id, a.status
           FROM accepted a
          WHERE EXISTS (SELECT 1 FROM admitted)`,
        [
          input.tenantId,
          input.talkId,
          input.requestId,
          input.changedAt,
        ],
      );
      const row = accepted.rows[0];
      if (!row) throw new Error("talks.request_finalized");

      if (row.requester_user_id) {
        await pool.query(
          `INSERT INTO talks.participation (
             tenant_id, talk_id, user_id, reaction, reaction_changed_at,
             hand_status, hand_request_id, updated_at
           ) VALUES ($1,$2,$3,NULL,NULL,'accepted',NULL,$4)
           ON CONFLICT (tenant_id, talk_id, user_id) DO UPDATE
             SET hand_status = 'accepted',
                 hand_request_id = NULL,
                 updated_at = EXCLUDED.updated_at`,
          [
            input.tenantId,
            input.talkId,
            row.requester_user_id,
            input.changedAt,
          ],
        );
      }

      const controls = await readHostControls(pool, input);
      if (!controls) return null;
      return Object.freeze({ request: requestRecord(row), controls });
    },

    async actOnParticipant(input) {
      const talk = await authority(pool, input.tenantId, input.talkId);
      if (!talk) return null;
      if (talk.host_user_id !== input.hostUserId) {
        throw new Error("talks.host_required");
      }
      if (input.participantId === talk.host_user_id) {
        throw new Error("talks.host_immutable");
      }

      const existing = await pool.query<ParticipantRow>(
        `SELECT participant_id, user_id, kind, display_name, avatar_url,
                is_muted, state
           FROM talks.participants
          WHERE tenant_id = $1 AND talk_id = $2 AND participant_id = $3
          LIMIT 1`,
        [input.tenantId, input.talkId, input.participantId],
      );
      const participant = existing.rows[0];
      if (!participant) throw new Error("talks.participant_not_found");
      if (participant.state === "removed") {
        if (input.action === "remove") {
          return readHostControls(pool, input);
        }
        throw new Error("talks.participant_not_found");
      }

      const update = input.action === "remove"
        ? `state = 'removed', is_muted = true`
        : input.action === "mute"
          ? `is_muted = true`
          : `is_muted = false`;
      await pool.query(
        `UPDATE talks.participants
            SET ${update},
                updated_at = $4
          WHERE tenant_id = $1 AND talk_id = $2 AND participant_id = $3`,
        [input.tenantId, input.talkId, input.participantId, input.changedAt],
      );

      if (input.action === "remove" && participant.user_id) {
        await pool.query(
          `UPDATE talks.participation
              SET hand_status = 'idle',
                  hand_request_id = NULL,
                  updated_at = $4
            WHERE tenant_id = $1 AND talk_id = $2 AND user_id = $3`,
          [
            input.tenantId,
            input.talkId,
            participant.user_id,
            input.changedAt,
          ],
        );
      }

      return readHostControls(pool, input);
    },

    async endTalk(input) {
      const talk = await authority(pool, input.tenantId, input.talkId);
      if (!talk) return false;
      if (talk.host_user_id !== input.hostUserId) {
        throw new Error("talks.host_required");
      }

      await pool.query(
        `UPDATE talks.talks
            SET state = 'ended',
                ended_at = COALESCE(ended_at, $3),
                duration_seconds = COALESCE(
                  duration_seconds,
                  GREATEST(
                    0,
                    FLOOR(EXTRACT(EPOCH FROM (
                      $3::timestamptz - COALESCE(started_at, $3::timestamptz)
                    )))::int
                  )
                ),
                updated_at = $3
          WHERE tenant_id = $1 AND talk_id = $2`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      await pool.query(
        `UPDATE talks.live_runtime
            SET state = 'ended',
                reconnect_grace_ends_at = NULL,
                updated_at = $3
          WHERE tenant_id = $1 AND talk_id = $2`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      await pool.query(
        `UPDATE talks.live_sessions
            SET connection_state = 'disconnected',
                disconnected_at = COALESCE(disconnected_at, $3),
                last_seen_at = $3
          WHERE tenant_id = $1
            AND talk_id = $2
            AND connection_state = 'connected'`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      await pool.query(
        `UPDATE talks.seat_requests
            SET status = 'cancelled',
                updated_at = $3
          WHERE tenant_id = $1 AND talk_id = $2 AND status = 'pending'`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      await pool.query(
        `UPDATE talks.participants
            SET state = 'removed',
                is_muted = true,
                updated_at = $3
          WHERE tenant_id = $1 AND talk_id = $2 AND state = 'active'`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      await pool.query(
        `UPDATE talks.participation
            SET hand_status = 'idle',
                hand_request_id = NULL,
                updated_at = $3
          WHERE tenant_id = $1 AND talk_id = $2`,
        [input.tenantId, input.talkId, input.endedAt],
      );
      return true;
    },
  });
}

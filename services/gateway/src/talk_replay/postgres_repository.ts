import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  assertTalkReplaySession,
  createTalkReplaySession,
  isReplayPubliclyVisible,
  transitionTalkReplaySession,
  type TalkId,
  type TalkRecordingId,
  type TalkRecordingSegmentId,
  type TalkReplayFinalizeReason,
  type TalkReplaySession,
} from "@masanawa/agents";
import {
  parseCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import { withTransaction } from "@masanawa/postgres";
import type {
  TalkReplayProviderStatus,
  TalkReplayRecord,
  TalkReplayRepository,
} from "./model.js";

interface ReplayRow {
  tenant_id: string;
  talk_id: string;
  recording_id: string;
  host_user_id: string;
  session_json: unknown;
  egress_id: string | null;
  object_key: string;
  provider_status: TalkReplayProviderStatus;
  provider_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: ReplayRow): TalkReplayRecord {
  const session = row.session_json as TalkReplaySession;
  assertTalkReplaySession(session);
  return Object.freeze({
    tenantId: row.tenant_id,
    talkId: row.talk_id,
    recordingId: row.recording_id,
    hostUserId: row.host_user_id,
    session,
    egressId: row.egress_id,
    objectKey: row.object_key,
    providerStatus: row.provider_status,
    providerError: row.provider_error,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

const columns = `
  tenant_id,talk_id,recording_id,host_user_id,session_json,
  egress_id,object_key,provider_status,provider_error,created_at,updated_at
`;

async function requireHostLive(
  client: import("pg").PoolClient,
  tenantId: string,
  talkId: string,
  hostUserId: string,
): Promise<void> {
  const result = await client.query<{ host_user_id: string; state: string }>(
    `SELECT host_user_id,state
       FROM talks.talks
      WHERE tenant_id=$1 AND talk_id=$2
      FOR UPDATE`,
    [tenantId, talkId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("talks.not_found");
  if (row.host_user_id !== hostUserId) throw new Error("talks.host_forbidden");
  if (row.state !== "live" && row.state !== "reconnecting") {
    throw new Error("talks.not_live");
  }
}

async function endReason(
  client: import("pg").PoolClient,
  tenantId: string,
  talkId: string,
): Promise<TalkReplayFinalizeReason> {
  const result = await client.query<{ reason: string | null }>(
    `SELECT session_json->>'endReason' AS reason
       FROM talks.live_canonical
      WHERE tenant_id=$1 AND talk_id=$2
      LIMIT 1`,
    [tenantId, talkId],
  );
  const reason = result.rows[0]?.reason;
  return reason === "host_grace_expired" ||
    reason === "host_ended" ||
    reason === "platform_ended"
    ? reason
    : "host_ended";
}

function objectKey(input: {
  tenantId: string;
  talkId: string;
  recordingId: string;
}): string {
  const safe = (value: string) =>
    value.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 220);
  return `talk-replays/${safe(input.tenantId)}/${safe(input.talkId)}/${safe(input.recordingId)}.mp4`;
}

export function createPostgresTalkReplayRepository(
  pool: Pool,
): TalkReplayRepository {
  return Object.freeze({
    async prepare(input) {
      return withTransaction(pool, async (client) => {
        await requireHostLive(
          client,
          input.tenantId,
          input.talkId,
          input.hostUserId,
        );
        const existing = await client.query<ReplayRow>(
          `SELECT ${columns}
             FROM talks.replays
            WHERE tenant_id=$1 AND talk_id=$2
            FOR UPDATE`,
          [input.tenantId, input.talkId],
        );
        if (existing.rows[0]) return mapRow(existing.rows[0]);

        const recordingId = `recording_${randomUUID()}` as TalkRecordingId;
        const session = createTalkReplaySession({
          tenantId: parseCanonicalId("tenant", input.tenantId),
          talkId: input.talkId as TalkId,
          recordingId,
          hostUserId: parseCanonicalId("user", input.hostUserId),
          hostRecordingConsent: true,
          publicationPreference: input.publicationPreference,
          startedAt: toInstant(input.now),
        });
        const key = objectKey({
          tenantId: input.tenantId,
          talkId: input.talkId,
          recordingId,
        });
        const inserted = await client.query<ReplayRow>(
          `INSERT INTO talks.replays(
             tenant_id,talk_id,recording_id,host_user_id,session_json,
             egress_id,object_key,provider_status,provider_error,created_at,updated_at
           ) VALUES($1,$2,$3,$4,$5::jsonb,NULL,$6,'requested',NULL,$7,$7)
           RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            recordingId,
            input.hostUserId,
            canonicalJson(session),
            key,
            input.now,
          ],
        );
        return mapRow(inserted.rows[0]!);
      });
    },

    async attachEgress(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<ReplayRow>(
          `UPDATE talks.replays
              SET egress_id=COALESCE(egress_id,$3),
                  provider_status=$4,
                  provider_error=NULL,
                  updated_at=$5
            WHERE tenant_id=$1 AND talk_id=$2
              AND (egress_id IS NULL OR egress_id=$3)
            RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            input.egressId,
            input.providerStatus,
            input.now,
          ],
        );
        if (!result.rows[0]) throw new Error("talks.replay_not_found");
        return mapRow(result.rows[0]);
      });
    },

    async markProvider(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<ReplayRow>(
          `UPDATE talks.replays
              SET provider_status=$3,
                  provider_error=$4,
                  updated_at=$5
            WHERE tenant_id=$1 AND talk_id=$2
            RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            input.providerStatus,
            input.providerError?.slice(0, 500) ?? null,
            input.now,
          ],
        );
        return result.rows[0] ? mapRow(result.rows[0]) : null;
      });
    },

    async read(input) {
      const result = await pool.query<ReplayRow>(
        `SELECT ${columns}
           FROM talks.replays
          WHERE tenant_id=$1 AND talk_id=$2
          LIMIT 1`,
        [input.tenantId, input.talkId],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async finalizeSuccess(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<ReplayRow>(
          `SELECT ${columns}
             FROM talks.replays
            WHERE tenant_id=$1 AND talk_id=$2
            FOR UPDATE`,
          [input.tenantId, input.talkId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("talks.replay_not_found");
        const current = mapRow(row);
        if (current.session.recordingState !== "recording") return current;

        const segment = transitionTalkReplaySession(
          current.session,
          {
            type: "segment_finalized",
            expectedRevision: current.session.revision,
            segmentId: `egress_${current.egressId ?? current.recordingId}` as TalkRecordingSegmentId,
            startedAt: toInstant(input.startedAt),
            endedAt: toInstant(input.endedAt),
            mediaRef: current.objectKey,
            checksumSha256: input.checksumSha256,
          },
          toInstant(input.now),
        ).session;
        const finalized = transitionTalkReplaySession(
          segment,
          {
            type: "live_finalized",
            expectedRevision: segment.revision,
            reason: await endReason(client, input.tenantId, input.talkId),
          },
          toInstant(input.now),
        ).session;

        const updated = await client.query<ReplayRow>(
          `UPDATE talks.replays
              SET session_json=$3::jsonb,
                  provider_status='complete',
                  provider_error=NULL,
                  updated_at=$4
            WHERE tenant_id=$1 AND talk_id=$2
            RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            canonicalJson(finalized),
            input.now,
          ],
        );

        if (isReplayPubliclyVisible(finalized)) {
          await client.query(
            `INSERT INTO talks.activity(
               tenant_id,activity_id,user_id,kind,title,detail,created_at,
               talk_id,profile_public_id,persona_id,transaction_id,amount_label,
               requires_action,action_label,unread
             ) VALUES($1,$2,$3,'replay_milestone','Replay ready',
                      'Your Talk replay is ready to listen to.',$4,$5,
                      NULL,NULL,NULL,NULL,false,NULL,true)
             ON CONFLICT(tenant_id,activity_id) DO NOTHING`,
            [
              input.tenantId,
              `replay:${input.talkId}:ready`,
              current.hostUserId,
              input.now,
              input.talkId,
            ],
          );
        }
        return mapRow(updated.rows[0]!);
      });
    },

    async finalizeFailure(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<ReplayRow>(
          `SELECT ${columns}
             FROM talks.replays
            WHERE tenant_id=$1 AND talk_id=$2
            FOR UPDATE`,
          [input.tenantId, input.talkId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("talks.replay_not_found");
        const current = mapRow(row);
        let session = current.session;
        if (session.recordingState === "recording") {
          session = transitionTalkReplaySession(
            session,
            {
              type: "live_finalized",
              expectedRevision: session.revision,
              reason: await endReason(client, input.tenantId, input.talkId),
            },
            toInstant(input.now),
          ).session;
          session = transitionTalkReplaySession(
            session,
            {
              type: "platform_block",
              expectedRevision: session.revision,
            },
            toInstant(input.now),
          ).session;
        }
        const updated = await client.query<ReplayRow>(
          `UPDATE talks.replays
              SET session_json=$3::jsonb,
                  provider_status=$4,
                  provider_error=$5,
                  updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2
            RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            canonicalJson(session),
            input.providerStatus,
            input.providerError?.slice(0, 500) ?? "Replay recording failed",
            input.now,
          ],
        );
        return mapRow(updated.rows[0]!);
      });
    },

    async setPublished(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<ReplayRow>(
          `SELECT ${columns}
             FROM talks.replays
            WHERE tenant_id=$1 AND talk_id=$2
            FOR UPDATE`,
          [input.tenantId, input.talkId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("talks.replay_not_found");
        const current = mapRow(row);
        if (current.hostUserId !== input.hostUserId) {
          throw new Error("talks.host_forbidden");
        }

        if (
          input.published ===
          isReplayPubliclyVisible(current.session)
        ) {
          return current;
        }

        const command = input.published
          ? {
              type: "publish" as const,
              expectedRevision: current.session.revision,
              requesterUserId: parseCanonicalId("user", input.hostUserId),
            }
          : {
              type: "unpublish" as const,
              expectedRevision: current.session.revision,
              requesterUserId: parseCanonicalId("user", input.hostUserId),
            };
        const transitioned = transitionTalkReplaySession(
          current.session,
          command,
          toInstant(input.now),
        ).session;
        const updated = await client.query<ReplayRow>(
          `UPDATE talks.replays
              SET session_json=$3::jsonb,updated_at=$4
            WHERE tenant_id=$1 AND talk_id=$2
            RETURNING ${columns}`,
          [
            input.tenantId,
            input.talkId,
            canonicalJson(transitioned),
            input.now,
          ],
        );
        return mapRow(updated.rows[0]!);
      });
    },
  });
}

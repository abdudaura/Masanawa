import {
  assertTalkReplaySession,
  createTalkReplaySession,
  isReplayPubliclyVisible,
  launchTalkReplayPolicy,
  transitionTalkReplaySession,
  type TalkReplaySession,
  type TalkRecordingId,
  type TalkRecordingSegmentId,
} from "@masanawa/agents";
import { toInstant, type TenantId, type UserId } from "@masanawa/contracts";
import type { TalkDiscoveryItem } from "../talks/model.js";
import type {
  MyTalksView,
  TalkReplayHostView,
  TalkReplayRepository,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkReplaySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string, unknown> {
  tenant_id: string;
  talk_id: string;
  host_user_id: string;
  host_name: string;
  title: string;
  topic: string;
  summary: string;
  state: "draft" | "live" | "reconnecting" | "ended";
  listener_count: number;
  duration_seconds: number | null;
  created_at: string | Date;
  updated_at: string | Date;
  comment_count: number | string;
}

interface ReplayRow extends Record<string, unknown> {
  session_json: unknown;
}

function view(session:TalkReplaySession):TalkReplayHostView {
  const durationMs=session.segments.reduce((sum,segment)=>sum+segment.durationMs,0);
  return Object.freeze({
    talkId:session.talkId,
    recordingId:session.recordingId,
    recordingState:session.recordingState,
    publicationState:session.publicationState,
    publicationPreference:session.publicationPreference,
    segmentCount:session.segments.length,
    durationSeconds:Math.round(durationMs/1000),
    revision:session.revision,
    isPublic:isReplayPubliclyVisible(session),
    startedAt:session.startedAt,
    ...(session.finalizedAt===null?{}:{finalizedAt:session.finalizedAt}),
    ...(session.publishedAt===null?{}:{publishedAt:session.publishedAt}),
  });
}

function discovery(row:TalkRow):TalkDiscoveryItem {
  return Object.freeze({
    id:row.talk_id,
    title:row.title,
    summary:row.summary,
    hostName:row.host_name,
    topic:row.topic,
    heroImageUrl:null,
    hostAvatarUrl:null,
    isLive:row.state==="live",
    listenerCount:Number(row.listener_count),
    commentCount:Number(row.comment_count ?? 0),
    durationSeconds:row.duration_seconds===null?null:Number(row.duration_seconds),
    viewerIsHost:true,
    participants:Object.freeze([
      Object.freeze({
        id:row.host_user_id,
        name:row.host_name,
        kind:"human" as const,
        avatarUrl:null,
        isHost:true,
      }),
    ]),
  });
}

async function talk(
  pool:TalkReplaySqlPool,
  tenantId:string,
  talkId:string,
):Promise<TalkRow|null>{
  const result=await pool.query<TalkRow>(
    `SELECT t.tenant_id,t.talk_id,t.host_user_id,t.host_name,t.title,t.topic,t.summary,
            t.state,t.listener_count,t.duration_seconds,t.created_at,t.updated_at,
            (SELECT count(*)::int FROM talks.comments c
              WHERE c.tenant_id=t.tenant_id AND c.talk_id=t.talk_id) AS comment_count
       FROM talks.talks t
      WHERE t.tenant_id=$1 AND t.talk_id=$2
      LIMIT 1`,
    [tenantId,talkId],
  );
  return result.rows[0]??null;
}

async function session(
  pool:TalkReplaySqlPool,
  tenantId:string,
  talkId:string,
):Promise<TalkReplaySession|null>{
  const result=await pool.query<ReplayRow>(
    `SELECT session_json FROM talks.replay_sessions
      WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
    [tenantId,talkId],
  );
  const raw=result.rows[0]?.session_json;
  if(!raw) return null;
  const value=raw as TalkReplaySession;
  assertTalkReplaySession(value);
  return value;
}

async function persistTransition(
  pool:TalkReplaySqlPool,
  previous:TalkReplaySession,
  next:TalkReplaySession,
  now:string,
):Promise<void>{
  const result=await pool.query(
    `UPDATE talks.replay_sessions
        SET revision=$4,
            recording_state=$5,
            publication_state=$6,
            publication_preference=$7,
            session_json=$8::jsonb,
            updated_at=$9,
            finalized_at=$10,
            published_at=$11
      WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3`,
    [
      previous.tenantId,
      previous.talkId,
      previous.revision,
      next.revision,
      next.recordingState,
      next.publicationState,
      next.publicationPreference,
      JSON.stringify(next),
      now,
      next.finalizedAt,
      next.publishedAt,
    ],
  );
  if((result.rowCount??0)!==1) throw new Error("Talk replay revision conflict");
}

export function createPostgresTalkReplayRepository(
  pool:TalkReplaySqlPool,
):TalkReplayRepository{
  return Object.freeze<TalkReplayRepository>({
    async start(input){
      const talkRow=await talk(pool,input.tenantId,input.talkId);
      if(!talkRow) return null;
      if(talkRow.host_user_id!==input.hostUserId) throw new Error("talks.host_forbidden");

      const existing=await session(pool,input.tenantId,input.talkId);
      if(existing&&existing.recordingState!=="discarded") return view(existing);
      if(existing?.recordingState==="discarded"){
        await pool.query(
          `DELETE FROM talks.replay_media_jobs
            WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3`,
          [input.tenantId,input.talkId,existing.recordingId],
        );
        await pool.query(
          `DELETE FROM talks.replay_sessions
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3`,
          [input.tenantId,input.talkId,existing.revision],
        );
      }

      const created=createTalkReplaySession({
        tenantId:input.tenantId as TenantId,
        talkId:input.talkId as never,
        recordingId:input.recordingId as TalkRecordingId,
        hostUserId:input.hostUserId as UserId,
        hostRecordingConsent:input.hostRecordingConsent,
        publicationPreference:input.publicationPreference,
        startedAt:toInstant(input.now),
      },launchTalkReplayPolicy);

      await pool.query(
        `INSERT INTO talks.replay_sessions(
          tenant_id,talk_id,recording_id,host_user_id,revision,
          recording_state,publication_state,publication_preference,
          session_json,started_at,updated_at,finalized_at,published_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10,NULL,NULL)
        ON CONFLICT(tenant_id,talk_id) DO NOTHING`,
        [
          input.tenantId,input.talkId,input.recordingId,input.hostUserId,created.revision,
          created.recordingState,created.publicationState,created.publicationPreference,
          JSON.stringify(created),input.now,
        ],
      );
      return view((await session(pool,input.tenantId,input.talkId))!);
    },

    async hostView(input){
      const talkRow=await talk(pool,input.tenantId,input.talkId);
      if(!talkRow) return null;
      if(talkRow.host_user_id!==input.hostUserId) throw new Error("talks.host_forbidden");
      const current=await session(pool,input.tenantId,input.talkId);
      return current?view(current):null;
    },

    async hostAction(input){
      const talkRow=await talk(pool,input.tenantId,input.talkId);
      if(!talkRow) return null;
      if(talkRow.host_user_id!==input.hostUserId) throw new Error("talks.host_forbidden");
      const current=await session(pool,input.tenantId,input.talkId);
      if(!current) return null;
      if(input.action==="discard"&&current.recordingState==="discarded") return view(current);
      const command=
        input.action==="publish"
          ? {type:"publish" as const,expectedRevision:current.revision,requesterUserId:input.hostUserId as UserId}
          : input.action==="unpublish"
            ? {type:"unpublish" as const,expectedRevision:current.revision,requesterUserId:input.hostUserId as UserId}
            : {type:"discard" as const,expectedRevision:current.revision,requesterUserId:input.hostUserId as UserId};
      const transitioned=transitionTalkReplaySession(current,command,toInstant(input.now),launchTalkReplayPolicy);
      if(transitioned.session.recordingState==="discarded"){
        const applied=await pool.query<{ applied:boolean }>(
          `WITH replay AS (
             UPDATE talks.replay_sessions
                SET revision=$4,
                    recording_state=$5,
                    publication_state=$6,
                    publication_preference=$7,
                    session_json=$8::jsonb,
                    updated_at=$9,
                    finalized_at=$10,
                    published_at=$11
              WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
              RETURNING 1
           ), segments AS (
             DELETE FROM talks.replay_segments
              WHERE tenant_id=$1 AND talk_id=$2
                AND EXISTS(SELECT 1 FROM replay)
             RETURNING 1
           )
           SELECT EXISTS(SELECT 1 FROM replay) AS applied`,
          [
            input.tenantId,current.talkId,current.revision,transitioned.session.revision,
            transitioned.session.recordingState,transitioned.session.publicationState,
            transitioned.session.publicationPreference,JSON.stringify(transitioned.session),
            input.now,transitioned.session.finalizedAt,transitioned.session.publishedAt,
          ],
        );
        if(!applied.rows[0]?.applied) throw new Error("Talk replay revision conflict");
      }else{
        await persistTransition(pool,current,transitioned.session,input.now);
      }
      return view(transitioned.session);
    },

    async appendSegment(input){
      const current=await session(pool,input.tenantId,input.talkId);
      if(!current) return null;
      if(current.segments.some(segment=>segment.segmentId===input.segmentId)) return view(current);
      const transitioned=transitionTalkReplaySession(
        current,
        {
          type:"segment_finalized",
          expectedRevision:current.revision,
          segmentId:input.segmentId as TalkRecordingSegmentId,
          startedAt:toInstant(input.startedAt),
          endedAt:toInstant(input.endedAt),
          mediaRef:input.mediaRef,
          checksumSha256:input.checksumSha256,
        },
        toInstant(input.now),
        launchTalkReplayPolicy,
      );
      const segment=transitioned.session.segments.at(-1)!;
      const applied=await pool.query<{ applied:boolean }>(
        `WITH replay AS (
           UPDATE talks.replay_sessions
              SET revision=$4,
                  recording_state=$5,
                  publication_state=$6,
                  publication_preference=$7,
                  session_json=$8::jsonb,
                  updated_at=$9,
                  finalized_at=$10,
                  published_at=$11
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
            RETURNING 1
         ), segment AS (
           INSERT INTO talks.replay_segments(
             tenant_id,talk_id,recording_id,segment_id,sequence,
             started_at,ended_at,duration_ms,media_ref,checksum_sha256,created_at
           )
           SELECT $1,$2,$12,$13,$14,$15,$16,$17,$18,$19,$9
             FROM replay
           ON CONFLICT(tenant_id,talk_id,segment_id) DO NOTHING
           RETURNING 1
         )
         SELECT EXISTS(SELECT 1 FROM replay) AND EXISTS(SELECT 1 FROM segment) AS applied`,
        [
          input.tenantId,
          input.talkId,
          current.revision,
          transitioned.session.revision,
          transitioned.session.recordingState,
          transitioned.session.publicationState,
          transitioned.session.publicationPreference,
          JSON.stringify(transitioned.session),
          input.now,
          transitioned.session.finalizedAt,
          transitioned.session.publishedAt,
          current.recordingId,
          input.segmentId,
          segment.sequence,
          segment.startedAt,
          segment.endedAt,
          segment.durationMs,
          segment.mediaRef,
          segment.checksumSha256,
        ],
      );
      if(!applied.rows[0]?.applied){
        const replay=await session(pool,input.tenantId,input.talkId);
        if(replay?.segments.some(item=>item.segmentId===input.segmentId)) return view(replay);
        throw new Error("Talk replay revision conflict");
      }
      return view(transitioned.session);
    },

    async finalizeFromLive(input){
      let current=await session(pool,input.tenantId,input.talkId);
      if(!current) {
        const talkRow=await talk(pool,input.tenantId,input.talkId);
        if(!talkRow) return null;
        const recordingId=`rec_${input.talkId}` as TalkRecordingId;
        const created=createTalkReplaySession({
          tenantId:input.tenantId as TenantId,
          talkId:input.talkId as never,
          recordingId,
          hostUserId:talkRow.host_user_id as UserId,
          hostRecordingConsent:true,
          publicationPreference:"publish",
          startedAt:toInstant(talkRow.created_at ?? input.now),
        },launchTalkReplayPolicy);
        await pool.query(
          `INSERT INTO talks.replay_sessions(
            tenant_id,talk_id,recording_id,host_user_id,revision,
            recording_state,publication_state,publication_preference,
            session_json,started_at,updated_at,finalized_at,published_at
          ) VALUES($1,$2,$3,$4,$5,'recording','published','publish',$6::jsonb,$7,$7,NULL,NULL)
          ON CONFLICT(tenant_id,talk_id) DO NOTHING`,
          [
            input.tenantId,input.talkId,recordingId,talkRow.host_user_id,created.revision,
            JSON.stringify(created),input.now,
          ],
        );
        current=await session(pool,input.tenantId,input.talkId);
        if(!current) return null;
      }
      if(current.recordingState!=="recording") return view(current);
      const transitioned=transitionTalkReplaySession(
        current,
        {type:"live_finalized",expectedRevision:current.revision,reason:input.reason},
        toInstant(input.now),
        launchTalkReplayPolicy,
      );
      const totalMs=transitioned.session.segments.reduce((sum,segment)=>sum+segment.durationMs,0);
      const applied=await pool.query<{ applied:boolean }>(
        `WITH replay AS (
           UPDATE talks.replay_sessions
              SET revision=$4,
                  recording_state=$5,
                  publication_state=$6,
                  publication_preference=$7,
                  session_json=$8::jsonb,
                  updated_at=$9,
                  finalized_at=$10,
                  published_at=$11
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
            RETURNING 1
         ), talk AS (
           UPDATE talks.talks
              SET duration_seconds=$12,
                  updated_at=GREATEST(updated_at,$9::timestamptz)
            WHERE tenant_id=$1 AND talk_id=$2
              AND EXISTS(SELECT 1 FROM replay)
            RETURNING 1
         )
         SELECT EXISTS(SELECT 1 FROM replay) AND EXISTS(SELECT 1 FROM talk) AS applied`,
        [
          input.tenantId,input.talkId,current.revision,transitioned.session.revision,
          transitioned.session.recordingState,transitioned.session.publicationState,
          transitioned.session.publicationPreference,JSON.stringify(transitioned.session),
          input.now,transitioned.session.finalizedAt,transitioned.session.publishedAt,
          Math.round(totalMs/1000),
        ],
      );
      if(!applied.rows[0]?.applied) throw new Error("Talk replay revision conflict");
      return view(transitioned.session);
    },

    async platformBlock(input){
      const current=await session(pool,input.tenantId,input.talkId);
      if(!current) return null;
      if(current.publicationState==="blocked") return view(current);
      const transitioned=transitionTalkReplaySession(
        current,
        {type:"platform_block",expectedRevision:current.revision},
        toInstant(input.now),
        launchTalkReplayPolicy,
      );
      await persistTransition(pool,current,transitioned.session,input.now);
      return view(transitioned.session);
    },

    async myTalks(input){
      const result=await pool.query<TalkRow>(
        `SELECT t.tenant_id,t.talk_id,t.host_user_id,t.host_name,t.title,t.topic,t.summary,
                t.state,t.listener_count,t.duration_seconds,t.created_at,t.updated_at,
                (SELECT count(*)::int FROM talks.comments c
                  WHERE c.tenant_id=t.tenant_id AND c.talk_id=t.talk_id) AS comment_count
           FROM talks.talks t
          WHERE t.tenant_id=$1 AND t.host_user_id=$2
            AND (
              t.state IN ('live','reconnecting')
              OR EXISTS(
                SELECT 1 FROM talks.replay_sessions r
                 WHERE r.tenant_id=t.tenant_id AND r.talk_id=t.talk_id
                   AND r.recording_state='finalized'
              )
            )
          ORDER BY COALESCE(t.started_at,t.created_at) DESC
          LIMIT $3`,
        [input.tenantId,input.hostUserId,input.limit],
      );
      const live:TalkDiscoveryItem[]=[];
      const replays:TalkDiscoveryItem[]=[];
      for(const row of result.rows){
        if(row.state==="live"||row.state==="reconnecting") live.push(discovery(row));
        else replays.push(discovery(row));
      }
      return Object.freeze({
        live:Object.freeze(live),
        replays:Object.freeze(replays),
      });
    },
  });
}

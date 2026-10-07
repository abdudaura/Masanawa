import {
  assertTalkLiveSession,
  createTalkLiveSession,
  launchTalkLivePolicy,
  transitionTalkLiveSession,
  type TalkLiveSession,
  type TalkId,
  type TalkSeatId,
} from "@masanawa/agents";
import { toInstant, type TenantId, type UserId } from "@masanawa/contracts";
import type {
  EndTalkResult,
  HumanInvitationDecision,
  HumanInvitationView,
  HostControlsView,
  HostMutationResult,
  HostParticipantView,
  HostRequestView,
  SelfSeatLeaveResult,
  TalkModerationRepository,
  TalkParticipationView,
  TalkQuestionView,
  TalkReaction,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}
export interface TalkModerationSqlPool {
  query<Row extends Record<string,unknown> = Record<string,unknown>>(
    text:string, values?:unknown[],
  ):Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string,unknown>{
  host_user_id:string;
  host_name:string;
  title:string;
  state:string;
  started_at:string|Date|null;
}
interface InvitationRow extends Record<string,unknown>{
  talk_id:string;
  host_user_id:string;
  invitee_user_id:string;
  invitee_handle:string;
  invitee_display_name:string;
  status:"pending"|"accepted"|"declined"|"left";
  created_at:string|Date;
  updated_at:string|Date;
}
interface PublicProfileRow extends Record<string,unknown>{
  user_id:string;
  handle:string;
  display_name:string;
  avatar_url:string|null;
}
interface ParticipationRow extends Record<string,unknown>{
  hand_status:"idle"|"raised"|"accepted"|"declined";
  reaction:TalkReaction|null;
}
interface QuestionRow extends Record<string,unknown>{
  question_id:string;
  author_name:string;
  body:string;
  status:"pending"|"answered"|"dismissed";
  created_at:string|Date;
  resolved_at:string|Date|null;
}
interface RequestRow extends Record<string,unknown>{
  request_id:string;
  kind:"human_speaker"|"sponsored_expert"|"sponsored_twin";
  requester_user_id:string|null;
  persona_id:string|null;
  display_name:string;
  detail:string|null;
  avatar_url:string|null;
  amount_label:string|null;
  commercial_authorization_id:string|null;
  status:"pending"|"accepted"|"declined"|"withdrawn";
}
interface SeatRow extends Record<string,unknown>{
  participant_id:string;
  kind:"human"|"expert"|"twin";
  user_id:string|null;
  persona_id:string|null;
  profile_handle:string|null;
  display_name:string;
  avatar_url:string|null;
  is_host:boolean;
  is_muted:boolean;
}
interface CanonicalRow extends Record<string,unknown>{
  revision:number;
  session_json:unknown;
}
interface SessionIdentityRow extends Record<string,unknown>{
  user_id:string;
  session_id:string;
}

function invitationView(row:InvitationRow,talk:TalkRow):HumanInvitationView{
  const createdAt=row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
  const updatedAt=row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString();
  return Object.freeze({
    talkId:row.talk_id,
    talkTitle:talk.title,
    hostName:talk.host_name,
    inviteeUserId:row.invitee_user_id,
    inviteeHandle:row.invitee_handle,
    inviteeDisplayName:row.invitee_display_name,
    status:row.status,
    createdAt,
    updatedAt,
  });
}
function participationView(row:ParticipationRow|undefined):TalkParticipationView{
  if(!row) return Object.freeze({handStatus:"idle" as const});
  return Object.freeze({
    handStatus:row.hand_status,
    ...(row.reaction===null?{}:{reaction:row.reaction}),
  });
}
function questionView(row:QuestionRow):TalkQuestionView{
  return Object.freeze({
    questionId:row.question_id,
    authorName:row.author_name,
    body:row.body,
    status:row.status,
    createdAt:row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    ...(row.resolved_at===null?{}:{resolvedAt:row.resolved_at instanceof Date ? row.resolved_at.toISOString() : new Date(row.resolved_at).toISOString()}),
  });
}
function mediaIdentities(rows:readonly SessionIdentityRow[]):readonly string[]{
  return Object.freeze(rows.map(row=>`${row.user_id}:${row.session_id}`));
}
function hostParticipant(talk:TalkRow):HostParticipantView{
  return Object.freeze({
    participantId:`host_${talk.host_user_id}`,
    displayName:talk.host_name,
    kind:"human" as const,
    isHost:true,
    isMuted:false,
    userId:talk.host_user_id,
  });
}
function requestView(row:RequestRow):HostRequestView{
  return Object.freeze({
    requestId:row.request_id,
    kind:row.kind,
    displayName:row.display_name,
    ...(row.detail===null?{}:{detail:row.detail}),
    ...(row.avatar_url===null?{}:{avatarUrl:row.avatar_url}),
    ...(row.amount_label===null?{}:{amountLabel:row.amount_label}),
  });
}
function seatView(row:SeatRow):HostParticipantView{
  return Object.freeze({
    participantId:row.participant_id,
    displayName:row.display_name,
    kind:row.kind,
    isHost:row.is_host,
    isMuted:row.is_muted,
    ...(row.user_id===null?{}:{userId:row.user_id}),
    ...(row.profile_handle===null?{}:{profileHandle:row.profile_handle}),
    ...(row.persona_id===null?{}:{personaId:row.persona_id}),
    ...(row.avatar_url===null?{}:{avatarUrl:row.avatar_url}),
  });
}

async function readTalk(pool:TalkModerationSqlPool,tenantId:string,talkId:string):Promise<TalkRow|null>{
  const result=await pool.query<TalkRow>(
    `SELECT host_user_id,host_name,title,state,started_at
       FROM talks.talks
      WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
    [tenantId,talkId],
  );
  return result.rows[0]??null;
}
function requireHost(talk:TalkRow,hostUserId:string):void{
  if(talk.host_user_id!==hostUserId) throw new Error("talks.host_forbidden");
}
async function requireLiveRuntime(pool:TalkModerationSqlPool,tenantId:string,talkId:string):Promise<void>{
  const result=await pool.query<{state:string}>(
    `SELECT state FROM talks.live_runtime
      WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
    [tenantId,talkId],
  );
  if(result.rows[0]?.state!=="live") throw new Error("talks.not_live");
}

async function controls(
  pool:TalkModerationSqlPool,tenantId:string,talkId:string,talk:TalkRow,
):Promise<HostControlsView>{
  const [requests,seats]=await Promise.all([
    pool.query<RequestRow>(
      `SELECT request_id,kind,requester_user_id,persona_id,display_name,detail,
              avatar_url,amount_label,commercial_authorization_id,status
         FROM talks.host_requests
        WHERE tenant_id=$1 AND talk_id=$2 AND status='pending'
        ORDER BY created_at ASC,request_id ASC`,
      [tenantId,talkId],
    ),
    pool.query<SeatRow>(
      `SELECT s.participant_id,s.kind,s.user_id,s.persona_id,p.handle AS profile_handle,
              s.display_name,s.avatar_url,s.is_host,s.is_muted
         FROM talks.talk_seats s
         LEFT JOIN talks.public_profiles p
           ON p.tenant_id=s.tenant_id AND p.user_id=s.user_id
        WHERE s.tenant_id=$1 AND s.talk_id=$2 AND s.active=true
        ORDER BY s.admitted_at ASC,s.participant_id ASC`,
      [tenantId,talkId],
    ),
  ]);
  return Object.freeze({
    requests:Object.freeze(requests.rows.map(requestView)),
    participants:Object.freeze([hostParticipant(talk),...seats.rows.map(seatView)]),
  });
}

async function canonical(
  pool:TalkModerationSqlPool,tenantId:string,talkId:string,talk:TalkRow,now:string,
):Promise<TalkLiveSession>{
  const existing=await pool.query<CanonicalRow>(
    `SELECT revision,session_json FROM talks.live_canonical
      WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
    [tenantId,talkId],
  );
  if(existing.rows[0]){
    const session=existing.rows[0].session_json as TalkLiveSession;
    assertTalkLiveSession(session);
    return session;
  }
  const started=toInstant(
    talk.started_at===null ? now :
    talk.started_at instanceof Date ? talk.started_at.toISOString() :
    new Date(talk.started_at).toISOString(),
  );
  const session=createTalkLiveSession({
    tenantId:tenantId as TenantId,
    talkId:talkId as TalkId,
    hostUserId:talk.host_user_id as UserId,
    hostSeatId:`host_${talk.host_user_id}` as TalkSeatId,
    startedAt:started,
  });
  await pool.query(
    `INSERT INTO talks.live_canonical(tenant_id,talk_id,revision,session_json,updated_at)
      VALUES($1,$2,$3,$4::jsonb,$5)
      ON CONFLICT(tenant_id,talk_id) DO NOTHING`,
    [tenantId,talkId,session.revision,JSON.stringify(session),now],
  );
  const reread=await pool.query<CanonicalRow>(
    `SELECT revision,session_json FROM talks.live_canonical
      WHERE tenant_id=$1 AND talk_id=$2 LIMIT 1`,
    [tenantId,talkId],
  );
  const persisted=reread.rows[0]?.session_json as TalkLiveSession|undefined;
  if(!persisted) throw new Error("talks.canonical_missing");
  assertTalkLiveSession(persisted);
  return persisted;
}

export function createPostgresTalkModerationRepository(
  pool:TalkModerationSqlPool,
):TalkModerationRepository{
  return Object.freeze<TalkModerationRepository>({
    async participation(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      const row=await pool.query<ParticipationRow>(
        `SELECT hand_status,reaction FROM talks.participation
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 LIMIT 1`,
        [input.tenantId,input.talkId,input.userId],
      );
      return participationView(row.rows[0]);
    },

    async setReaction(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      const result=await pool.query<ParticipationRow>(
        `INSERT INTO talks.participation(
          tenant_id,talk_id,user_id,display_name,hand_status,reaction,reaction_updated_at,updated_at
        ) VALUES($1,$2,$3,$4,'idle',$5,$6,$6)
        ON CONFLICT(tenant_id,talk_id,user_id) DO UPDATE
          SET display_name=EXCLUDED.display_name,
              reaction=EXCLUDED.reaction,
              reaction_updated_at=EXCLUDED.reaction_updated_at,
              updated_at=EXCLUDED.updated_at
        WHERE talks.participation.reaction=EXCLUDED.reaction
           OR talks.participation.reaction_updated_at IS NULL
           OR talks.participation.reaction_updated_at <= $6::timestamptz - interval '750 milliseconds'
        RETURNING hand_status,reaction`,
        [input.tenantId,input.talkId,input.userId,input.displayName,input.reaction,input.now],
      );
      if(!result.rows[0]) throw new Error("talks.reaction_rate_limited");
      return participationView(result.rows[0]);
    },

    async setRaised(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      if(talk.host_user_id===input.userId) throw new Error("talks.host_cannot_raise_hand");
      if(talk.state==="ended") throw new Error("talks.not_live");
      if(input.raised){
        const blocked=await pool.query<{blocked:boolean}>(
          `SELECT blocked FROM talks.safety_preferences
            WHERE tenant_id=$1
              AND viewer_user_id=$2
              AND subject_user_id=$3
              AND blocked=true
            LIMIT 1`,
          [input.tenantId,talk.host_user_id,input.userId],
        );
        if(blocked.rows[0]?.blocked===true) throw new Error("talks.blocked_by_host");
      }
      await requireLiveRuntime(pool,input.tenantId,input.talkId);

      const current=await pool.query<ParticipationRow>(
        `SELECT hand_status,reaction FROM talks.participation
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 LIMIT 1`,
        [input.tenantId,input.talkId,input.userId],
      );
      if(current.rows[0]?.hand_status==="accepted") return participationView(current.rows[0]);

      const desired=input.raised ? "raised" : "idle";
      const result=await pool.query<ParticipationRow>(
        `INSERT INTO talks.participation(
          tenant_id,talk_id,user_id,display_name,hand_status,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(tenant_id,talk_id,user_id) DO UPDATE
          SET display_name=EXCLUDED.display_name,
              hand_status=EXCLUDED.hand_status,
              updated_at=EXCLUDED.updated_at
        RETURNING hand_status,reaction`,
        [input.tenantId,input.talkId,input.userId,input.displayName,desired,input.now],
      );
      const requestId=`hand_${input.userId}`;
      if(input.raised){
        await pool.query(
          `INSERT INTO talks.host_requests(
            tenant_id,talk_id,request_id,kind,requester_user_id,display_name,status,created_at,updated_at
          ) VALUES($1,$2,$3,'human_speaker',$4,$5,'pending',$6,$6)
          ON CONFLICT(tenant_id,talk_id,request_id) DO UPDATE
            SET display_name=EXCLUDED.display_name,status='pending',updated_at=EXCLUDED.updated_at
          WHERE talks.host_requests.status<>'accepted'`,
          [input.tenantId,input.talkId,requestId,input.userId,input.displayName,input.now],
        );
      }else{
        await pool.query(
          `UPDATE talks.host_requests SET status='withdrawn',updated_at=$4
            WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3 AND status='pending'`,
          [input.tenantId,input.talkId,requestId,input.now],
        );
      }
      return participationView(result.rows[0]);
    },

    async leaveHumanSeat(input): Promise<SelfSeatLeaveResult | null> {
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      if(talk.host_user_id===input.userId) throw new Error("talks.host_immutable");
      if(talk.state==="ended") throw new Error("talks.not_live");
      await requireLiveRuntime(pool,input.tenantId,input.talkId);

      const seatResult=await pool.query<SeatRow>(
        `SELECT s.participant_id,s.kind,s.user_id,s.persona_id,p.handle AS profile_handle,
                s.display_name,s.avatar_url,s.is_host,s.is_muted
           FROM talks.talk_seats s
           LEFT JOIN talks.public_profiles p
             ON p.tenant_id=s.tenant_id AND p.user_id=s.user_id
          WHERE s.tenant_id=$1
            AND s.talk_id=$2
            AND s.user_id=$3
            AND s.kind='human'
            AND s.is_host=false
            AND s.active=true
          LIMIT 1`,
        [input.tenantId,input.talkId,input.userId],
      );
      const seat=seatResult.rows[0];
      if(!seat) throw new Error("talks.not_speaker");

      const session=await canonical(pool,input.tenantId,input.talkId,talk,input.now);
      const transitioned=transitionTalkLiveSession(
        session,
        {
          type:"seat_removed",
          expectedRevision:session.revision,
          seatId:seat.participant_id as TalkSeatId,
        },
        toInstant(input.now),
        launchTalkLivePolicy,
      );

      const result=await pool.query<SessionIdentityRow & {applied:boolean}>(
        `WITH eligible AS (
           SELECT participant_id
             FROM talks.talk_seats
            WHERE tenant_id=$1
              AND talk_id=$2
              AND participant_id=$7
              AND user_id=$8
              AND kind='human'
              AND is_host=false
              AND active=true
            LIMIT 1
         ), canonical AS (
           UPDATE talks.live_canonical
              SET revision=$4,session_json=$5::jsonb,updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
              AND EXISTS(SELECT 1 FROM eligible)
            RETURNING 1
         ), removed AS (
           UPDATE talks.talk_seats
              SET active=false,removed_at=$6,is_muted=false
            WHERE tenant_id=$1
              AND talk_id=$2
              AND participant_id=(SELECT participant_id FROM eligible LIMIT 1)
              AND EXISTS(SELECT 1 FROM canonical)
            RETURNING user_id
         ), sessions AS (
           UPDATE talks.live_sessions
              SET role='listener',is_muted=false
            WHERE tenant_id=$1
              AND talk_id=$2
              AND user_id=$8
              AND connection_state='connected'
              AND EXISTS(SELECT 1 FROM removed)
            RETURNING user_id,session_id
         ), participation AS (
           UPDATE talks.participation
              SET hand_status='idle',updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$8
              AND EXISTS(SELECT 1 FROM removed)
            RETURNING 1
         ), hand_request AS (
           UPDATE talks.host_requests
              SET status='withdrawn',updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2
              AND requester_user_id=$8
              AND kind='human_speaker'
              AND status='accepted'
              AND EXISTS(SELECT 1 FROM removed)
            RETURNING 1
         ), invitation AS (
           UPDATE talks.human_invitations
              SET status='left',updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2
              AND invitee_user_id=$8
              AND status='accepted'
              AND EXISTS(SELECT 1 FROM removed)
            RETURNING 1
         )
         SELECT true AS applied,user_id,session_id FROM sessions
         UNION ALL
         SELECT true AS applied,'' AS user_id,'' AS session_id
          WHERE EXISTS(SELECT 1 FROM canonical)
            AND EXISTS(SELECT 1 FROM removed)
            AND NOT EXISTS(SELECT 1 FROM sessions)`,
        [
          input.tenantId,input.talkId,session.revision,transitioned.session.revision,
          JSON.stringify(transitioned.session),input.now,seat.participant_id,input.userId,
        ],
      );
      if(!result.rows[0]?.applied) throw new Error("Talk live revision conflict");

      const participation=await pool.query<ParticipationRow>(
        `SELECT hand_status,reaction
           FROM talks.participation
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3
          LIMIT 1`,
        [input.tenantId,input.talkId,input.userId],
      );
      const identities=mediaIdentities(
        result.rows.filter(row=>row.user_id&&row.session_id),
      );
      return Object.freeze({
        participation:participationView(participation.rows[0]),
        mediaActions:Object.freeze(
          identities.map(identity=>
            Object.freeze({type:"publish" as const,identity,canPublish:false}),
          ),
        ),
      });
    },

    async submitQuestion(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      if(talk.host_user_id===input.userId) throw new Error("talks.host_cannot_question");
      if(talk.state==="ended") throw new Error("talks.not_live");
      await requireLiveRuntime(pool,input.tenantId,input.talkId);
      const result=await pool.query<QuestionRow>(
        `INSERT INTO talks.questions(
           tenant_id,talk_id,question_id,author_user_id,author_name,body,status,created_at
         )
         SELECT $1,$2,$3,$4,$5,$6,'pending',$7
          WHERE (
            SELECT count(*) FROM talks.questions
             WHERE tenant_id=$1 AND talk_id=$2 AND author_user_id=$4 AND status='pending'
          ) < 3
         RETURNING question_id,author_name,body,status,created_at,resolved_at`,
        [input.tenantId,input.talkId,input.questionId,input.userId,input.displayName,input.body,input.now],
      );
      if(!result.rows[0]) throw new Error("talks.question_rate_limited");
      return questionView(result.rows[0]);
    },

    async listQuestions(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      const result=await pool.query<QuestionRow>(
        `SELECT question_id,author_name,body,status,created_at,resolved_at
           FROM talks.questions
          WHERE tenant_id=$1 AND talk_id=$2 AND status='pending'
          ORDER BY created_at ASC,question_id ASC
          LIMIT 100`,
        [input.tenantId,input.talkId],
      );
      return Object.freeze(result.rows.map(questionView));
    },

    async resolveQuestion(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      const updated=await pool.query<QuestionRow>(
        `UPDATE talks.questions
            SET status=$4,resolved_at=$5
          WHERE tenant_id=$1 AND talk_id=$2 AND question_id=$3 AND status='pending'
          RETURNING question_id,author_name,body,status,created_at,resolved_at`,
        [input.tenantId,input.talkId,input.questionId,input.action,input.now],
      );
      if(!updated.rows[0]) throw new Error("talks.question_not_found");
      const remaining=await pool.query<QuestionRow>(
        `SELECT question_id,author_name,body,status,created_at,resolved_at
           FROM talks.questions
          WHERE tenant_id=$1 AND talk_id=$2 AND status='pending'
          ORDER BY created_at ASC,question_id ASC
          LIMIT 100`,
        [input.tenantId,input.talkId],
      );
      return Object.freeze(remaining.rows.map(questionView));
    },

    async hostControls(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      return controls(pool,input.tenantId,input.talkId,talk);
    },

    async inviteHuman(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      if(talk.state==="ended") throw new Error("talks.not_live");
      await requireLiveRuntime(pool,input.tenantId,input.talkId);

      const profileResult=await pool.query<PublicProfileRow>(
        `SELECT user_id,handle,display_name,avatar_url
           FROM talks.public_profiles
          WHERE tenant_id=$1 AND handle=$2
          LIMIT 1`,
        [input.tenantId,input.handle],
      );
      const profile=profileResult.rows[0];
      if(!profile) throw new Error("profiles.not_found");
      if(profile.user_id===talk.host_user_id) throw new Error("talks.cannot_invite_self");

      const relationshipBlock=await pool.query<{blocked:boolean}>(
        `SELECT true AS blocked
           FROM talks.safety_preferences
          WHERE tenant_id=$1
            AND (
              (viewer_user_id=$2 AND subject_user_id=$3 AND blocked=true)
              OR
              (viewer_user_id=$3 AND subject_user_id=$2 AND (blocked=true OR muted=true))
            )
          LIMIT 1`,
        [input.tenantId,talk.host_user_id,profile.user_id],
      );
      if(relationshipBlock.rows[0]?.blocked===true){
        throw new Error("talks.invitee_unavailable");
      }

      const active=await pool.query<{participant_id:string}>(
        `SELECT participant_id FROM talks.talk_seats
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 AND active=true
          LIMIT 1`,
        [input.tenantId,input.talkId,profile.user_id],
      );
      if(active.rows[0]) throw new Error("talks.already_participant");

      const result=await pool.query<InvitationRow>(
        `INSERT INTO talks.human_invitations(
           tenant_id,talk_id,host_user_id,invitee_user_id,invitee_handle,
           invitee_display_name,status,created_at,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$7)
         ON CONFLICT(tenant_id,talk_id,invitee_user_id) DO UPDATE
           SET host_user_id=EXCLUDED.host_user_id,
               invitee_handle=EXCLUDED.invitee_handle,
               invitee_display_name=EXCLUDED.invitee_display_name,
               status='pending',
               updated_at=EXCLUDED.updated_at
         WHERE talks.human_invitations.status<>'accepted'
         RETURNING talk_id,host_user_id,invitee_user_id,invitee_handle,
                   invitee_display_name,status,created_at,updated_at`,
        [
          input.tenantId,input.talkId,talk.host_user_id,profile.user_id,
          profile.handle,profile.display_name,input.now,
        ],
      );
      const invitation=result.rows[0];
      if(!invitation) throw new Error("talks.already_participant");
      return invitationView(invitation,talk);
    },

    async respondHumanInvitation(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      const invitationResult=await pool.query<InvitationRow>(
        `SELECT talk_id,host_user_id,invitee_user_id,invitee_handle,
                invitee_display_name,status,created_at,updated_at
           FROM talks.human_invitations
          WHERE tenant_id=$1 AND talk_id=$2 AND invitee_user_id=$3
          LIMIT 1`,
        [input.tenantId,input.talkId,input.inviteeUserId],
      );
      const invitation=invitationResult.rows[0];
      if(!invitation) throw new Error("talks.invitation_not_found");
      if(invitation.host_user_id!==talk.host_user_id) throw new Error("talks.invitation_invalid");

      if(input.action==="decline"){
        if(invitation.status==="accepted") throw new Error("talks.invitation_resolved");
        if(invitation.status==="pending"){
          const updated=await pool.query<InvitationRow>(
            `UPDATE talks.human_invitations
                SET status='declined',updated_at=$4
              WHERE tenant_id=$1 AND talk_id=$2 AND invitee_user_id=$3
                AND status='pending'
              RETURNING talk_id,host_user_id,invitee_user_id,invitee_handle,
                        invitee_display_name,status,created_at,updated_at`,
            [input.tenantId,input.talkId,input.inviteeUserId,input.now],
          );
          if(updated.rows[0]){
            return Object.freeze({
              invitation:invitationView(updated.rows[0],talk),
              mediaActions:Object.freeze([]),
            });
          }
        }
        return Object.freeze({
          invitation:invitationView(invitation,talk),
          mediaActions:Object.freeze([]),
        });
      }

      if(invitation.status==="declined") throw new Error("talks.invitation_resolved");
      if(talk.state==="ended") throw new Error("talks.not_live");
      const relationshipBlock=await pool.query<{blocked:boolean}>(
        `SELECT true AS blocked
           FROM talks.safety_preferences
          WHERE tenant_id=$1
            AND (
              (viewer_user_id=$2 AND subject_user_id=$3 AND blocked=true)
              OR
              (viewer_user_id=$3 AND subject_user_id=$2 AND (blocked=true OR muted=true))
            )
          LIMIT 1`,
        [input.tenantId,talk.host_user_id,input.inviteeUserId],
      );
      if(relationshipBlock.rows[0]?.blocked===true){
        throw new Error("talks.invitee_unavailable");
      }
      await requireLiveRuntime(pool,input.tenantId,input.talkId);

      const participantId=`invite_${input.inviteeUserId}`;
      if(invitation.status!=="accepted"){
        const session=await canonical(pool,input.tenantId,input.talkId,talk,input.now);
        const transitioned=transitionTalkLiveSession(
          session,
          {
            type:"human_seat_admitted",
            expectedRevision:session.revision,
            seatId:participantId as TalkSeatId,
            userId:input.inviteeUserId as UserId,
          },
          toInstant(input.now),
          launchTalkLivePolicy,
        );
        const applied=await pool.query<{applied:boolean}>(
          `WITH canonical AS (
             UPDATE talks.live_canonical
                SET revision=$4,session_json=$5::jsonb,updated_at=$6
              WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
              RETURNING 1
           ), seat AS (
             INSERT INTO talks.talk_seats(
               tenant_id,talk_id,participant_id,kind,user_id,display_name,
               avatar_url,is_host,is_muted,active,admitted_at
             )
             SELECT $1,$2,$7,'human',$8,$9,NULL,false,false,true,$6 FROM canonical
             ON CONFLICT(tenant_id,talk_id,participant_id) DO UPDATE
               SET active=true,is_muted=false,removed_at=NULL,display_name=EXCLUDED.display_name
             RETURNING 1
           ), invitation AS (
             UPDATE talks.human_invitations
                SET status='accepted',updated_at=$6
              WHERE tenant_id=$1 AND talk_id=$2 AND invitee_user_id=$8
                AND status='pending' AND EXISTS(SELECT 1 FROM canonical)
             RETURNING 1
           ), participation AS (
             INSERT INTO talks.participation(
               tenant_id,talk_id,user_id,display_name,hand_status,updated_at
             )
             SELECT $1,$2,$8,$9,'accepted',$6 FROM canonical
             ON CONFLICT(tenant_id,talk_id,user_id) DO UPDATE
               SET display_name=EXCLUDED.display_name,
                   hand_status='accepted',
                   updated_at=EXCLUDED.updated_at
             RETURNING 1
           )
           SELECT EXISTS(SELECT 1 FROM canonical) AS applied`,
          [
            input.tenantId,input.talkId,session.revision,transitioned.session.revision,
            JSON.stringify(transitioned.session),input.now,participantId,
            input.inviteeUserId,invitation.invitee_display_name,
          ],
        );
        if(!applied.rows[0]?.applied) throw new Error("Talk live revision conflict");
      }

      const sessions=await pool.query<SessionIdentityRow>(
        `UPDATE talks.live_sessions
            SET role='speaker',is_muted=false
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3
            AND connection_state='connected'
          RETURNING user_id,session_id`,
        [input.tenantId,input.talkId,input.inviteeUserId],
      );
      const refreshed=await pool.query<InvitationRow>(
        `SELECT talk_id,host_user_id,invitee_user_id,invitee_handle,
                invitee_display_name,status,created_at,updated_at
           FROM talks.human_invitations
          WHERE tenant_id=$1 AND talk_id=$2 AND invitee_user_id=$3
          LIMIT 1`,
        [input.tenantId,input.talkId,input.inviteeUserId],
      );
      const accepted=refreshed.rows[0];
      if(!accepted) throw new Error("talks.invitation_not_found");
      return Object.freeze({
        invitation:invitationView(accepted,talk),
        mediaActions:Object.freeze(mediaIdentities(sessions.rows).map(identity=>
          Object.freeze({type:"publish" as const,identity,canPublish:true}),
        )),
      });
    },

    async actOnRequest(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      const req=await pool.query<RequestRow>(
        `SELECT request_id,kind,requester_user_id,persona_id,display_name,detail,
                avatar_url,amount_label,commercial_authorization_id,status
           FROM talks.host_requests
          WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3 LIMIT 1`,
        [input.tenantId,input.talkId,input.requestId],
      );
      const request=req.rows[0];
      if(!request) throw new Error("talks.request_not_found");

      if(input.action==="decline"){
        if(request.status==="pending"){
          await pool.query(
            `UPDATE talks.host_requests SET status='declined',updated_at=$4
              WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3 AND status='pending'`,
            [input.tenantId,input.talkId,input.requestId,input.now],
          );
          if(request.requester_user_id){
            await pool.query(
              `UPDATE talks.participation SET hand_status='declined',updated_at=$4
                WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 AND hand_status<>'accepted'`,
              [input.tenantId,input.talkId,request.requester_user_id,input.now],
            );
          }
        }
        return Object.freeze({
          controls:await controls(pool,input.tenantId,input.talkId,talk),
          mediaActions:Object.freeze([]),
        });
      }

      if(request.kind!=="human_speaker"){
        throw new Error("talks.ai_commerce_required");
      }
      if(!request.requester_user_id) throw new Error("talks.request_not_found");
      await requireLiveRuntime(pool,input.tenantId,input.talkId);

      const participantId=`seat_${request.request_id}`;
      if(request.status!=="accepted"){
        const session=await canonical(pool,input.tenantId,input.talkId,talk,input.now);
        const transitioned=transitionTalkLiveSession(
          session,
          {
            type:"human_seat_admitted",
            expectedRevision:session.revision,
            seatId:participantId as TalkSeatId,
            userId:request.requester_user_id as UserId,
          },
          toInstant(input.now),
          launchTalkLivePolicy,
        );
        const applied=await pool.query<{applied:boolean}>(
          `WITH canonical AS (
             UPDATE talks.live_canonical
                SET revision=$4,session_json=$5::jsonb,updated_at=$6
              WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
              RETURNING 1
           ), seat AS (
             INSERT INTO talks.talk_seats(
               tenant_id,talk_id,participant_id,kind,user_id,display_name,
               avatar_url,is_host,is_muted,active,admitted_at
             )
             SELECT $1,$2,$7,'human',$8,$9,$10,false,false,true,$6 FROM canonical
             ON CONFLICT(tenant_id,talk_id,participant_id) DO UPDATE
               SET active=true,is_muted=false,removed_at=NULL
             RETURNING 1
           ), req AS (
             UPDATE talks.host_requests SET status='accepted',updated_at=$6
              WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$11
                AND EXISTS(SELECT 1 FROM canonical)
             RETURNING 1
           ), part AS (
             UPDATE talks.participation SET hand_status='accepted',updated_at=$6
              WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$8
                AND EXISTS(SELECT 1 FROM canonical)
             RETURNING 1
           )
           SELECT EXISTS(SELECT 1 FROM canonical) AS applied`,
          [
            input.tenantId,input.talkId,session.revision,transitioned.session.revision,
            JSON.stringify(transitioned.session),input.now,participantId,
            request.requester_user_id,request.display_name,request.avatar_url,input.requestId,
          ],
        );
        if(!applied.rows[0]?.applied) throw new Error("Talk live revision conflict");
      }

      const sessions=await pool.query<SessionIdentityRow>(
        `UPDATE talks.live_sessions
            SET role='speaker',is_muted=false
          WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 AND connection_state='connected'
          RETURNING user_id,session_id`,
        [input.tenantId,input.talkId,request.requester_user_id],
      );
      return Object.freeze({
        controls:await controls(pool,input.tenantId,input.talkId,talk),
        mediaActions:Object.freeze(mediaIdentities(sessions.rows).map(identity=>
          Object.freeze({type:"publish" as const,identity,canPublish:true}),
        )),
      });
    },

    async moderateParticipant(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      if(input.participantId===`host_${talk.host_user_id}`) throw new Error("talks.host_immutable");

      const seatResult=await pool.query<SeatRow>(
        `SELECT participant_id,kind,user_id,persona_id,display_name,avatar_url,is_host,is_muted
           FROM talks.talk_seats
          WHERE tenant_id=$1 AND talk_id=$2 AND participant_id=$3 AND active=true LIMIT 1`,
        [input.tenantId,input.talkId,input.participantId],
      );
      let seat=seatResult.rows[0];
      if(!seat && input.action==="remove"){
        const removed=await pool.query<SeatRow>(
          `SELECT participant_id,kind,user_id,persona_id,display_name,avatar_url,is_host,is_muted
             FROM talks.talk_seats
            WHERE tenant_id=$1 AND talk_id=$2 AND participant_id=$3 AND active=false LIMIT 1`,
          [input.tenantId,input.talkId,input.participantId],
        );
        seat=removed.rows[0];
        if(seat){
          const sessions=seat.user_id ? await pool.query<SessionIdentityRow>(
            `SELECT user_id,session_id FROM talks.live_sessions
              WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3`,
            [input.tenantId,input.talkId,seat.user_id],
          ) : {rows:[],rowCount:0};
          return Object.freeze({
            controls:await controls(pool,input.tenantId,input.talkId,talk),
            mediaActions:Object.freeze(mediaIdentities(sessions.rows).map(identity=>
              Object.freeze({type:"remove" as const,identity}),
            )),
          });
        }
      }
      if(!seat) throw new Error("talks.participant_not_found");
      if(seat.is_host) throw new Error("talks.host_immutable");

      if(input.action==="mute" || input.action==="unmute"){
        const muted=input.action==="mute";
        await pool.query(
          `UPDATE talks.talk_seats SET is_muted=$4
            WHERE tenant_id=$1 AND talk_id=$2 AND participant_id=$3 AND active=true`,
          [input.tenantId,input.talkId,input.participantId,muted],
        );
        const sessions=seat.user_id ? await pool.query<SessionIdentityRow>(
          `UPDATE talks.live_sessions SET is_muted=$4
            WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3 AND connection_state='connected'
            RETURNING user_id,session_id`,
          [input.tenantId,input.talkId,seat.user_id,muted],
        ) : {rows:[],rowCount:0};
        return Object.freeze({
          controls:await controls(pool,input.tenantId,input.talkId,talk),
          mediaActions:Object.freeze(mediaIdentities(sessions.rows).map(identity=>
            Object.freeze({type:"publish" as const,identity,canPublish:!muted}),
          )),
        });
      }

      const session=await canonical(pool,input.tenantId,input.talkId,talk,input.now);
      const transitioned=transitionTalkLiveSession(
        session,
        {type:"seat_removed",expectedRevision:session.revision,seatId:input.participantId as TalkSeatId},
        toInstant(input.now),
        launchTalkLivePolicy,
      );
      const result=await pool.query<SessionIdentityRow & {applied:boolean}>(
        `WITH canonical AS (
           UPDATE talks.live_canonical
              SET revision=$4,session_json=$5::jsonb,updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
            RETURNING 1
         ), removed AS (
           UPDATE talks.talk_seats
              SET active=false,removed_at=$6,is_muted=false
            WHERE tenant_id=$1 AND talk_id=$2 AND participant_id=$7
              AND EXISTS(SELECT 1 FROM canonical)
            RETURNING user_id
         ), sessions AS (
           UPDATE talks.live_sessions
              SET role='listener',is_muted=false
            WHERE tenant_id=$1 AND talk_id=$2
              AND user_id=(SELECT user_id FROM removed LIMIT 1)
              AND connection_state='connected'
            RETURNING user_id,session_id
         )
         SELECT true AS applied,user_id,session_id FROM sessions
         UNION ALL
         SELECT true AS applied,'' AS user_id,'' AS session_id
          WHERE EXISTS(SELECT 1 FROM canonical) AND NOT EXISTS(SELECT 1 FROM sessions)`,
        [
          input.tenantId,input.talkId,session.revision,transitioned.session.revision,
          JSON.stringify(transitioned.session),input.now,input.participantId,
        ],
      );
      if(!result.rows[0]?.applied) throw new Error("Talk live revision conflict");
      if(seat.user_id){
        await pool.query(
          `UPDATE talks.participation SET hand_status='idle',updated_at=$4
            WHERE tenant_id=$1 AND talk_id=$2 AND user_id=$3`,
          [input.tenantId,input.talkId,seat.user_id,input.now],
        );
      }
      const identities=mediaIdentities(result.rows.filter(row=>row.user_id&&row.session_id));
      return Object.freeze({
        controls:await controls(pool,input.tenantId,input.talkId,talk),
        mediaActions:Object.freeze(identities.map(identity=>Object.freeze({type:"remove" as const,identity}))),
      });
    },

    async endTalk(input){
      const talk=await readTalk(pool,input.tenantId,input.talkId);
      if(!talk) return null;
      requireHost(talk,input.hostUserId);
      if(talk.state==="ended"){
        const sessions=await pool.query<SessionIdentityRow>(
          `SELECT user_id,session_id FROM talks.live_sessions
            WHERE tenant_id=$1 AND talk_id=$2`,
          [input.tenantId,input.talkId],
        );
        return Object.freeze({
          mediaActions:Object.freeze(mediaIdentities(sessions.rows).map(identity=>
            Object.freeze({type:"remove" as const,identity}),
          )),
        });
      }

      const session=await canonical(pool,input.tenantId,input.talkId,talk,input.now);
      const ended=session.state==="ended" ? session : transitionTalkLiveSession(
        session,
        {type:"ended",expectedRevision:session.revision,reason:"host_ended"},
        toInstant(input.now),
        launchTalkLivePolicy,
      ).session;
      const result=await pool.query<SessionIdentityRow & {applied:boolean}>(
        `WITH canonical AS (
           UPDATE talks.live_canonical
              SET revision=$4,session_json=$5::jsonb,updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3
            RETURNING 1
         ), talk_end AS (
           UPDATE talks.talks SET state='ended',ended_at=COALESCE(ended_at,$6),updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND EXISTS(SELECT 1 FROM canonical)
            RETURNING 1
         ), runtime AS (
           UPDATE talks.live_runtime SET state='ended',reconnect_grace_ends_at=NULL,updated_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND EXISTS(SELECT 1 FROM canonical)
            RETURNING 1
         ), sessions AS (
           UPDATE talks.live_sessions SET connection_state='disconnected',disconnected_at=$6,last_seen_at=$6
            WHERE tenant_id=$1 AND talk_id=$2 AND connection_state='connected'
              AND EXISTS(SELECT 1 FROM canonical)
            RETURNING user_id,session_id
         )
         SELECT true AS applied,user_id,session_id FROM sessions
         UNION ALL
         SELECT true AS applied,'' AS user_id,'' AS session_id
          WHERE EXISTS(SELECT 1 FROM canonical) AND NOT EXISTS(SELECT 1 FROM sessions)`,
        [
          input.tenantId,input.talkId,session.revision,ended.revision,JSON.stringify(ended),input.now,
        ],
      );
      if(!result.rows[0]?.applied) throw new Error("Talk live revision conflict");
      const identities=mediaIdentities(result.rows.filter(row=>row.user_id&&row.session_id));
      return Object.freeze({
        mediaActions:Object.freeze(identities.map(identity=>Object.freeze({type:"remove" as const,identity}))),
      });
    },
  });
}

import {
  assertTalkReplaySession,
  launchTalkReplayPolicy,
  transitionTalkReplaySession,
  type TalkReplaySession,
} from "@masanawa/agents";
import { toInstant } from "@masanawa/contracts";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkSafetyReplaySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface ReplayRow extends Record<string, unknown> {
  talk_id: string;
  session_json: unknown;
}

function text(value:string,name:string,max=256):string{
  if(typeof value!=="string") throw new TypeError(`${name} is invalid`);
  const normalized=value.trim();
  if(!normalized || normalized.length>max) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function session(row:ReplayRow):TalkReplaySession{
  const value=row.session_json as TalkReplaySession;
  assertTalkReplaySession(value);
  return value;
}

export interface TalkSafetyReplayBridge {
  blockByRecording(input: Readonly<{
    tenantId:string;
    recordingId:string;
    now:string;
  }>):Promise<boolean>;
}

export function createPostgresTalkSafetyReplayBridge(
  pool:TalkSafetyReplaySqlPool,
):TalkSafetyReplayBridge{
  return Object.freeze({
    async blockByRecording(input){
      const tenantId=text(input.tenantId,"tenantId");
      const recordingId=text(input.recordingId,"recordingId");
      const now=toInstant(input.now);

      for(let attempt=0;attempt<3;attempt+=1){
        const result=await pool.query<ReplayRow>(
          `SELECT talk_id,session_json
             FROM talks.replay_sessions
            WHERE tenant_id=$1 AND recording_id=$2
            LIMIT 1`,
          [tenantId,recordingId],
        );
        const row=result.rows[0];
        if(!row) return false;

        const current=session(row);
        if(current.publicationState==="blocked") return true;

        const transitioned=transitionTalkReplaySession(
          current,
          {type:"platform_block",expectedRevision:current.revision},
          now,
          launchTalkReplayPolicy,
        );

        const saved=await pool.query(
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
            tenantId,
            row.talk_id,
            current.revision,
            transitioned.session.revision,
            transitioned.session.recordingState,
            transitioned.session.publicationState,
            transitioned.session.publicationPreference,
            JSON.stringify(transitioned.session),
            input.now,
            transitioned.session.finalizedAt,
            transitioned.session.publishedAt,
          ],
        );
        if((saved.rowCount??0)===1) return true;
      }

      throw new Error("Talk replay revision conflict");
    },
  });
}

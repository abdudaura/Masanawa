export interface ReplayMediaJob {
  readonly tenantId:string;
  readonly talkId:string;
  readonly recordingId:string;
  readonly egressId:string;
  readonly objectKey:string;
  readonly status:"recording"|"stopped"|"ready"|"aborted";
  readonly startedAt:string;
  readonly completedAt:string|null;
  readonly checksumSha256:string|null;
}

interface SqlResult<Row>{
  readonly rows:Row[];
  readonly rowCount:number|null;
}
export interface ReplayMediaSqlPool{
  query<Row extends Record<string,unknown>=Record<string,unknown>>(
    text:string,values?:unknown[],
  ):Promise<SqlResult<Row>>;
}

interface JobRow extends Record<string,unknown>{
  tenant_id:string;
  talk_id:string;
  recording_id:string;
  egress_id:string;
  object_key:string;
  status:"recording"|"stopped"|"ready"|"aborted";
  started_at:string|Date;
  completed_at:string|Date|null;
  checksum_sha256:string|null;
}

function iso(value:string|Date):string{
  return value instanceof Date?value.toISOString():new Date(value).toISOString();
}
function map(row:JobRow):ReplayMediaJob{
  return Object.freeze({
    tenantId:row.tenant_id,
    talkId:row.talk_id,
    recordingId:row.recording_id,
    egressId:row.egress_id,
    objectKey:row.object_key,
    status:row.status,
    startedAt:iso(row.started_at),
    completedAt:row.completed_at===null?null:iso(row.completed_at),
    checksumSha256:row.checksum_sha256,
  });
}

export interface ReplayMediaRepository{
  current(input:Readonly<{tenantId:string;talkId:string;recordingId:string}>):Promise<ReplayMediaJob|null>;
  currentForTalk(input:Readonly<{tenantId:string;talkId:string}>):Promise<ReplayMediaJob|null>;
  createStarted(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;egressId:string;objectKey:string;startedAt:string;
  }>):Promise<ReplayMediaJob>;
  markStopped(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;completedAt:string;
  }>):Promise<void>;
  markReady(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;checksumSha256:string;completedAt:string;
  }>):Promise<void>;
  markAborted(input:Readonly<{
    tenantId:string;talkId:string;recordingId:string;completedAt:string;
  }>):Promise<void>;
  playbackObject(input:Readonly<{
    tenantId:string;talkId:string;viewerUserId:string;
  }>):Promise<Readonly<{objectKey:string}>|null>;
}

const columns=`tenant_id,talk_id,recording_id,egress_id,object_key,status,started_at,completed_at,checksum_sha256`;

export function createPostgresReplayMediaRepository(pool:ReplayMediaSqlPool):ReplayMediaRepository{
  async function current(input:{tenantId:string;talkId:string;recordingId:string}):Promise<ReplayMediaJob|null>{
    const result=await pool.query<JobRow>(
      `SELECT ${columns} FROM talks.replay_media_jobs
        WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3 LIMIT 1`,
      [input.tenantId,input.talkId,input.recordingId],
    );
    return result.rows[0]?map(result.rows[0]):null;
  }

  return Object.freeze<ReplayMediaRepository>({
    current,
    async currentForTalk(input){
      const result=await pool.query<JobRow>(
        `SELECT m.${columns.replaceAll(","," ,m.")}
           FROM talks.replay_media_jobs m
           JOIN talks.replay_sessions r
             ON r.tenant_id=m.tenant_id AND r.talk_id=m.talk_id AND r.recording_id=m.recording_id
          WHERE m.tenant_id=$1 AND m.talk_id=$2
          LIMIT 1`,
        [input.tenantId,input.talkId],
      );
      return result.rows[0]?map(result.rows[0]):null;
    },
    async createStarted(input){
      await pool.query(
        `INSERT INTO talks.replay_media_jobs(
          tenant_id,talk_id,recording_id,egress_id,object_key,status,started_at
        ) VALUES($1,$2,$3,$4,$5,'recording',$6)
        ON CONFLICT(tenant_id,talk_id,recording_id) DO NOTHING`,
        [input.tenantId,input.talkId,input.recordingId,input.egressId,input.objectKey,input.startedAt],
      );
      const created=await current(input);
      if(!created||created.egressId!==input.egressId||created.objectKey!==input.objectKey){
        throw new Error("talks.replay.media_identity_conflict");
      }
      return created;
    },
    async markStopped(input){
      const result=await pool.query(
        `UPDATE talks.replay_media_jobs
            SET status='stopped',completed_at=$4
          WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3
            AND status='recording'`,
        [input.tenantId,input.talkId,input.recordingId,input.completedAt],
      );
      if((result.rowCount??0)!==1) throw new Error("talks.replay.media_stop_conflict");
    },
    async markReady(input){
      const result=await pool.query(
        `UPDATE talks.replay_media_jobs
            SET status='ready',checksum_sha256=$4
          WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3
            AND status='stopped' AND completed_at=$5::timestamptz`,
        [input.tenantId,input.talkId,input.recordingId,input.checksumSha256,input.completedAt],
      );
      // Do not overwrite the original stop time or revive an aborted job.
      // A concurrent Host discard, re-finalization or mismatched timestamp
      // is a conflict, not successful playback/publish readiness.
      if((result.rowCount??0)!==1) throw new Error("talks.replay.media_ready_conflict");
    },
    async markAborted(input){
      const result=await pool.query(
        `UPDATE talks.replay_media_jobs
            SET status='aborted',
                completed_at=CASE WHEN status='aborted' THEN completed_at ELSE $4::timestamptz END
          WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3`,
        [input.tenantId,input.talkId,input.recordingId,input.completedAt],
      );
      // Repeated abort is idempotent; it must preserve the original abort
      // timestamp while allowing object-store cleanup to be retried.
      if((result.rowCount??0)!==1) throw new Error("talks.replay.media_not_found");
    },
    async playbackObject(input){
      const result=await pool.query<{object_key:string}>(
        `SELECT m.object_key
           FROM talks.replay_media_jobs m
           JOIN talks.replay_sessions r
             ON r.tenant_id=m.tenant_id AND r.talk_id=m.talk_id AND r.recording_id=m.recording_id
           JOIN talks.talks t
             ON t.tenant_id=r.tenant_id AND t.talk_id=r.talk_id
          WHERE m.tenant_id=$1 AND m.talk_id=$2
            AND m.status='ready'
            AND r.recording_state='finalized'
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id=m.tenant_id
                 AND (
                   (se.target_kind='talk' AND se.target_id=t.talk_id)
                   OR (se.target_kind='replay' AND se.target_id=r.recording_id)
                 )
                 AND se.visibility IN ('restricted','blocked')
            )
            AND (t.host_user_id=$3 OR r.publication_state='published')
          LIMIT 1`,
        [input.tenantId,input.talkId,input.viewerUserId],
      );
      return result.rows[0]?Object.freeze({objectKey:result.rows[0].object_key}):null;
    },
  });
}


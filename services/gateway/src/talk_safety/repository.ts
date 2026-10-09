import {
  normalizeTalkSafetyEnforcement,
  normalizeTalkSafetyReport,
  normalizeTalkSafetyUserPreference,
  type TalkSafetyEnforcement,
  type TalkSafetyReport,
  type TalkSafetyTargetKind,
  type TalkSafetyUserPreference,
} from "./policy.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkSafetySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

export interface TalkSafetyRepository {
  appendReport(report: TalkSafetyReport): Promise<TalkSafetyReport>;
  resolveProfileUser(input: Readonly<{
    tenantId: string;
    handle: string;
  }>): Promise<string | null>;
  resolveProfileUserById(input: Readonly<{
    tenantId: string;
    userId: string;
  }>): Promise<string | null>;
  readPreference(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    subjectUserId: string;
  }>): Promise<TalkSafetyUserPreference | null>;
  setPreference(preference: TalkSafetyUserPreference): Promise<TalkSafetyUserPreference>;
  readEnforcement(input: Readonly<{
    tenantId: string;
    kind: TalkSafetyTargetKind;
    targetId: string;
  }>): Promise<TalkSafetyEnforcement | null>;
  writeEnforcement(input: Readonly<{
    current: TalkSafetyEnforcement | null;
    next: TalkSafetyEnforcement;
  }>): Promise<TalkSafetyEnforcement>;
}

interface ReportRow extends Record<string,unknown>{
  tenant_id:string; report_id:string; reporter_user_id:string;
  target_kind:TalkSafetyTargetKind; target_id:string; reason:TalkSafetyReport["reason"];
  detail:string|null; client_request_id:string; created_at:string|Date;
}
interface PreferenceRow extends Record<string,unknown>{
  tenant_id:string; viewer_user_id:string; subject_user_id:string;
  blocked:boolean; muted:boolean; updated_at:string|Date;
}
interface EnforcementRow extends Record<string,unknown>{
  tenant_id:string; target_kind:TalkSafetyTargetKind; target_id:string;
  revision:number; visibility:TalkSafetyEnforcement["visibility"];
  reason_code:string|null; updated_at:string|Date;
}

function iso(value:string|Date):string{
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function report(row:ReportRow):TalkSafetyReport{
  return normalizeTalkSafetyReport({
    schemaVersion:1,
    reportId:row.report_id,
    tenantId:row.tenant_id,
    reporterUserId:row.reporter_user_id,
    target:{kind:row.target_kind,id:row.target_id},
    reason:row.reason,
    detail:row.detail,
    clientRequestId:row.client_request_id,
    createdAt:iso(row.created_at),
  });
}
function preference(row:PreferenceRow):TalkSafetyUserPreference{
  return normalizeTalkSafetyUserPreference({
    schemaVersion:1,
    tenantId:row.tenant_id,
    viewerUserId:row.viewer_user_id,
    subjectUserId:row.subject_user_id,
    blocked:row.blocked,
    muted:row.muted,
    updatedAt:iso(row.updated_at),
  });
}
function enforcement(row:EnforcementRow):TalkSafetyEnforcement{
  return normalizeTalkSafetyEnforcement({
    schemaVersion:1,
    tenantId:row.tenant_id,
    target:{kind:row.target_kind,id:row.target_id},
    revision:Number(row.revision),
    visibility:row.visibility,
    reasonCode:row.reason_code,
    updatedAt:iso(row.updated_at),
  });
}

export function createPostgresTalkSafetyRepository(
  pool:TalkSafetySqlPool,
):TalkSafetyRepository{
  return Object.freeze<TalkSafetyRepository>({
    async appendReport(input){
      const normalized=normalizeTalkSafetyReport(input);
      const result=await pool.query<ReportRow>(
        `INSERT INTO talks.safety_reports(
           tenant_id,report_id,reporter_user_id,target_kind,target_id,
           reason,detail,client_request_id,created_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(tenant_id,reporter_user_id,client_request_id) DO UPDATE
           SET report_id=talks.safety_reports.report_id
         RETURNING tenant_id,report_id,reporter_user_id,target_kind,target_id,
                   reason,detail,client_request_id,created_at`,
        [
          normalized.tenantId,normalized.reportId,normalized.reporterUserId,
          normalized.target.kind,normalized.target.id,normalized.reason,
          normalized.detail,normalized.clientRequestId,normalized.createdAt,
        ],
      );
      return report(result.rows[0]!);
    },

    async resolveProfileUser(input){
      const result=await pool.query<{user_id:string}>(
        `SELECT user_id FROM talks.public_profiles
          WHERE tenant_id=$1 AND handle=$2 LIMIT 1`,
        [input.tenantId,input.handle],
      );
      return result.rows[0]?.user_id ?? null;
    },

    async resolveProfileUserById(input){
      const result=await pool.query<{user_id:string}>(
        `SELECT user_id FROM talks.public_profiles
          WHERE tenant_id=$1 AND user_id=$2 LIMIT 1`,
        [input.tenantId,input.userId],
      );
      return result.rows[0]?.user_id ?? null;
    },

    async readPreference(input){
      const result=await pool.query<PreferenceRow>(
        `SELECT tenant_id,viewer_user_id,subject_user_id,blocked,muted,updated_at
           FROM talks.safety_preferences
          WHERE tenant_id=$1 AND viewer_user_id=$2 AND subject_user_id=$3
          LIMIT 1`,
        [input.tenantId,input.viewerUserId,input.subjectUserId],
      );
      return result.rows[0] ? preference(result.rows[0]) : null;
    },

    async setPreference(input){
      const normalized=normalizeTalkSafetyUserPreference(input);
      const result=await pool.query<PreferenceRow>(
        `INSERT INTO talks.safety_preferences(
           tenant_id,viewer_user_id,subject_user_id,blocked,muted,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(tenant_id,viewer_user_id,subject_user_id) DO UPDATE
           SET blocked=EXCLUDED.blocked,muted=EXCLUDED.muted,updated_at=EXCLUDED.updated_at
         RETURNING tenant_id,viewer_user_id,subject_user_id,blocked,muted,updated_at`,
        [
          normalized.tenantId,normalized.viewerUserId,normalized.subjectUserId,
          normalized.blocked,normalized.muted,normalized.updatedAt,
        ],
      );
      return preference(result.rows[0]!);
    },

    async readEnforcement(input){
      const result=await pool.query<EnforcementRow>(
        `SELECT tenant_id,target_kind,target_id,revision,visibility,reason_code,updated_at
           FROM talks.safety_enforcement
          WHERE tenant_id=$1 AND target_kind=$2 AND target_id=$3 LIMIT 1`,
        [input.tenantId,input.kind,input.targetId],
      );
      return result.rows[0] ? enforcement(result.rows[0]) : null;
    },

    async writeEnforcement(input){
      // Acquires the same transaction-scoped tenant/target lock as paid AI Seat
      // admission. Each CAS write and its guard are one PostgreSQL statement.
      // Colliding hash keys only serialize extra writes; never grant access.
      const next=normalizeTalkSafetyEnforcement(input.next);
      let result:SqlResult<EnforcementRow>;
      if(input.current===null){
        result=await pool.query<EnforcementRow>(
          `WITH admission_guard AS MATERIALIZED (
             SELECT pg_advisory_xact_lock(
               hashtext($1::text),hashtext($3::text)
             ) AS acquired
           )
           INSERT INTO talks.safety_enforcement(
             tenant_id,target_kind,target_id,revision,visibility,reason_code,updated_at
           ) SELECT $1,$2,$3,$4,$5,$6,$7 FROM admission_guard WHERE TRUE
           ON CONFLICT DO NOTHING
           RETURNING tenant_id,target_kind,target_id,revision,visibility,reason_code,updated_at`,
          [
            next.tenantId,next.target.kind,next.target.id,next.revision,
            next.visibility,next.reasonCode,next.updatedAt,
          ],
        );
      }else{
        result=await pool.query<EnforcementRow>(
          `WITH admission_guard AS MATERIALIZED (
             SELECT pg_advisory_xact_lock(
               hashtext($1::text),hashtext($3::text)
             ) AS acquired
           )
           UPDATE talks.safety_enforcement
              SET revision=$5,visibility=$6,reason_code=$7,updated_at=$8
             FROM admission_guard
            WHERE tenant_id=$1 AND target_kind=$2 AND target_id=$3 AND revision=$4
            RETURNING tenant_id,target_kind,target_id,revision,visibility,reason_code,updated_at`,
          [
            next.tenantId,next.target.kind,next.target.id,input.current.revision,
            next.revision,next.visibility,next.reasonCode,next.updatedAt,
          ],
        );
      }
      if(!result.rows[0]) throw new Error("Safety enforcement revision conflict");
      return enforcement(result.rows[0]);
    },
  });
}


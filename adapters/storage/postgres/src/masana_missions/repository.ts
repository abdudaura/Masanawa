import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { MissionInput, PostingSlot, SlotInput, StaffActor, WeeklyMission } from "@masanawa/masana-missions";
import { MissionError, requireEditor, requireOps } from "@masanawa/masana-missions";
import type { MissionRepository, MissionScorecard } from "@masanawa/masana-missions/ports";

function asMission(row: any): WeeklyMission {
  return { missionId:row.mission_id,tenantId:row.tenant_id,characterId:row.character_id,
    weekStart:new Date(row.week_start).toISOString().slice(0,10),objective:row.objective,
    topicFocus:row.topic_focus,autonomyLevel:row.autonomy_level,
    budgetMinor:String(row.budget_minor),spentMinor:String(row.spent_minor),
    state:row.state,revision:Number(row.revision) };
}
function asSlot(row: any): PostingSlot {
  return { slotId:row.slot_id,missionId:row.mission_id,characterId:row.character_id,
    kind:row.kind,scheduledAt:new Date(row.scheduled_at).toISOString(),timeZone:row.time_zone,
    topic:row.topic,draftBody:row.draft_body,estimatedCostMinor:String(row.estimated_cost_minor),
    state:row.state,revision:Number(row.revision),publicationKey:row.publication_key,
    postId:row.post_id,lastError:row.last_error };
}
function affected(rowCount: number | null, row: any, code = "revision_conflict"): any {
  if (rowCount !== 1 || !row) throw new MissionError(409,code);
  return row;
}
export class PostgresMissionsRepository implements MissionRepository {
  constructor(private readonly pool: Pool) {}
  async list(actor:StaffActor):Promise<readonly WeeklyMission[]> {
    requireEditor(actor);
    const r=await this.pool.query("SELECT * FROM masana.missions WHERE tenant_id=$1 ORDER BY week_start DESC,mission_id LIMIT 100",[actor.tenantId]);
    return r.rows.map(asMission);
  }
  async get(actor:StaffActor, id:string):Promise<WeeklyMission|null> {
    requireEditor(actor);
    const r=await this.pool.query("SELECT * FROM masana.missions WHERE tenant_id=$1 AND mission_id=$2",[actor.tenantId,id]);
    return r.rowCount ? asMission(r.rows[0]) : null;
  }
  async create(actor:StaffActor, input:MissionInput):Promise<WeeklyMission> {
    requireEditor(actor);
    // Only approved, platform-owned characters may ever receive missions.
    const r=await this.pool.query(`
      INSERT INTO masana.missions
      (tenant_id,mission_id,character_id,week_start,objective,topic_focus,
       autonomy_level,budget_minor,created_by,updated_by)
      SELECT $1,$2,$3,$4::date,$5,$6,$7,$8::bigint,$9,$9
      WHERE EXISTS (
        SELECT 1 FROM identity.characters c
        JOIN identity.character_ownership o USING(tenant_id,character_id)
        JOIN masana.character_revisions v USING(tenant_id,character_id)
        WHERE c.tenant_id=$1 AND c.character_id=$3 AND c.state='active'
          AND o.kind='platform' AND v.state='approved')
      RETURNING *`,[actor.tenantId,"mission_"+randomUUID(),input.characterId,input.weekStart,
        input.objective,input.topicFocus,input.autonomyLevel,input.budgetMinor,actor.userId]);
    if(!r.rowCount)throw new MissionError(422,"approved_masana_required");
    return asMission(r.rows[0]);
  }
  async setState(actor:StaffActor,id:string,state:"active"|"paused",revision:number):Promise<WeeklyMission> {
    requireEditor(actor);
    if(state==="active")requireOps(actor); // enabling publication requires operations permission
    const r=await this.pool.query(`
      UPDATE masana.missions SET state=$3,revision=revision+1,updated_by=$4,updated_at=now()
      WHERE tenant_id=$1 AND mission_id=$2 AND revision=$5
        AND state IN ('draft','active','paused')
      RETURNING *`,[actor.tenantId,id,state,actor.userId,revision]);
    return asMission(affected(r.rowCount,r.rows[0]));
  }
  async slots(actor:StaffActor,id:string):Promise<readonly PostingSlot[]> {
    requireEditor(actor);
    const r=await this.pool.query(`
      SELECT s.* FROM masana.posting_slots s JOIN masana.missions m
        ON m.tenant_id=s.tenant_id AND m.mission_id=s.mission_id
      WHERE m.tenant_id=$1 AND m.mission_id=$2
      ORDER BY s.scheduled_at,s.slot_id LIMIT 250`,[actor.tenantId,id]);
    return r.rows.map(asSlot);
  }
  async addSlot(actor:StaffActor,id:string,slot:SlotInput):Promise<PostingSlot> {
    requireEditor(actor);
    const r=await this.pool.query(`
      INSERT INTO masana.posting_slots
        (tenant_id,slot_id,mission_id,character_id,kind,scheduled_at,time_zone,topic,
        draft_body,estimated_cost_minor,publication_key)
      SELECT m.tenant_id,$3,m.mission_id,m.character_id,$4,$5::timestamptz,$6,$7,$8,$9::bigint,$10
      FROM masana.missions m WHERE m.tenant_id=$1 AND m.mission_id=$2
        AND m.state IN ('draft','active','paused')
        AND $5::timestamptz >= (m.week_start AT TIME ZONE 'UTC')
        AND $5::timestamptz < ((m.week_start + 7) AT TIME ZONE 'UTC')
      RETURNING *`,[actor.tenantId,id,"slot_"+randomUUID(),slot.kind,slot.scheduledAt,slot.timeZone,
        slot.topic,slot.draftBody,slot.estimatedCostMinor,"mission-post_"+randomUUID()]);
    return asSlot(affected(r.rowCount,r.rows[0],"mission_week_or_state_invalid"));
  }
  async approveSlot(actor:StaffActor,slotId:string,revision:number):Promise<PostingSlot> {
    requireEditor(actor);
    const r=await this.pool.query(`
      UPDATE masana.posting_slots SET state='approved',approved_by=$3,approved_at=now(),
        revision=revision+1,updated_at=now(),next_retry_at=now(),last_error=NULL
      WHERE tenant_id=$1 AND slot_id=$2 AND revision=$4 AND state='draft'
      RETURNING *`,[actor.tenantId,slotId,actor.userId,revision]);
    return asSlot(affected(r.rowCount,r.rows[0]));
  }
  async retrySlot(actor:StaffActor,slotId:string,revision:number):Promise<PostingSlot> {
    requireOps(actor);
    const r=await this.pool.query(`
      UPDATE masana.posting_slots SET state='approved',attempt_count=0,lease_token=NULL,
        lease_until=NULL,revision=revision+1,last_error=NULL,updated_at=now(),
        next_retry_at=now()
      WHERE tenant_id=$1 AND slot_id=$2 AND revision=$3 AND state='failed'
        AND approved_by IS NOT NULL AND post_id IS NULL
      RETURNING *`,[actor.tenantId,slotId,revision]);
    return asSlot(affected(r.rowCount,r.rows[0]));
  }
  async scorecard(actor:StaffActor,id:string):Promise<MissionScorecard> {
    requireEditor(actor);
    const r=await this.pool.query(`
      SELECT m.mission_id,m.spent_minor,m.budget_minor,
        COUNT(s.slot_id) FILTER(WHERE s.state='approved')::integer approved,
        COUNT(s.slot_id) FILTER(WHERE s.state='published')::integer published,
        COUNT(s.slot_id) FILTER(WHERE s.state='failed')::integer failed
      FROM masana.missions m LEFT JOIN masana.posting_slots s
        ON s.tenant_id=m.tenant_id AND s.mission_id=m.mission_id
      WHERE m.tenant_id=$1 AND m.mission_id=$2
      GROUP BY m.mission_id,m.spent_minor,m.budget_minor`,[actor.tenantId,id]);
    const row=affected(r.rowCount,r.rows[0],"mission_not_found");
    return {missionId:id,approved:row.approved,published:row.published,failed:row.failed,
      spentMinor:String(row.spent_minor),budgetMinor:String(row.budget_minor),actualEngagement:null};
  }
}

import type {AgentRoomDirectoryReader} from "./agent_directory.js";
import type {CharacterId} from "@masanawa/contracts";
/** One tenant-scoped batch read. A room is only linked when published/free,
 * its teacher is an active platform Character and a profile is approved. */
export function createPgAgentRoomDirectory(db:{query(sql:string,params:unknown[]):Promise<{rows:unknown[]}>}):AgentRoomDirectoryReader{
 return Object.freeze({
  async readPublished({tenantId,characterIds}:Parameters<AgentRoomDirectoryReader["readPublished"]>[0]){
   if(characterIds.length===0)return new Map<CharacterId,string>();
   const found=await db.query(`
    SELECT room.teacher_character_id,room.room_id FROM rooms.rooms room
    JOIN identity.characters c ON c.tenant_id=room.tenant_id
      AND c.character_id=room.teacher_character_id AND c.state='active'
    JOIN identity.character_ownership owner ON owner.tenant_id=c.tenant_id
      AND owner.character_id=c.character_id AND owner.kind='platform'
    JOIN masana.character_revisions revision ON revision.tenant_id=c.tenant_id
      AND revision.character_id=c.character_id AND revision.state='approved'
    WHERE room.tenant_id=$1 AND room.teacher_character_id=ANY($2::text[])
      AND room.state='published' AND room.plan_mode='free'
    ORDER BY room.teacher_character_id,room.room_id`,[tenantId,characterIds]);
   const result=new Map<CharacterId,string>();
   for(const raw of found.rows){
    const row=raw as {teacher_character_id?:unknown;room_id?:unknown};
    if(typeof row.teacher_character_id!=="string" || typeof row.room_id!=="string")
      throw new Error("invalid_agent_room_projection");
    const id=row.teacher_character_id as CharacterId;
    if(!result.has(id))result.set(id,row.room_id);
   }
   return result;
  },
 });
}

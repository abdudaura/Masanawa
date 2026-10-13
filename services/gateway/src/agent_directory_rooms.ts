import type {Pool} from "pg";
import type {AgentRoomDirectoryReader} from "./agent_directory.js";
import type {CharacterId} from "@masanawa/contracts";
/** One tenant-scoped batch read. A room is only linked when published/free,
 * its teacher is an active platform Character and a profile is approved. */
export function createPgAgentRoomDirectory(db:Pick<Pool,"query">):AgentRoomDirectoryReader{
 return Object.freeze({
  async readPublished({tenantId,characterIds}){
   if(characterIds.length===0)return new Map<CharacterId,string>();
   const found=await db.query<{teacher_character_id:string;room_id:string}>(`
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
   for(const row of found.rows){
    const id=row.teacher_character_id as CharacterId;
    if(!result.has(id))result.set(id,row.room_id);
   }
   return result;
  },
 });
}

import {describe,expect,it,vi} from "vitest";
import {createCanonicalId} from "@masanawa/contracts";
import {createPgAgentRoomDirectory} from "./agent_directory_rooms.js";
import {createAgentDirectoryService} from "./agent_directory.js";
describe("platform Masana to published classroom directory",()=>{
 it("batches one tenant's visible characters and denies paused, paid or unapproved room entries",async()=>{
  const tenant=createCanonicalId("tenant");
  const character=createCanonicalId("character");
  const query=vi.fn(async(sql:string,params:readonly unknown[])=>{
   expect(sql).toContain("room.tenant_id=$1");
   expect(sql).toContain("room.teacher_character_id=ANY($2::text[])");
   expect(sql).toContain("room.state='published'");
   expect(sql).toContain("room.plan_mode='free'");
   expect(sql).toContain("revision.state='approved'");
   expect(params).toEqual([tenant,[character]]);
   return {rows:[{teacher_character_id:character,room_id:"room_masana_02_amina"}]};
  });
  const rooms=createPgAgentRoomDirectory({query} as never);
  expect((await rooms.readPublished({tenantId:tenant,characterIds:[]})).size).toBe(0);
  expect(query).not.toHaveBeenCalled();
  const result=await rooms.readPublished({tenantId:tenant,characterIds:[character]});
  expect(result.get(character)).toBe("room_masana_02_amina");
  expect(query).toHaveBeenCalledTimes(1);
 });
 it("projects published Room only for authorized, visible Masana",async()=>{
  const tenant=createCanonicalId("tenant"),user=createCanonicalId("user");
  const allowed=createCanonicalId("character"),other=createCanonicalId("character");
  const profile=(id:string)=>({
   schemaVersion:1,tenantId:tenant,characterId:id,characterVersionId:createCanonicalId("character-version"),
   displayName:"Dr. Amina Yusuf",roleLabel:"Medicine",about:"AI tutor",greeting:null,
   visibleInUserApp:true,sortOrder:1,revision:1,
  });
  const rooms={readPublished:vi.fn(async()=>new Map([[allowed,"room_masana_02_amina"]]))};
  const service=createAgentDirectoryService({
   authorizer:{authorize:async()=>({tenantId:tenant,userId:user,characterIds:[allowed]})},
   presentations:{listVisible:async()=>[profile(allowed),profile(other)]} as never,
   rooms:rooms as never,
  });
  const entries=await service.list({authorizationHeader:"Bearer user"});
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({characterId:allowed,roomId:"room_masana_02_amina"});
  expect(rooms.readPublished).toHaveBeenCalledWith({tenantId:tenant,characterIds:[allowed]});
 });
});

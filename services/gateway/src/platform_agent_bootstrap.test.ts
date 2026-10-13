import {describe,it,expect,vi} from "vitest";
import {createCanonicalId,nowInstant} from "@masanawa/contracts";
import type {AgentPresentation,PlatformAgentProfile,CharacterSkillAssignment} from "@masanawa/agents";
import {ensureDefaultPlatformAgents,PROFESSIONAL_MASANA_CATALOG} from "./platform_agent_bootstrap.js";
function fixture(){
 const presentations:AgentPresentation[]=[],profiles:PlatformAgentProfile[]=[];
 const assignments=new Map<string,CharacterSkillAssignment>();
 const identity={provision:vi.fn(async()=>undefined)};
 return {identity,presentations,profiles,assignments,
  presentationsPort:{
    listAll:async()=>presentations,
    readForCharacter:async({characterId}:{characterId:string})=>presentations.find(p=>p.characterId===characterId)??null,
    listVisible:async()=>presentations.filter(p=>p.visibleInUserApp),
    put:async({presentation,expectedRevision}:{presentation:AgentPresentation;expectedRevision:number|null})=>{
       const i=presentations.findIndex(p=>p.characterId===presentation.characterId);
       if(i>=0){expect(presentations[i]?.revision).toBe(expectedRevision);presentations[i]=presentation;}
       else presentations.push(presentation);
       return presentation;
    },
  },
  profilesPort:{
    listSupportAgents:async()=>profiles.filter(p=>p.supportAgent),
    readForCharacter:async({characterId}:{characterId:string})=>profiles.find(p=>p.characterId===characterId)??null,
    put:async({profile}:{profile:PlatformAgentProfile})=>{profiles.push(profile);return profile;},
  },
  assignmentsPort:{
    readForCharacter:async({characterId}:{characterId:string})=>assignments.get(characterId)??null,
    put:async({assignment}:{assignment:CharacterSkillAssignment})=>{
      assignments.set(assignment.characterId,assignment);return assignment;
    },
  },
  skillsPort:{listForAudience:async()=>[{skillVersionId:createCanonicalId("skill-version"),installMode:"automatic"}]},
 };
}
function run(f:ReturnType<typeof fixture>,tenantId=createCanonicalId("tenant")){
 return ensureDefaultPlatformAgents({tenantId,identity:f.identity,
   presentations:f.presentationsPort as never,profiles:f.profilesPort as never,
   skillAssignments:f.assignmentsPort as never,skillDistribution:f.skillsPort as never,
   now:()=>nowInstant()});
}
describe("26 professional Masana production bootstrap",()=>{
 it("defines 2 support + 20 academic + 4 language tutors, all with dedicated Rooms and images",()=>{
   expect(PROFESSIONAL_MASANA_CATALOG).toHaveLength(26);
   expect(PROFESSIONAL_MASANA_CATALOG.filter(s=>s.supportAgent)).toHaveLength(2);
   expect(new Set(PROFESSIONAL_MASANA_CATALOG.map(s=>s.roomId)).size).toBe(26);
   expect(PROFESSIONAL_MASANA_CATALOG.slice(-4).map(s=>s.languages[0])).toEqual(["ar","en","hi","zh"]);
   expect(PROFESSIONAL_MASANA_CATALOG.every(s=>s.displayName.includes(" "))).toBe(true);
 });
 it("provisions 26 chat/call identities, keeps Gwani default and is idempotent",async()=>{
   const f=fixture(),tenant=createCanonicalId("tenant");
   const first=await run(f,tenant);
   expect(first.changed).toBe(true);
   expect(first.characterIds).toHaveLength(26);
   expect(f.identity.provision).toHaveBeenCalledTimes(26);
   expect(f.presentations).toHaveLength(26);
   expect(f.profiles).toHaveLength(26);
   expect(f.assignments.size).toBe(26);
   expect(f.profiles.filter(p=>p.defaultForNewUsers)).toHaveLength(1);
   expect(f.profiles[0]).toMatchObject({supportAgent:true,voiceName:"Bodi"});
   expect(f.profiles[1]).toMatchObject({supportAgent:true,voiceName:"Sulafat"});
   expect(f.profiles.slice(2).every(p=>!p.supportAgent&&p.voiceProvider==="gemini")).toBe(true);
   const second=await run(f,tenant);
   expect(second.changed).toBe(false);
   expect(f.identity.provision).toHaveBeenCalledTimes(26);
 });
 it("upgrades existing Gwani/Gwana without replacing their canonical identifiers",async()=>{
   const f=fixture(),tenant=createCanonicalId("tenant");
   const gwani=createCanonicalId("character"),gwana=createCanonicalId("character");
   for(const [id,name] of [[gwani,"Gwani"],[gwana,"Gwana"]] as const){
     f.presentations.push({schemaVersion:1,tenantId:tenant,characterId:id,
       characterVersionId:createCanonicalId("character-version"),
       displayName:name,roleLabel:"Masanawa Support",about:"Existing",greeting:null,
       visibleInUserApp:true,sortOrder:0,revision:1});
     f.profiles.push({schemaVersion:1,tenantId:tenant,characterId:id,
       supportAgent:true,defaultForNewUsers:name==="Gwani",
       voiceProvider:"gemini",voiceName:name==="Gwani"?"Bodi":"Sulafat",revision:1});
   }
   const result=await run(f,tenant);
   expect(result.characterIds[0]).toBe(gwani);
   expect(result.characterIds[1]).toBe(gwana);
   expect(f.presentations[0]?.displayName).toBe("Mallam Gwani Bodi");
   expect(f.presentations[1]?.displayName).toBe("Malamah Gwana Sulafat");
   expect(f.identity.provision).toHaveBeenCalledTimes(24);
   expect(f.profiles).toHaveLength(26);
 });
 it("does not override hidden or administrator-customized characters",async()=>{
   const f=fixture(),tenant=createCanonicalId("tenant");
   f.presentations.push({schemaVersion:1,tenantId:tenant,
     characterId:createCanonicalId("character"),characterVersionId:createCanonicalId("character-version"),
     displayName:"Dr. Amina Yusuf",roleLabel:"Admin-owned",about:"Hidden",
     greeting:null,visibleInUserApp:false,sortOrder:18,revision:8});
   await run(f,tenant);
   expect(f.presentations.filter(p=>p.displayName==="Dr. Amina Yusuf")).toHaveLength(1);
   expect(f.presentations[0]?.roleLabel).toBe("Admin-owned");
   expect(f.identity.provision).toHaveBeenCalledTimes(25);
 });
});

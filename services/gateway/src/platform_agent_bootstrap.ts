import type {
  AgentPresentation, AgentPresentationRepository,
  CharacterSkillAssignmentRepository, PlatformAgentProfileRepository,
} from "@masanawa/agents";
import {
  createCanonicalId, nowInstant,
  type CharacterId,type CharacterVersionId,type Instant,type TenantId,
} from "@masanawa/contracts";
import type {CharacterConstitution} from "@masanawa/identity";
import type {SkillDistributionRepository} from "@masanawa/skills";

/** Fictional AI characters. Professional titles identify educational roles,
 * NOT human degrees, registration, or a licensed doctor/lawyer. */
export interface ProfessionalMasanaSeed {
 readonly key:string;readonly displayName:string;readonly roleLabel:string;
 readonly roomName:string;readonly expertise:readonly string[];
 readonly languages:readonly string[];readonly voiceName:string;
 readonly supportAgent:boolean;readonly illustrationIndex:number;
 readonly roomId:string;
 readonly handle:string;
}
const rows: readonly (readonly [string,string,string,string,string,string,string,string])[] = [["gwani","Mallam Gwani Bodi","Masanawa General Support","Gwani Help Desk","onboarding, account help, platform guidance","en,ha","Bodi","support"],["gwana","Malamah Gwana Sulafat","Masanawa General Support","Gwana Help Desk","account help, language support, platform guidance","en,ha","Sulafat","support"],["amina","Dr. Amina Yusuf","Medicine & Surgery","Dr. Amina's Medical Classroom","anatomy, physiology, pathology, medical education","en,ha","Sulafat","medicine"],["fatima","Nurse Fatima Abdullahi","Nursing Science","Nurse Fatima's Nursing Room","nursing theory, patient care, community health","en,ha","Sulafat","nursing"],["salim","Pharm. Salim Ibrahim","Pharmacy","Pharm. Salim's Pharmacy Room","pharmacology, pharmaceutics, drug calculations","en,ha","Bodi","pharmacy"],["zainab","Barr. Zainab Bello","Law","Barr. Zainab's Law Chamber","constitutional law, legal methods, Nigerian law","en,ha","Sulafat","law"],["sadiq","Prof. Sadiq Musa","Computer Science","Prof. Sadiq's Computing Lab","programming, databases, algorithms, artificial intelligence","en,ha","Bodi","computing"],["musa","Engr. Musa Garba","Electrical & Electronics Engineering","Engr. Musa's Electronics Lab","circuits, power, signals, electronics","en,ha","Bodi","electrical"],["bello","Engr. Bello Shehu","Civil Engineering","Engr. Bello's Civil Works Studio","structures, surveying, construction materials","en,ha","Bodi","civil"],["umar","Engr. Umar Lawal","Mechanical Engineering","Engr. Umar's Mechanical Workshop","mechanics, thermodynamics, machines","en,ha","Bodi","mechanical"],["safiya","Arc. Safiya Kabir","Architecture","Arc. Safiya's Design Studio","architectural design, drawing, building science","en,ha","Sulafat","architecture"],["ruqayya","Prof. Ruqayya Haruna","Mathematics","Prof. Ruqayya's Mathematics Room","algebra, calculus, statistics, differential equations","en,ha","Sulafat","mathematics"],["idris","Dr. Idris Muhammad","Accounting","Dr. Idris's Accounting Room","accounting, auditing, taxation, financial reporting","en,ha","Bodi","accounting"],["maryam","Prof. Maryam Usman","Economics","Prof. Maryam's Economics Room","microeconomics, macroeconomics, econometrics","en,ha","Sulafat","economics"],["kabir","Dr. Kabir Ahmad","Business Administration","Dr. Kabir's Business School","management, marketing, entrepreneurship","en,ha","Bodi","business"],["hauwa","Prof. Hauwa Sani","Mass Communication","Prof. Hauwa's Media Room","journalism, broadcasting, public relations","en,ha","Sulafat","media"],["yusuf","Dr. Yusuf Danladi","Agriculture","Dr. Yusuf's Agriculture Hub","agronomy, animal science, soil science","en,ha","Bodi","agriculture"],["haruna","Prof. Haruna Adamu","Education","Prof. Haruna's Education Room","curriculum, teaching methods, educational psychology","en,ha","Bodi","education"],["bilkisu","Dr. Bilkisu Suleiman","Biochemistry","Dr. Bilkisu's Biochemistry Lab","metabolism, molecular biology, biomolecules","en,ha","Sulafat","biochemistry"],["nura","Dr. Nura Abdullahi","Physics","Dr. Nura's Physics Lab","mechanics, electricity, waves, modern physics","en,ha","Bodi","physics"],["aisha","Dr. Aisha Tanko","Chemistry","Dr. Aisha's Chemistry Lab","organic chemistry, inorganic chemistry, physical chemistry","en,ha","Sulafat","chemistry"],["abdulrahman","Prof. Abdulrahman Isah","Political Science","Prof. Abdulrahman's Politics Room","government, political theory, public administration","en,ha","Bodi","political"],["layla","Ustazah Layla Hassan","Arabic Language","Ustazah Layla's Arabic Majlis","Arabic conversation, grammar, reading, writing","ar,en,ha","Sulafat","arabic"],["grace","Prof. Grace Okonkwo","English Language","Prof. Grace's English Academy","English conversation, writing, grammar, pronunciation","en,ha","Sulafat","english"],["asha","Madam Asha Verma","Hindi Language","Madam Asha's Hindi Academy","Hindi conversation, Devanagari, pronunciation","hi,en","Sulafat","hindi"],["mei","Prof. Mei Lin","Mandarin Chinese","Prof. Mei Lin's Mandarin Room","Mandarin conversation, pinyin, tones, Chinese characters","zh,en","Sulafat","mandarin"]];
export const PROFESSIONAL_MASANA_CATALOG:readonly ProfessionalMasanaSeed[] =
 Object.freeze(rows.map((r,index):ProfessionalMasanaSeed=>{
   const [key,displayName,roleLabel,roomName,expertise,languages,voiceName,kind]=r;
   return Object.freeze({
     key,displayName,roleLabel,roomName,
     expertise:Object.freeze(expertise.split(", ")),
     languages:Object.freeze(languages.split(",")),
     voiceName,supportAgent:kind==="support",
     illustrationIndex:index,
     roomId:"room_masana_"+String(index).padStart(2,"0")+"_"+key,
     handle:"masana."+key,
   });
 }));

export interface PlatformAgentIdentityProvisioner {
 provision(input: Readonly<{
 tenantId:TenantId;characterId:CharacterId;characterVersionId:CharacterVersionId;
 constitution:CharacterConstitution;createdAt:Instant;
 }>):Promise<void>;
}
export interface PlatformAgentBootstrapResult {
 readonly changed:boolean;
 readonly supportAgentCount:number;
 readonly characterIds:readonly CharacterId[];
 readonly catalog:readonly {seed:ProfessionalMasanaSeed;characterId:CharacterId}[];
}
/** Run whenever a configured platform Gateway starts. Idempotent: existing
 * canonical identities, their versions, staff customizations, conversations
 * and user preferences remain intact. A previously seeded Gwani/Gwana is
 * matched by its old short display name rather than duplicated. */
export async function ensureDefaultPlatformAgents(input:Readonly<{
 tenantId:TenantId;identity:PlatformAgentIdentityProvisioner;
 presentations:AgentPresentationRepository;profiles:PlatformAgentProfileRepository;
 skillAssignments:CharacterSkillAssignmentRepository;
 skillDistribution:SkillDistributionRepository;now?:()=>Instant;
 voiceAssignments?:ReadonlyMap<string,string>;
}>):Promise<PlatformAgentBootstrapResult>{
 const now=input.now?.()??nowInstant();
 const all=[...(await input.presentations.listAll({tenantId:input.tenantId}))];
 const skills=(await input.skillDistribution.listForAudience("platform-support"))
   .filter(s=>s.installMode!=="hidden")
   .map(s=>s.skillVersionId);
 const catalog:Array<{seed:ProfessionalMasanaSeed;characterId:CharacterId}>=[];
 let changed=false;
 for(const seed of PROFESSIONAL_MASANA_CATALOG){
   // NEVER attach a catalog persona to a hidden/admin-maintained profile.
   const match=(item:AgentPresentation)=>
    item.displayName.trim().toLowerCase()===seed.displayName.toLowerCase() ||
    (seed.key==="gwani"&&item.displayName==="Gwani") ||
    (seed.key==="gwana"&&item.displayName==="Gwana");
   let presentation=all.find(match);
   if(presentation&&!presentation.visibleInUserApp)continue;
   if(!presentation){
     const characterId=createCanonicalId("character");
     const characterVersionId=createCanonicalId("character-version");
     await input.identity.provision({
       tenantId:input.tenantId,characterId,characterVersionId,createdAt:now,
       constitution:Object.freeze({
         schemaVersion:1,displayName:seed.displayName,
         biography:seed.displayName+" is a fictional Masanawa AI "+
           seed.roleLabel+" educator. Not a real human, licensed professional, "+
           "or a substitute for verified individual advice.",
         personality:Object.freeze(["patient","clear","knowledgeable","respectful"]),
         boundaries:Object.freeze([
           "Always identify as an AI character, not a real professor, practitioner or doctor.",
           "Teach any ordinary question directly without staff approval.",
           "Do not invent credentials, academic certification, patient diagnosis, prices or actions.",
           "For medical, legal and safety issues explain concepts and advise on suitable qualified assistance.",
         ]),
         disclosurePolicy:Object.freeze({}),
         languages:Object.freeze([...seed.languages]),
         voiceReferences:Object.freeze([]),appearanceReferences:Object.freeze([]),
         expertise:Object.freeze([...seed.expertise]),
       }),
     });
     presentation=await input.presentations.put({
       expectedRevision:null,
       presentation:{
         schemaVersion:1,tenantId:input.tenantId,characterId,characterVersionId,
         displayName:seed.displayName,roleLabel:seed.roleLabel,
         about:"AI "+seed.roleLabel+" educator. "+seed.expertise.join("; ")+
           ". Fictional persona, not a licensed human practitioner.",
         greeting:"Hello! I'm "+seed.displayName+", your Masanawa AI tutor. "+
           "What would you like to learn or discuss?",
         visibleInUserApp:true,sortOrder:seed.illustrationIndex,revision:1,
       },
     });
     all.push(presentation);changed=true;
   }else if((seed.key==="gwani"&&presentation.displayName==="Gwani") ||
              (seed.key==="gwana"&&presentation.displayName==="Gwana")){
     // Single harmless alias upgrade for original stock profiles; never
     // rewrite profiles that an admin has already renamed.
     const at=all.indexOf(presentation);
     presentation=await input.presentations.put({
       expectedRevision:presentation.revision,
       presentation:{...presentation,displayName:seed.displayName,
         roleLabel:"Masanawa General Support",
         about:"Fictional AI support agent for Masanawa accounts and general help."},
     });
     all[at]=presentation;changed=true;
   }
   const assignment=await input.skillAssignments.readForCharacter({
     tenantId:input.tenantId,characterId:presentation.characterId,
   });
   if(!assignment){
     await input.skillAssignments.put({expectedRevision:null,assignment:{
       schemaVersion:1,tenantId:input.tenantId,characterId:presentation.characterId,
       skillVersionIds:Object.freeze([...skills]),revision:1,
     }});
     changed=true;
   }
   const profile=await input.profiles.readForCharacter({
     tenantId:input.tenantId,characterId:presentation.characterId,
   });
   if(!profile){
     await input.profiles.put({expectedRevision:null,profile:{
       schemaVersion:1,tenantId:input.tenantId,
       characterId:presentation.characterId,supportAgent:seed.supportAgent,
       defaultForNewUsers:seed.key==="gwani",
       voiceProvider:"gemini",voiceName:input.voiceAssignments?.get(seed.displayName)??seed.voiceName,revision:1,
     }});
     changed=true;
   }
   const assignedVoice=input.voiceAssignments?.get(seed.displayName);
   if(profile && assignedVoice && profile.voiceName!==assignedVoice){
     await input.profiles.put({expectedRevision:profile.revision,profile:{...profile,voiceProvider:"gemini",voiceName:assignedVoice,revision:profile.revision+1}});
     changed=true;
   }
   catalog.push(Object.freeze({seed,characterId:presentation.characterId}));
 }
 const supports=await input.profiles.listSupportAgents({tenantId:input.tenantId});
 return Object.freeze({
   changed,supportAgentCount:supports.length,
   characterIds:Object.freeze(catalog.map(c=>c.characterId)),
   catalog:Object.freeze(catalog),
 });
}

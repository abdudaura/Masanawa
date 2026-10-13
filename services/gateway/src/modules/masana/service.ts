import type { FastifyInstance } from "fastify";

export interface MasanaActor {
  readonly tenantId: string;
  readonly userId: string | null;
}
export interface MasanaAdminActor extends MasanaActor {
  readonly userId: string;
}
export interface MasanaAuth {
  /** Guest tenant resolution is server-owned. Untrusted request tenant parameters are ignored. */
  optional(header: string | undefined): Promise<MasanaActor>;
  fan(header: string | undefined): Promise<MasanaAdminActor>;
  staff(header: string | undefined, role: "content_editor"): Promise<MasanaAdminActor>;
}
export interface MasanaStore {
  list(input: {tenantId:string; userId:string|null; q:string; profession:string; language:string; limit:number; cursor:string|null}): Promise<unknown>;
  read(input: {tenantId:string; userId:string|null; characterId:string}): Promise<unknown|null>;
  follow(input: {tenantId:string; userId:string; characterId:string; active:boolean}): Promise<boolean>;
  listDrafts(input: {tenantId:string}): Promise<unknown>;
  draft(input: {tenantId:string; characterId:string; expectedRevision:number; profile:unknown; staffId:string}): Promise<unknown>;
  approve(input: {tenantId:string; characterId:string; revision:number; staffId:string}): Promise<unknown>;
  attachMedia(input: {tenantId:string; characterId:string; revision:number; mediaId:string; kind:"portrait"|"banner"; objectKey:string; rightsNote:string; staffId:string}): Promise<unknown>;
}
function params(raw:unknown):Record<string,unknown> {
  return raw && typeof raw==="object" && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
}
function characterId(p:unknown):string {
  if(typeof p!=="string" || p.length>160 || !/^[a-zA-Z0-9_-]+$/.test(p)) throw new TypeError("invalid_character_id");
  return p;
}
function asText(v:unknown,max:number):string {
  if(v===undefined || v===null) return "";
  if(typeof v!=="string" || v.length>max) throw new TypeError("invalid_query");
  return v.trim();
}
/** Inject existing authenticated tenant/role authority; registering these routes without it is impossible. */
export function registerMasanaRoutes(app:FastifyInstance, deps:{auth:MasanaAuth;store:MasanaStore;validateProfile:(value:unknown)=>unknown; verifyMedia:(input:{tenantId:string;mediaId:string;kind:"portrait"|"banner";staffId:string})=>Promise<{objectKey:string}>; publicMediaUrl:(input:{tenantId:string;characterId:string;mediaId:string;kind:"portrait"|"banner"})=>Promise<string|null>}):void {
  app.get("/v1/masana",async (request,reply)=>{
    const actor=await deps.auth.optional(request.headers.authorization);
    const query=params(request.query);
    const n=query.limit===undefined?20:Number(query.limit);
    if(!Number.isInteger(n)||n<1||n>50)
      return reply.code(400).send({code:"invalid_limit"});
    return deps.store.list({tenantId:actor.tenantId,userId:actor.userId,q:asText(query.q,100),profession:asText(query.profession,100),language:asText(query.language,16),limit:n,cursor:asText(query.cursor,200)||null});
  });
  app.get("/v1/masana/:id",async (request,reply)=>{
    const actor=await deps.auth.optional(request.headers.authorization);
    const id=characterId(params(request.params).id);
    const profile=await deps.store.read({tenantId:actor.tenantId,userId:actor.userId,characterId:id});
    if(!profile) return reply.code(404).send({code:"masana_not_found"});
    const output=profile as {profile?:{portraitMediaId?:unknown;bannerMediaId?:unknown}};
    const data=output.profile;
    // Signed/read-through media links come from the existing qualified object store.
    // Never expose object keys, unreviewed uploads or permanent public S3 URLs.
    const media=await Promise.all([
      typeof data?.portraitMediaId==="string"
        ? deps.publicMediaUrl({tenantId:actor.tenantId,characterId:id,mediaId:data.portraitMediaId,kind:"portrait"})
        : Promise.resolve(null),
      typeof data?.bannerMediaId==="string"
        ? deps.publicMediaUrl({tenantId:actor.tenantId,characterId:id,mediaId:data.bannerMediaId,kind:"banner"})
        : Promise.resolve(null)
    ]);
    return {...(profile as object),portraitUrl:media[0],bannerUrl:media[1]};
  });
  for(const [method,active] of [["post",true],["delete",false]] as const){
    app[method]("/v1/masana/:id/follow",async (request,reply)=>{
      const actor=await deps.auth.fan(request.headers.authorization);
      const id=characterId(params(request.params).id);
      const following=await deps.store.follow({tenantId:actor.tenantId,userId:actor.userId,characterId:id,active});
      return reply.code(200).send({characterId:id,following});
    });
  }
  app.get("/v1/admin/masana",async request=>{
    const actor=await deps.auth.staff(request.headers.authorization,"content_editor");
    return deps.store.listDrafts({tenantId:actor.tenantId});
  });
  app.post("/v1/admin/masana/:id/revisions",async (request,reply)=>{
    const actor=await deps.auth.staff(request.headers.authorization,"content_editor");
    const id=characterId(params(request.params).id);
    const input=params(request.body);
    const expectedRevision=Number(input.expectedRevision);
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
      return reply.code(400).send({code:"invalid_expected_revision"});
    return reply.code(201).send(await deps.store.draft({
      tenantId:actor.tenantId,characterId:id,expectedRevision,
      profile:deps.validateProfile(input.profile),staffId:actor.userId
    }));
  });
  app.post("/v1/admin/masana/:id/revisions/:revision/media",async (request,reply)=>{
    const actor=await deps.auth.staff(request.headers.authorization,"content_editor");
    const id=characterId(params(request.params).id);
    const revision=Number(params(request.params).revision);
    if(!Number.isSafeInteger(revision)||revision<1)return reply.code(400).send({code:"invalid_revision"});
    const input=params(request.body);
    const kind=input.kind;
    if(kind!=="portrait"&&kind!=="banner")return reply.code(400).send({code:"invalid_media_kind"});
    const mediaId=characterId(input.mediaId);
    const rightsNote=asText(input.rightsNote,1024);
    if(rightsNote.length<5)return reply.code(400).send({code:"rights_note_required"});
    // The authoritative provider/media store must verify a genuine tenant-owned upload
    // and its moderation status. An arbitrary storage key from the client is never trusted.
    const verified=await deps.verifyMedia({tenantId:actor.tenantId,mediaId,kind,staffId:actor.userId});
    if(!verified.objectKey||verified.objectKey.length>1024)throw new TypeError("unverified_media");
    return reply.code(201).send(await deps.store.attachMedia({
      tenantId:actor.tenantId,characterId:id,revision,mediaId,kind,objectKey:verified.objectKey,
      rightsNote,staffId:actor.userId
    }));
  });
  app.post("/v1/admin/masana/:id/revisions/:revision/approve",async (request,reply)=>{
    const actor=await deps.auth.staff(request.headers.authorization,"content_editor");
    const id=characterId(params(request.params).id);
    const revision=Number(params(request.params).revision);
    if(!Number.isSafeInteger(revision)||revision<1) return reply.code(400).send({code:"invalid_revision"});
    return deps.store.approve({tenantId:actor.tenantId,characterId:id,revision,staffId:actor.userId});
  });
}

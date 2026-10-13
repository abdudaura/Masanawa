import type {FastifyInstance} from 'fastify';
import type {MasanaAuth} from './service.js';
type Mode='chat'|'call'|'post';
interface DraftInput {revision:number;mode:Mode;prompt:string;idempotencyKey:string}
export interface MasanaRehearsalStore {
 enqueue(input:DraftInput&{tenantId:string;staffId:string;characterId:string}):Promise<{runId:string;state:string;reused:boolean}>;
 read(input:{tenantId:string;staffId:string;characterId:string;runId:string}):Promise<unknown|null>;
}
function dict(x:unknown):Record<string,unknown>{return x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}}
function id(x:unknown):string {
 if(typeof x!=='string'||x.length>160||! /^[A-Za-z0-9_-]+$/.test(x))throw Object.assign(new Error('invalid_identifier'),{statusCode:400});
 return x;
}
function input(x:unknown):DraftInput {
 const v=dict(x);
 if(!Number.isSafeInteger(v.revision)||Number(v.revision)<1)throw Object.assign(new Error('invalid_revision'),{statusCode:400});
 if(v.mode!=='chat'&&v.mode!=='post'&&v.mode!=='call')throw Object.assign(new Error('invalid_mode'),{statusCode:400});
 if(typeof v.prompt!=='string'||!v.prompt.trim()||v.prompt.length>2000||
   /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/u.test(v.prompt))throw Object.assign(new Error('invalid_prompt'),{statusCode:400});
 if(typeof v.idempotencyKey!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(v.idempotencyKey))
  throw Object.assign(new Error('invalid_idempotency_key'),{statusCode:400});
 return {revision:Number(v.revision),mode:v.mode,prompt:v.prompt.trim(),idempotencyKey:v.idempotencyKey};
}
/** Route registration is inert until AF00 injects the existing editor auth, PG store and flag. */
export function registerMasanaRehearsalRoutes(app:FastifyInstance,deps:{
 auth:MasanaAuth;store:MasanaRehearsalStore;enabled:()=>boolean
}):void {
 app.post('/v1/admin/masana/:id/rehearsals',async(request,reply)=>{
  const actor=await deps.auth.staff(request.headers.authorization,'content_editor');
  if(!deps.enabled())return reply.code(503).send({code:'rehearsal_disabled'});
  const characterId=id(dict(request.params).id),v=input(request.body);
  const result=await deps.store.enqueue({...v,tenantId:actor.tenantId,staffId:actor.userId,characterId});
  return reply.code(result.reused?200:202).send(result);
 });
 app.get('/v1/admin/masana/:id/rehearsals/:runId',async(request,reply)=>{
  const actor=await deps.auth.staff(request.headers.authorization,'content_editor');
  if(!deps.enabled())return reply.code(503).send({code:'rehearsal_disabled'});
  const p=dict(request.params);
  const result=await deps.store.read({tenantId:actor.tenantId,staffId:actor.userId,characterId:id(p.id),runId:id(p.runId)});
  return result??reply.code(404).send({code:'rehearsal_not_found'});
 });
}
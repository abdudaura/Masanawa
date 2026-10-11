/** Rehearsal worker runs through the existing events.outbox lease/retry manager.
 * No chat journal, public post, LiveKit room, customer service or wallet API is injected. */
export type RehearsalMode='chat'|'post'|'call';
export interface DraftRun {
 tenantId:string;runId:string;characterId:string;revision:number;
 mode:RehearsalMode;prompt:string;attempt:number;leaseToken:string;
 draftProfile:unknown;
}
export interface RehearsalPort {
 claim(tenantId:string,runId:string):Promise<DraftRun|null>;
 complete(run:DraftRun,preview:{summary:string;previewText:string;audioMediaId?:string}):Promise<boolean>;
 fail(run:DraftRun,errorCode:'runner_unavailable'|'voice_not_qualified'|'rehearsal_failed'):Promise<void>;
}
export interface RehearsalRunner {
 run(input:{mode:RehearsalMode;prompt:string;approvedForPublic:false;draftProfile:unknown;maxTokens:512;noSideEffects:true}):Promise<{summary:string;previewText:string;audioMediaId?:string}>;
 isVoiceQualified(characterId:string):Promise<boolean>;
}
const valid=(v:string,max:number)=>typeof v==='string'&&v.length>0&&v.length<=max&&/^[A-Za-z0-9_-]+$/.test(v);
export async function processMasanaRehearsal(event:{tenantId:string;runId:string},port:RehearsalPort,runner:RehearsalRunner,enabled:boolean):Promise<'disabled'|'already_processed'|'processed'|'requeued'>{
 if(!enabled)return 'disabled';
 if(!valid(event.tenantId,160)||!valid(event.runId,160))throw new TypeError('invalid_rehearsal_event');
 const run=await port.claim(event.tenantId,event.runId);
 if(!run)return 'already_processed';
 try{
  if(run.mode==='call'&&!await runner.isVoiceQualified(run.characterId)){
   await port.fail(run,'voice_not_qualified');return 'requeued';
  }
  const preview=await runner.run({mode:run.mode,prompt:run.prompt,draftProfile:run.draftProfile,
   approvedForPublic:false,maxTokens:512,noSideEffects:true});
  if(typeof preview.summary!=='string'||preview.summary.length>4000||
   typeof preview.previewText!=='string'||preview.previewText.length>4000||
   (preview.audioMediaId!==undefined&&!valid(preview.audioMediaId,160)))
   throw new TypeError('invalid_preview');
  await port.complete(run,preview);
  return 'processed';
 }catch{
  await port.fail(run,'rehearsal_failed');return 'requeued';
 }
}
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { PrivateVoiceObjectStore, VoiceNoteRepository, VoiceNote, VoiceOwner } from "./model.js";
import { inspectOggOpus, InvalidVoiceNote, MAX_VOICE_BYTES } from "./ogg_opus.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const REQUEST = /^[A-Za-z0-9_-]{12,128}$/u;
const DIGITS = /^[1-9][0-9]{0,18}$/u;
const MAX_CURSOR = 9223372036854775807n;
const sha = (s:Buffer|string) => createHash("sha256").update(s).digest("hex");
export class VoiceNoteError extends Error {
 constructor(readonly code:string,readonly statusCode:number){super(code);this.name="VoiceNoteError"}
}
export interface VoiceNoteAuthorizer {
 authorize(input:{authorizationHeader:string|undefined}):Promise<PlatformSessionIdentity>;
}
export function createPrivateVoiceNoteService(input:Readonly<{
 authorizer:VoiceNoteAuthorizer;
 repository:VoiceNoteRepository;
 objects:PrivateVoiceObjectStore;
}>) {
 async function owner(header:string|undefined):Promise<VoiceOwner> {
  const who=await input.authorizer.authorize({authorizationHeader:header});
  if(!who.tenantId||!who.userId)throw new VoiceNoteError("messages.voice.unauthorized",401);
  return {tenantId:who.tenantId,userId:who.userId};
 }
 async function current(header:string|undefined,expected:VoiceOwner):Promise<void> {
  const latest=await owner(header);
  if(latest.tenantId!==expected.tenantId||latest.userId!==expected.userId)
    throw new VoiceNoteError("messages.voice.unauthorized",401);
 }
 function verified(bytes:Buffer,expected:{sizeBytes:number;sha256:string;durationMs:number}):void {
  if(bytes.length!==expected.sizeBytes||!/^[0-9a-f]{64}$/u.test(expected.sha256)||
     !timingSafeEqual(Buffer.from(sha(bytes),"hex"),Buffer.from(expected.sha256,"hex")))
    throw new VoiceNoteError("messages.voice.storage_corrupt",503);
  try {
    const media=inspectOggOpus(bytes);
    if(media.durationMs!==expected.durationMs)throw new Error("duration mismatch");
  } catch {throw new VoiceNoteError("messages.voice.storage_corrupt",503)}
 }
 function uuid(id:string):string {
  if(!ID.test(id))throw new VoiceNoteError("messages.voice.invalid_id",400);
  return id;
 }
 function cursor(value:string|undefined):string|undefined {
  if(value===undefined)return;
  if(!DIGITS.test(value)||BigInt(value)>MAX_CURSOR)
   throw new VoiceNoteError("messages.voice.invalid_cursor",400);
  return value;
 }
 function requestId(id:string):string {
  if(!REQUEST.test(id))throw new VoiceNoteError("messages.voice.invalid_request_id",400);
  return id;
 }
 function rejected(result:"forbidden"|"conflict"|"rate_limited"):never {
  if(result==="forbidden")throw new VoiceNoteError("messages.voice.unavailable",404);
  if(result==="conflict")throw new VoiceNoteError("messages.voice.idempotency_conflict",409);
  throw new VoiceNoteError("messages.voice.rate_limited",429);
 }
 return Object.freeze({
  async send(args:{
    authorizationHeader:string|undefined;conversationId:string;
    clientRequestId:string;ogg:Buffer;
  }):Promise<VoiceNote> {
   const identity=await owner(args.authorizationHeader);
   const conversationId=uuid(args.conversationId),clientRequestId=requestId(args.clientRequestId);
   let info:{sizeBytes:number;durationMs:number};
   try{info=inspectOggOpus(args.ogg)}
   catch(error){
     if(error instanceof InvalidVoiceNote)throw new VoiceNoteError(error.code,error.statusCode);
     throw error;
   }
   // Snapshot before the first repository await: later caller mutation cannot change
   // bytes after the journal's checksum and Ogg validation have been recorded.
   const upload=Buffer.from(args.ogg),digest=sha(upload);
   const objectKey=[
    "dm-voice",sha(identity.tenantId).slice(0,32),conversationId,
    sha(identity.userId).slice(0,32),randomUUID()+".ogg",
   ].join("/");
   // Durable staging precedes external storage. The same request ID uses its ORIGINAL
   // staged object key on retry, and same id/different bytes is always a conflict.
   const staged=await input.repository.stage({
     owner:identity,conversationId,clientRequestId,objectKey,sha256:digest,
     sizeBytes:info.sizeBytes,durationMs:info.durationMs,
   });
   if(typeof staged==="string")return rejected(staged);
   await current(args.authorizationHeader,identity);
   try{await input.objects.put(staged.objectKey,upload)}
   catch{throw new VoiceNoteError("messages.voice.storage_unavailable",503)}
   let stored:Buffer;
   try{stored=await input.objects.get(staged.objectKey,MAX_VOICE_BYTES)}
   catch{throw new VoiceNoteError("messages.voice.storage_unavailable",503)}
   verified(stored,staged);
   await current(args.authorizationHeader,identity);
   const outcome=await input.repository.attach(staged);
   if(typeof outcome==="string")return rejected(outcome);
   // A lost/revoked session after attachment yields uncertainty, not a fabricated
   // cancelled send. The durable original request remains the sole retry identity.
   await current(args.authorizationHeader,identity);
   return outcome;
  },
  async list(args:{
   authorizationHeader:string|undefined;conversationId:string;before?:string;limit?:number;
  }):Promise<{voiceNotes:readonly VoiceNote[]}> {
   const identity=await owner(args.authorizationHeader);
   const conversationId=uuid(args.conversationId),before=cursor(args.before);
   const limit=args.limit??30;
   if(!Number.isSafeInteger(limit)||limit<1||limit>50)
    throw new VoiceNoteError("messages.voice.invalid_limit",400);
   const result=await input.repository.list({...identity,conversationId,limit,...(before?{before}:{})});
   if(!result)throw new VoiceNoteError("messages.voice.unavailable",404);
   await current(args.authorizationHeader,identity);
   return {voiceNotes:result};
  },
  async read(args:{authorizationHeader:string|undefined;messageId:string}):Promise<Buffer> {
   const identity=await owner(args.authorizationHeader);
   const messageId=uuid(args.messageId);
   const record=await input.repository.find({...identity,messageId});
   if(!record)throw new VoiceNoteError("messages.voice.unavailable",404);
   let bytes:Buffer;
   try {
    // The provider may reuse or mutate its response buffer after resolving.
    // Copy before the authorization/SQL awaits, then verify and serve only
    // that immutable per-request snapshot.
    bytes=Buffer.from(await input.objects.get(record.objectKey,MAX_VOICE_BYTES));
   } catch {throw new VoiceNoteError("messages.voice.storage_unavailable",503)}
   verified(bytes,record);
   const reread=await input.repository.find({...identity,messageId});
   if(!reread||reread.objectKey!==record.objectKey||
      reread.sizeBytes!==record.sizeBytes||reread.durationMs!==record.durationMs||
      reread.sha256!==record.sha256)
     throw new VoiceNoteError("messages.voice.unavailable",404);
   await current(args.authorizationHeader,identity);
   return bytes;
  },
  async remove(args:{authorizationHeader:string|undefined;messageId:string}) {
   const identity=await owner(args.authorizationHeader);
   if(!await input.repository.remove({...identity,messageId:uuid(args.messageId)}))
     throw new VoiceNoteError("messages.voice.unavailable",404);
   await current(args.authorizationHeader,identity);
   return {status:"deleted" as const};
  },
  async collectGarbage(limit=20) {
   if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new RangeError("Invalid cleanup bound");
   const rows=await input.repository.stale(limit);
   let deleted=0,failed=0;
   for(const row of rows) {
     let storageErased=false;
     try {
       await input.objects.delete(row.objectKey);
       storageErased=true;
       await input.repository.deleted(row.objectKey,true);
       deleted++;
     } catch {
       failed++;
       if(!storageErased) {
         // Failed storage DELETE is never proof of erasure. Best-effort
         // release the SQL claim; if even that fails, the existing 15-minute
         // deleting-state lease allows the next worker to reclaim it.
         try{await input.repository.deleted(row.objectKey,false)}catch{}
       }
       // If storage DELETE succeeded but its SQL finalization failed, keep
       // the 'deleting' journal row for a safe idempotent retry. Never write
       // deleted(false) over an uncertain erasure commit.
       // One failed key must not prevent other claimed keys from cleanup.
     }
   }
   return {deleted,failed};
  },
 });
}

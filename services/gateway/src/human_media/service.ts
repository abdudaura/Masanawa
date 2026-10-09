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
   const digest=sha(args.ogg);
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
   try{await input.objects.put(staged.objectKey,args.ogg)}
   catch{throw new VoiceNoteError("messages.voice.storage_unavailable",503)}
   const outcome=await input.repository.attach(staged);
   if(typeof outcome==="string")return rejected(outcome);
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
   return {voiceNotes:result};
  },
  async read(args:{authorizationHeader:string|undefined;messageId:string}):Promise<Buffer> {
   const identity=await owner(args.authorizationHeader);
   const messageId=uuid(args.messageId);
   const record=await input.repository.find({...identity,messageId});
   if(!record)throw new VoiceNoteError("messages.voice.unavailable",404);
   let bytes:Buffer;
   try{bytes=await input.objects.get(record.objectKey,MAX_VOICE_BYTES)}
   catch{throw new VoiceNoteError("messages.voice.storage_unavailable",503)}
   if(bytes.length!==record.sizeBytes)throw new VoiceNoteError("messages.voice.storage_corrupt",503);
   const hash=sha(bytes);
   if(!timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(record.sha256,"hex")))
     throw new VoiceNoteError("messages.voice.storage_corrupt",503);
   try{inspectOggOpus(bytes)}catch{throw new VoiceNoteError("messages.voice.storage_corrupt",503)}
   const reread=await input.repository.find({...identity,messageId});
   if(!reread||reread.objectKey!==record.objectKey||
      reread.sizeBytes!==record.sizeBytes||reread.durationMs!==record.durationMs||
      reread.sha256!==record.sha256)
     throw new VoiceNoteError("messages.voice.unavailable",404);
   return bytes;
  },
  async remove(args:{authorizationHeader:string|undefined;messageId:string}) {
   const identity=await owner(args.authorizationHeader);
   if(!await input.repository.remove({...identity,messageId:uuid(args.messageId)}))
     throw new VoiceNoteError("messages.voice.unavailable",404);
   return {status:"deleted" as const};
  },
  async collectGarbage(limit=20) {
   if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new RangeError("Invalid cleanup bound");
   const rows=await input.repository.stale(limit);
   let deleted=0,failed=0;
   for(const row of rows) {
     try{await input.objects.delete(row.objectKey);await input.repository.deleted(row.objectKey,true);deleted++}
     catch{failed++;await input.repository.deleted(row.objectKey,false)}
   }
   return {deleted,failed};
  },
 });
}

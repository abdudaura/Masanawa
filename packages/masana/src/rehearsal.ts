export type RehearsalMode = 'chat'|'post'|'call';
export interface RehearsalInput {revision:number;mode:RehearsalMode;prompt:string;idempotencyKey:string}
export interface RehearsalPreview {summary:string;previewText:string;audioMediaId?:string}
export function parseRehearsalInput(value:unknown):RehearsalInput {
 if(value===null||typeof value!=='object'||Array.isArray(value)) throw new TypeError('invalid_rehearsal');
 const v=value as Record<string,unknown>;
 if(!Number.isSafeInteger(v.revision)||Number(v.revision)<1)throw new TypeError('invalid_revision');
 if(v.mode!=='chat'&&v.mode!=='post'&&v.mode!=='call')throw new TypeError('invalid_mode');
 if(typeof v.prompt!=='string'||v.prompt.trim().length<1||v.prompt.length>2000||
    /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/u.test(v.prompt))throw new TypeError('invalid_prompt');
 if(typeof v.idempotencyKey!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(v.idempotencyKey))throw new TypeError('invalid_idempotency_key');
 return {revision:Number(v.revision),mode:v.mode,prompt:v.prompt.trim(),idempotencyKey:v.idempotencyKey};
}
export function parseRehearsalPreview(v:unknown):RehearsalPreview {
 if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('invalid_preview');
 const p=v as Record<string,unknown>;
 for(const k of ['summary','previewText'] as const)
   if(typeof p[k]!=='string'||p[k].length>4000)throw new TypeError('invalid_'+k);
 if(p.audioMediaId!==undefined && (typeof p.audioMediaId!=='string'||! /^[A-Za-z0-9_-]{1,160}$/.test(p.audioMediaId)))throw new TypeError('invalid_audio_media');
 return {summary:p.summary as string,previewText:p.previewText as string,...(typeof p.audioMediaId==='string'?{audioMediaId:p.audioMediaId}:{})};
}
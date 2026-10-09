/** C04 — human-only private media. Nothing here grants membership or a public S3 URL. */
export interface VoiceNote {
  readonly messageId: string;
  readonly conversationId: string;
  readonly sequence: string;
  readonly senderUserId: string;
  readonly clientRequestId: string;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly mimeType: "audio/ogg";
  readonly createdAt: string;
  readonly deletedAt: string | null;
}
export type VoiceOwner = Readonly<{tenantId:string;userId:string}>;
export type VoiceStaged = Readonly<{
  owner:VoiceOwner; conversationId:string; clientRequestId:string;
  objectKey:string; sha256:string; sizeBytes:number; durationMs:number;
}>;
export type VoiceReceipt = VoiceNote | "forbidden" | "conflict" | "rate_limited";
export interface VoiceNoteRepository {
  stage(input:VoiceStaged):Promise<VoiceStaged|"conflict"|"forbidden">;
  attach(input:VoiceStaged):Promise<VoiceReceipt>;
  find(input:VoiceOwner & {messageId:string}):Promise<(VoiceNote & {objectKey:string;sha256:string})|null>;
  list(input:VoiceOwner & {conversationId:string;before?:string;limit:number}):Promise<readonly VoiceNote[]|null>;
  remove(input:VoiceOwner & {messageId:string}):Promise<boolean>;
  stale(limit:number):Promise<readonly {objectKey:string}[]>;
  deleted(objectKey:string, success:boolean):Promise<void>;
}
export interface PrivateVoiceObjectStore {
  put(key:string,bytes:Buffer):Promise<void>;
  get(key:string,maxBytes:number):Promise<Buffer>;
  delete(key:string):Promise<void>;
}

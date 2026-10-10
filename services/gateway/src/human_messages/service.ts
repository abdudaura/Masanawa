import { createHash } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanDmConversation, HumanDmMessage, HumanDmRepository } from "./model.js";
export class HumanDmError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code); this.name = "HumanDmError";
  }
}
export interface HumanDmAuthorizer {
  authorize(input: { authorizationHeader: string | undefined }): Promise<PlatformSessionIdentity>;
}
export interface HumanDmService {
  open(input: { authorizationHeader?: string; otherUserId: string }): Promise<{ conversationId: string }>;
  inbox(input: { authorizationHeader?: string; limit?: number; before?: string }): Promise<{ conversations: readonly HumanDmConversation[] }>;
  history(input: { authorizationHeader?: string; conversationId: string; limit?: number; before?: string }): Promise<{ messages: readonly HumanDmMessage[]; nextBefore: string | null }>;
  send(input: { authorizationHeader?: string; conversationId: string; clientRequestId: string; body: string }): Promise<HumanDmMessage>;
  edit(input: { authorizationHeader?: string; messageId: string; body: string }): Promise<HumanDmMessage>;
  remove(input: { authorizationHeader?: string; messageId: string }): Promise<HumanDmMessage>;
  read(input: { authorizationHeader?: string; conversationId: string; throughSequence: string }): Promise<{ lastReadSequence: string }>;
}
function id(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{2,255}$/u.test(value)) throw new HumanDmError("messages."+label+"_invalid", 400);
  return value;
}
function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)) throw new HumanDmError("messages.id_invalid", 400);
  return value.toLowerCase();
}
function textBody(raw: string): string {
  const body=raw.trim();
  if (body.length < 1 || [...body].length > 4000 || Buffer.byteLength(body,"utf8") > 16000 || /\u0000/u.test(body)) throw new HumanDmError("messages.body_invalid",400);
  return body;
}
function count(n: number | undefined): number {
  if (n === undefined) return 40;
  if (!Number.isSafeInteger(n) || n < 1 || n > 50) throw new HumanDmError("messages.limit_invalid",400);
  return n;
}
function sequence(s: string): string {
  if (!/^[1-9][0-9]{0,18}$/u.test(s) || BigInt(s)>9223372036854775807n) throw new HumanDmError("messages.sequence_invalid",400);
  return s;
}
export function createHumanDmService(input: { repository: HumanDmRepository; authorizer: HumanDmAuthorizer }): HumanDmService {
  async function who(header?: string) {
    const p=await input.authorizer.authorize({authorizationHeader:header});
    return { tenantId: p.tenantId, userId:p.userId };
  }
  return Object.freeze({
    async open({authorizationHeader,otherUserId}) {
      const principal=await who(authorizationHeader);
      const thread=await input.repository.open({...principal,otherUserId:id(otherUserId,"recipient")});
      if (!thread) throw new HumanDmError("messages.recipient_unavailable",404);
      return {conversationId:thread};
    },
    async inbox({authorizationHeader,limit,before}) {
      const principal=await who(authorizationHeader);
      return {conversations:await input.repository.inbox({...principal,limit:count(limit),...(before?{before:sequence(before)}:{})})};
    },
    async history({authorizationHeader,conversationId,limit,before}) {
      const principal=await who(authorizationHeader);
      const data=await input.repository.history({...principal,conversationId:uuid(conversationId),limit:count(limit),...(before?{before:sequence(before)}:{})});
      if (!data) throw new HumanDmError("messages.conversation_unavailable",404);
      return { messages:data, nextBefore:data.length===count(limit)?data[data.length-1]?.sequence ?? null:null };
    },
    async send({authorizationHeader,conversationId,clientRequestId,body}) {
      const principal=await who(authorizationHeader), normalized=textBody(body);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{11,127}$/u.test(clientRequestId)) throw new HumanDmError("messages.request_id_invalid",400);
      const result=await input.repository.send({...principal,conversationId:uuid(conversationId),clientRequestId,body:normalized,sha256:createHash("sha256").update(normalized,"utf8").digest("hex")});
      if (result==="forbidden") throw new HumanDmError("messages.conversation_unavailable",404);
      if (result==="conflict") throw new HumanDmError("messages.request_id_conflict",409);
      if (result==="rate_limited") throw new HumanDmError("messages.rate_limited",429);
      return result;
    },
    async edit({authorizationHeader,messageId,body}) {
      const result=await input.repository.edit({...await who(authorizationHeader),messageId:uuid(messageId),body:textBody(body)});
      if (!result) throw new HumanDmError("messages.edit_unavailable",404);
      return result;
    },
    async remove({authorizationHeader,messageId}) {
      const result=await input.repository.remove({...await who(authorizationHeader),messageId:uuid(messageId)});
      if (!result) throw new HumanDmError("messages.delete_unavailable",404);
      return result;
    },
    async read({authorizationHeader,conversationId,throughSequence}) {
      const result=await input.repository.read({...await who(authorizationHeader),conversationId:uuid(conversationId),throughSequence:sequence(throughSequence)});
      if (result===null) throw new HumanDmError("messages.conversation_unavailable",404);
      return {lastReadSequence:result};
    },
  });
}

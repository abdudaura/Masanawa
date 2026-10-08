import { createHash, randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanConversation, HumanMessage, HumanMessagePage, HumanMessageRepository } from "./model.js";

export class HumanMessageError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code); this.name = "HumanMessageError";
  }
}
export interface HumanMessageAuthorizer {
  authorize(input: {authorizationHeader: string | undefined}): Promise<PlatformSessionIdentity>;
}
export interface HumanMessageService {
  start(input: {authorizationHeader: string | undefined; recipientUserId: string}): Promise<HumanConversation>;
  list(input: {authorizationHeader: string | undefined; limit?: number}): Promise<{conversations: readonly HumanConversation[]}>;
  read(input: {authorizationHeader: string | undefined; conversationId: string}): Promise<HumanConversation>;
  history(input: {authorizationHeader: string | undefined; conversationId: string; before?: string; limit?: number}): Promise<HumanMessagePage>;
  send(input: {authorizationHeader: string | undefined; conversationId: string; requestId: string; text: string}): Promise<HumanMessage>;
  edit(input: {authorizationHeader: string | undefined; conversationId: string; messageId: string; text: string; expectedRevision: number}): Promise<HumanMessage>;
  remove(input: {authorizationHeader: string | undefined; conversationId: string; messageId: string; expectedRevision: number}): Promise<HumanMessage>;
}
function id(value: string,name: string,min = 3,max = 128): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length<min || normalized.length>max ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(normalized)) {
    throw new HumanMessageError(`messages.${name}_invalid`,400);
  }
  return normalized;
}
function body(text: string): string {
  if (typeof text !== "string" || text.length>4000 || text.trim().length===0 ||
      text.includes("\u0000")) {
    throw new HumanMessageError("messages.body_invalid",400);
  }
  return text;
}
function limit(value: number | undefined): number {
  if (value === undefined) return 30;
  if (!Number.isSafeInteger(value)||value<1||value>50)
    throw new HumanMessageError("messages.limit_invalid",400);
  return value;
}
function revision(value: number): number {
  if (!Number.isSafeInteger(value)||value<1||value>2147483647)
    throw new HumanMessageError("messages.revision_invalid",400);
  return value;
}
function parseCursor(value: string | undefined): {at: string;id: string} | null {
  if (value === undefined) return null;
  if (value.length<10 || value.length>512 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new HumanMessageError("messages.cursor_invalid",400);
  }
  try {
    const bytes=Buffer.from(value,"base64url");
    if (bytes.toString("base64url")!==value) throw new Error("noncanonical cursor");
    const decoded=JSON.parse(bytes.toString("utf8")) as {t?: unknown;id?: unknown};
    if (typeof decoded.t!=="string"||Number.isNaN(Date.parse(decoded.t))||
        new Date(decoded.t).toISOString()!==decoded.t || typeof decoded.id!=="string")
      throw new Error("invalid cursor");
    return {at:decoded.t,id:id(decoded.id,"cursor_id",8)};
  } catch {
    throw new HumanMessageError("messages.cursor_invalid",400);
  }
}
export function createHumanMessageService(input: {repository: HumanMessageRepository; authorizer: HumanMessageAuthorizer}): HumanMessageService {
  async function owner(authorizationHeader: string | undefined) {
    const who = await input.authorizer.authorize({authorizationHeader});
    return {tenantId:who.tenantId,userId:who.userId};
  }
  function required<T>(row: T | null): T {
    if (row===null) throw new HumanMessageError("messages.unavailable",404);
    return row;
  }
  return Object.freeze<HumanMessageService>({
    async start({authorizationHeader,recipientUserId}) {
      const who=await owner(authorizationHeader);
      const other=id(recipientUserId,"recipient",3,256);
      if (other===who.userId) throw new HumanMessageError("messages.self_forbidden",400);
      return required(await input.repository.start({...who,recipientUserId:other,proposedId:randomUUID()}));
    },
    async list({authorizationHeader,limit:pageLimit}) {
      const who=await owner(authorizationHeader);
      return {conversations:await input.repository.list({...who,limit:limit(pageLimit)})};
    },
    async read({authorizationHeader,conversationId}) {
      const who=await owner(authorizationHeader);
      return required(await input.repository.read({...who,conversationId:id(conversationId,"conversation",8)}));
    },
    async history({authorizationHeader,conversationId,before,limit:pageLimit}) {
      const who=await owner(authorizationHeader);
      return required(await input.repository.history({...who,conversationId:id(conversationId,"conversation",8),
        limit:limit(pageLimit),before:parseCursor(before)}));
    },
    async send({authorizationHeader,conversationId,requestId,text}) {
      const who=await owner(authorizationHeader);
      const validated=body(text);
      try {
        return required(await input.repository.send({...who,
          conversationId:id(conversationId,"conversation",8),
          clientRequestId:id(requestId,"request",8),
          messageId:randomUUID(),text:validated,
          digest:createHash("sha256").update(validated,"utf8").digest("hex"),
        }));
      } catch (e) {
        if (e instanceof Error && e.message==="messages.rate_limited")
          throw new HumanMessageError("messages.rate_limited",429);
        if (e instanceof Error && e.message==="messages.request_id_conflict")
          throw new HumanMessageError("messages.request_id_conflict",409);
        throw e;
      }
    },
    async edit({authorizationHeader,conversationId,messageId,text,expectedRevision}) {
      const who=await owner(authorizationHeader);
      return required(await input.repository.edit({...who,
        conversationId:id(conversationId,"conversation",8),
        messageId:id(messageId,"message",8),text:body(text),
        expectedRevision:revision(expectedRevision)}));
    },
    async remove({authorizationHeader,conversationId,messageId,expectedRevision}) {
      const who=await owner(authorizationHeader);
      return required(await input.repository.remove({...who,
        conversationId:id(conversationId,"conversation",8),
        messageId:id(messageId,"message",8),
        expectedRevision:revision(expectedRevision)}));
    },
  });
}

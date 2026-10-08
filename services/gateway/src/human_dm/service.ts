import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanDmRepository, DmMessage, DmThread } from "./model.js";

export class HumanDmError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "HumanDmError";
  }
}
export interface HumanDmAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<PlatformSessionIdentity>;
}
export interface HumanDmService {
  open(input: { authorizationHeader: string | undefined; otherUserId: string }): Promise<{ conversationId: string }>;
  list(input: { authorizationHeader: string | undefined; limit?: number; before?: string }): Promise<{ conversations: readonly DmThread[] }>;
  history(input: { authorizationHeader: string | undefined; conversationId: string; limit?: number; beforeSequence?: number }): Promise<{ messages: readonly DmMessage[]; nextBeforeSequence: number | null }>;
  send(input: { authorizationHeader: string | undefined; conversationId: string; clientMessageId: string; text: string }): Promise<DmMessage>;
  read(input: { authorizationHeader: string | undefined; conversationId: string; upToSequence: number }): Promise<{ lastReadSequence: number }>;
  edit(input: { authorizationHeader: string | undefined; conversationId: string; messageId: string; text: string }): Promise<DmMessage>;
  remove(input: { authorizationHeader: string | undefined; conversationId: string; messageId: string }): Promise<DmMessage>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function id(value: string): string {
  if (typeof value !== "string" || !uuid.test(value)) throw new HumanDmError("messages.id_invalid",400);
  return value.toLowerCase();
}
function userId(value: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u.test(v)) throw new HumanDmError("messages.user_id_invalid",400);
  return v;
}
function text(value: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v || v.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v)) {
    throw new HumanDmError("messages.text_invalid",400);
  }
  return v;
}
function limit(value: number | undefined): number {
  if (value === undefined) return 40;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new HumanDmError("messages.limit_invalid",400);
  return value;
}
function cursor(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new HumanDmError("messages.cursor_invalid",400);
  }
  return value;
}
export function createHumanDmService(input: Readonly<{ repository: HumanDmRepository; authorizer: HumanDmAuthorizer }>): HumanDmService {
  async function scope(header: string | undefined) {
    const p = await input.authorizer.authorize({ authorizationHeader: header });
    return { tenantId: p.tenantId, userId: p.userId };
  }
  return Object.freeze<HumanDmService>({
    async open(request) {
      const me = await scope(request.authorizationHeader);
      const otherUserId = userId(request.otherUserId);
      if (me.userId === otherUserId) throw new HumanDmError("messages.self_not_allowed",400);
      const conversationId = await input.repository.open({ ...me, otherUserId });
      if (!conversationId) throw new HumanDmError("messages.contact_unavailable",404);
      return { conversationId };
    },
    async list(request) {
      const me = await scope(request.authorizationHeader);
      const before = request.before;
      if (before !== undefined && (before.length > 150 || Number.isNaN(Date.parse(before)))) {
        throw new HumanDmError("messages.cursor_invalid",400);
      }
      return { conversations: await input.repository.list({ ...me, limit: limit(request.limit), ...(before === undefined ? {} : { before }) }) };
    },
    async history(request) {
      const me = await scope(request.authorizationHeader);
      const messages = await input.repository.history({ ...me, conversationId: id(request.conversationId), limit: limit(request.limit), ...(cursor(request.beforeSequence) === undefined ? {} : { beforeSequence: request.beforeSequence }) });
      if (!messages) throw new HumanDmError("messages.thread_unavailable",404);
      return { messages, nextBeforeSequence: messages.length === limit(request.limit) ? messages[messages.length-1]!.sequence : null };
    },
    async send(request) {
      const me = await scope(request.authorizationHeader);
      const result = await input.repository.send({ ...me, conversationId: id(request.conversationId), clientMessageId: id(request.clientMessageId), text: text(request.text) });
      if (result === "unavailable") throw new HumanDmError("messages.send_forbidden",403);
      if (result === "conflict") throw new HumanDmError("messages.idempotency_conflict",409);
      if (result === "rate_limited") throw new HumanDmError("messages.rate_limited",429);
      return result;
    },
    async read(request) {
      const me = await scope(request.authorizationHeader);
      const upToSequence = cursor(request.upToSequence);
      if (!upToSequence) throw new HumanDmError("messages.cursor_invalid",400);
      const lastReadSequence = await input.repository.read({ ...me, conversationId: id(request.conversationId), upToSequence });
      if (lastReadSequence === null) throw new HumanDmError("messages.thread_unavailable",404);
      return { lastReadSequence };
    },
    async edit(request) {
      const me = await scope(request.authorizationHeader);
      const result = await input.repository.edit({ ...me, conversationId: id(request.conversationId), messageId: id(request.messageId), text: text(request.text) });
      if (!result) throw new HumanDmError("messages.edit_unavailable",403);
      return result;
    },
    async remove(request) {
      const me = await scope(request.authorizationHeader);
      const result = await input.repository.remove({ ...me, conversationId: id(request.conversationId), messageId: id(request.messageId) });
      if (!result) throw new HumanDmError("messages.delete_unavailable",403);
      return result;
    },
  });
}

import type { AgentDirectoryAuthorizer } from "../agent_directory.js";

export interface CallScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly characterIds: readonly string[] | null;
}
export interface CallRecord {
  readonly callId: string;
  readonly characterId: string;
  readonly displayName: string;
  readonly direction: "outgoing" | "incoming";
  readonly kind: "audio";
  readonly state: "connecting" | "active" | "ended" | "expired" | "missed" | "declined" | "cancelled";
  readonly createdAt: string;
  readonly connectedAt: string | null;
  readonly endedAt: string | null;
  readonly expiresAt: string;
  readonly connectionEvidence: "client_report" | null;
}
export interface CallCursor { readonly createdAt: string; readonly callId: string }
export interface CallHistoryRepository {
  list(input: CallScope & { readonly limit: number; readonly cursor: CallCursor | null; readonly query?: string }): Promise<{ readonly calls: readonly CallRecord[]; readonly nextCursor: string | null }>;
  get(input: CallScope & { readonly callId: string }): Promise<CallRecord | null>;
  report(input: CallScope & { readonly callId: string; readonly event: "connected" | "ended" }): Promise<CallRecord | null>;
}
export interface CallHistoryRecorder {
  attachIssued?(input: { readonly tenantId: string; readonly userId: string; readonly characterId: string; readonly callId: string; readonly expiresAt: string }): Promise<string>;
  recordIssued(input: { readonly tenantId: string; readonly userId: string; readonly characterId: string; readonly expiresAt: string }): Promise<string>;
}
export class CallHistoryError extends Error {
  constructor(readonly code: string, readonly statusCode: number) { super(code); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function id(value: string): string {
  if (!uuid.test(value)) throw new CallHistoryError("calls.id_invalid", 400);
  return value;
}
export function encodeCallCursor(cursor: CallCursor, query = ""): string {
  return Buffer.from(JSON.stringify(query
    ? [cursor.createdAt, cursor.callId, query]
    : [cursor.createdAt, cursor.callId])).toString("base64url");
}
function normalizedSearch(value?: string): string {
  const query = (value ?? "").trim().toLowerCase();
  if (query.length > 80 || Buffer.byteLength(query, "utf8") > 240 ||
      /[\u0000-\u001f\u007f]/u.test(query))
    throw new CallHistoryError("calls.query_invalid", 400);
  return query;
}
function decodeCursor(value: string | undefined, query: string): CallCursor | null {
  if (value === undefined) return null;
  try {
    if (!/^[A-Za-z0-9_-]{1,600}$/u.test(value)) throw new Error();
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== (query ? 3 : 2) || (query && decoded[2] !== query) || typeof decoded[0] !== "string" || typeof decoded[1] !== "string") throw new Error();
    if (new Date(decoded[0]).toISOString() !== decoded[0]) throw new Error();
    const result = { createdAt: decoded[0], callId: id(decoded[1]) };
    if (encodeCallCursor(result, query) !== value) throw new Error();
    return result;
  } catch { throw new CallHistoryError("calls.cursor_invalid", 400); }
}
export function createCallHistoryService(input: { readonly repository: CallHistoryRepository; readonly authorizer: AgentDirectoryAuthorizer }) {
  async function scope(authorizationHeader?: string): Promise<CallScope> {
    const actor = await input.authorizer.authorize({ authorizationHeader, capability: "agents.directory.read" });
    return { tenantId: actor.tenantId, userId: actor.userId, characterIds: actor.characterIds ?? null };
  }
  return Object.freeze({
    async list(request: { readonly authorizationHeader?: string; readonly limit?: number; readonly cursor?: string; readonly query?: string }) {
      const actor = await scope(request.authorizationHeader);
      const limit = request.limit ?? 30;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new CallHistoryError("calls.limit_invalid", 400);
      const query = normalizedSearch(request.query);
      return input.repository.list({ ...actor, limit, query, cursor: decodeCursor(request.cursor, query) });
    },
    async get(request: { readonly authorizationHeader?: string; readonly callId: string }) {
      const actor = await scope(request.authorizationHeader);
      const call = await input.repository.get({ ...actor, callId: id(request.callId) });
      if (!call) throw new CallHistoryError("calls.not_found", 404);
      return call;
    },
    async report(request: { readonly authorizationHeader?: string; readonly callId: string; readonly event: "connected" | "ended" }) {
      const actor = await scope(request.authorizationHeader);
      const call = await input.repository.report({ ...actor, callId: id(request.callId), event: request.event });
      if (!call) throw new CallHistoryError("calls.not_found", 404);
      return call;
    },
  });
}
export type CallHistoryService = ReturnType<typeof createCallHistoryService>;

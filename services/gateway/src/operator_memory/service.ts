import { createHash } from "node:crypto";
import { createCanonicalId, parseCanonicalId } from "@masanawa/contracts";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";

/**
 * U05 is an application adapter, never a second memory store. The integrator
 * supplies @masanawa/memory's canonical MemoryRepository and an authenticated,
 * tenant/user-bound private Relationship resolver. No caller may choose a scope.
 */
export class OperatorMemoryError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "OperatorMemoryError";
  }
}

export interface MemoryActor { readonly tenantId: string; readonly userId: string }
export interface MemoryScope { readonly kind: "relationship"; readonly relationshipId: string }
export interface Consent { readonly enabled: boolean; readonly revision: number }
export type MemoryKind = "preference" | "task-checkpoint" | "research-note";
export interface MemorySnapshot {
  readonly record: {
    readonly tenantId: string;
    readonly memoryRecordId: string;
    readonly memoryType: string;
    readonly scope: MemoryScope;
    readonly lifecycleState: string;
    readonly revision: number;
    readonly lifecycleRevision: number;
  };
  readonly currentRevision: {
    readonly memoryRevisionId: string;
    readonly content: string;
    readonly payload: { readonly [key: string]: unknown };
    readonly observedAt: string;
    readonly expiresAt: string | null;
  };
}
export interface CanonicalMemoryPort {
  createMemoryRecord(input: Readonly<Record<string, unknown>>): Promise<MemorySnapshot>;
  appendMemoryRevision(input: Readonly<Record<string, unknown>>): Promise<MemorySnapshot>;
  getMemoryRecordInScope(input: Readonly<{
    tenantId: string; memoryRecordId: string; scope: MemoryScope;
  }>): Promise<MemorySnapshot | null>;
  listMemoryRecordsByScopes(input: Readonly<{
    tenantId: string; scopes: readonly MemoryScope[]; lifecycleStates: readonly string[]; limit: number;
  }>): Promise<readonly MemorySnapshot[]>;
}
export interface ConsentPort {
  get(actor: MemoryActor): Promise<Consent>;
  compareAndSet(input: MemoryActor & {
    readonly expectedRevision: number; readonly enabled: boolean;
  }): Promise<Consent | null>;
}
export interface PrivateScopePort {
  // MUST verify user membership + tenant on current server-side identity graph.
  resolve(actor: MemoryActor): Promise<MemoryScope | null>;
}
export interface GovernedForgetPort {
  // MUST call canonical memory tombstone prepare/approval/execute with current
  // AuthorityContext; cannot just UPDATE lifecycle_state or delete records.
  prepare(input: Readonly<{
    actor: MemoryActor; scope: MemoryScope; snapshot: MemorySnapshot; reason: string;
  }>): Promise<Readonly<{ operationId: string; approvalRequired: true }>>;
}
export interface MemoryView {
  readonly id: string; readonly revision: number; readonly kind: MemoryKind;
  readonly content: string; readonly observedAt: string; readonly expiresAt: string | null;
}
export interface MemoryService {
  consent(input: { authorizationHeader?: string }): Promise<Consent>;
  setConsent(input: { authorizationHeader?: string; enabled: boolean; expectedRevision: number }): Promise<Consent>;
  list(input: { authorizationHeader?: string; forAssistant?: boolean }): Promise<readonly MemoryView[]>;
  remember(input: { authorizationHeader?: string; kind: MemoryKind; content: string; ttlDays: number }): Promise<MemoryView>;
  correct(input: { authorizationHeader?: string; id: string; expectedRevision: number; content: string }): Promise<MemoryView>;
  prepareForget(input: { authorizationHeader?: string; id: string; expectedRevision: number }): Promise<Readonly<{ operationId: string; approvalRequired: true }>>;
}

const kinds = new Set<string>(["preference", "task-checkpoint", "research-note"]);
const MAX_RECORDS = 100;
function invalid(message: string): never { throw new OperatorMemoryError(message, 400); }
function conflict(): never { throw new OperatorMemoryError("MEMORY_REVISION_CHANGED", 409); }
function boundedContent(raw: unknown): string {
  if (typeof raw !== "string") return invalid("MEMORY_INVALID_CONTENT");
  const content = raw.trim();
  if (content.length < 1 || content.length > 512 || /[\u0000-\u001f\u007f]/u.test(content)) {
    return invalid("MEMORY_INVALID_CONTENT");
  }
  return content;
}
function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) return invalid("MEMORY_INVALID_REVISION");
  return value;
}
function validKind(value: string): MemoryKind {
  if (!kinds.has(value)) return invalid("MEMORY_INVALID_KIND");
  return value as MemoryKind;
}
function recordId(value: string): string {
  if (typeof value !== "string") return invalid("MEMORY_INVALID_ID");
  try { return parseCanonicalId("memory-record", value); }
  catch { return invalid("MEMORY_INVALID_ID"); }
}
function asView(record: MemorySnapshot, actor: MemoryActor, scope: MemoryScope): MemoryView | null {
  if (
    record.record.tenantId !== actor.tenantId ||
    record.record.scope.kind !== "relationship" ||
    record.record.scope.relationshipId !== scope.relationshipId ||
    record.record.lifecycleState !== "active" ||
    record.currentRevision.payload.operatorUserId !== actor.userId ||
    !kinds.has(String(record.currentRevision.payload.operatorKind))
  ) return null;
  const expiresAt = record.currentRevision.expiresAt;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return null;
  return Object.freeze({
    id: recordId(record.record.memoryRecordId),
    revision: record.record.revision,
    kind: validKind(String(record.currentRevision.payload.operatorKind)),
    content: record.currentRevision.content,
    observedAt: record.currentRevision.observedAt,
    expiresAt,
  });
}
function evidence(content: string, actor: MemoryActor, at: string) {
  // A hash, not a copied DM or recording. No verbatim source is retained.
  return [{
    sourceKind: "operator" as const,
    sourceReference: "operator-memory:explicit-user-entry:" + actor.userId,
    sourceContentHash: createHash("sha256").update(content, "utf8").digest("hex"),
    observedAt: at,
  }];
}

export function createMemoryService(deps: Readonly<{
  authorizer: PlatformCustomerSessionAuthorizer;
  scopes: PrivateScopePort;
  consent: ConsentPort;
  memory: CanonicalMemoryPort;
  forget?: GovernedForgetPort;
  now?: () => Date;
}>): MemoryService {
  const now = deps.now ?? (() => new Date());
  async function actorAndScope(header?: string): Promise<{ actor: MemoryActor; scope: MemoryScope }> {
    const identity = await deps.authorizer.authorize({ authorizationHeader: header });
    const actor = { tenantId: identity.tenantId, userId: identity.userId };
    const scope = await deps.scopes.resolve(actor);
    if (!scope || scope.kind !== "relationship") {
      throw new OperatorMemoryError("MEMORY_PRIVATE_SCOPE_UNAVAILABLE", 503);
    }
    try { parseCanonicalId("relationship", scope.relationshipId); }
    catch { throw new OperatorMemoryError("MEMORY_PRIVATE_SCOPE_INVALID", 503); }
    return { actor, scope };
  }
  async function requireOptIn(actor: MemoryActor): Promise<void> {
    const consent = await deps.consent.get(actor);
    if (!consent.enabled) throw new OperatorMemoryError("MEMORY_OPT_IN_REQUIRED", 403);
  }
  async function current(id: string, actor: MemoryActor, scope: MemoryScope): Promise<MemorySnapshot> {
    const item = await deps.memory.getMemoryRecordInScope({
      tenantId: actor.tenantId, scope, memoryRecordId: recordId(id),
    });
    if (!item || !asView(item, actor, scope)) {
      throw new OperatorMemoryError("MEMORY_NOT_FOUND", 404);
    }
    return item;
  }
  return Object.freeze({
    async consent({ authorizationHeader }) {
      const { actor } = await actorAndScope(authorizationHeader);
      return deps.consent.get(actor);
    },
    async setConsent({ authorizationHeader, enabled, expectedRevision }) {
      if (typeof enabled !== "boolean") invalid("MEMORY_INVALID_CONSENT");
      const { actor } = await actorAndScope(authorizationHeader);
      const result = await deps.consent.compareAndSet({
        ...actor, enabled, expectedRevision: revision(expectedRevision),
      });
      if (!result) conflict();
      return result;
    },
    async list({ authorizationHeader, forAssistant = false }) {
      const { actor, scope } = await actorAndScope(authorizationHeader);
      // User review remains possible after opt-out; silent agent recall is denied.
      if (forAssistant) await requireOptIn(actor);
      const items = await deps.memory.listMemoryRecordsByScopes({
        tenantId: actor.tenantId, scopes: [scope], lifecycleStates: ["active"], limit: MAX_RECORDS,
      });
      return Object.freeze(items.map(item => asView(item, actor, scope))
        .filter((item): item is MemoryView => item !== null));
    },
    async remember({ authorizationHeader, kind, content, ttlDays }) {
      const { actor, scope } = await actorAndScope(authorizationHeader);
      await requireOptIn(actor);
      const safeKind = validKind(kind);
      const safeContent = boundedContent(content);
      // Refuse unbounded accumulation if the canonical scope contains too many
      // active memories; the authoritative repository alone controls the count.
      const existing = await deps.memory.listMemoryRecordsByScopes({
        tenantId: actor.tenantId, scopes: [scope],
        lifecycleStates: ["active"], limit: MAX_RECORDS,
      });
      if (existing.length >= MAX_RECORDS) {
        throw new OperatorMemoryError("MEMORY_CAP_REACHED", 429);
      }
      if (!Number.isSafeInteger(ttlDays) || ttlDays < 1 || ttlDays > 365) {
        invalid("MEMORY_INVALID_TTL");
      }
      const at = now().toISOString();
      const result = await deps.memory.createMemoryRecord({
        tenantId: actor.tenantId,
        memoryRecordId: createCanonicalId("memory-record"),
        memoryRevisionId: createCanonicalId("memory-revision"),
        memoryType: safeKind === "preference" ? "preference" : safeKind === "task-checkpoint" ? "state" : "summary",
        scope, createdAt: at, content: safeContent,
        payload: { operatorKind: safeKind, operatorUserId: actor.userId },
        confidence: 1, extractionMethod: "user-explicit",
        observedAt: at, expiresAt: new Date(Date.parse(at) + ttlDays * 86_400_000).toISOString(),
        evidence: evidence(safeContent, actor, at),
      });
      const view = asView(result, actor, scope);
      if (!view) throw new OperatorMemoryError("MEMORY_WRITE_NOT_VERIFIED", 503);
      return view;
    },
    async correct({ authorizationHeader, id, expectedRevision, content }) {
      const { actor, scope } = await actorAndScope(authorizationHeader);
      await requireOptIn(actor);
      const safeContent = boundedContent(content);
      const existing = await current(id, actor, scope);
      if (existing.record.revision !== revision(expectedRevision)) conflict();
      const at = now().toISOString();
      const result = await deps.memory.appendMemoryRevision({
        tenantId: actor.tenantId, memoryRecordId: existing.record.memoryRecordId,
        memoryRevisionId: createCanonicalId("memory-revision"),
        expectedRevision, updatedAt: at, content: safeContent,
        payload: existing.currentRevision.payload,
        confidence: 1, extractionMethod: "user-correction",
        observedAt: at, expiresAt: existing.currentRevision.expiresAt,
        evidence: evidence(safeContent, actor, at),
      });
      const view = asView(result, actor, scope);
      if (!view || view.revision <= expectedRevision) {
        throw new OperatorMemoryError("MEMORY_WRITE_NOT_VERIFIED", 503);
      }
      return view;
    },
    async prepareForget({ authorizationHeader, id, expectedRevision }) {
      const { actor, scope } = await actorAndScope(authorizationHeader);
      const existing = await current(id, actor, scope);
      if (existing.record.revision !== revision(expectedRevision)) conflict();
      if (!deps.forget) throw new OperatorMemoryError("MEMORY_FORGET_NOT_QUALIFIED", 503);
      return deps.forget.prepare({
        actor, scope, snapshot: existing, reason: "Explicit authenticated owner forget request",
      });
    },
  });
}

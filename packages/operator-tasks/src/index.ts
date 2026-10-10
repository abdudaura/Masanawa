import { createHash, randomBytes } from "node:crypto";
import { createCanonicalId, parseCanonicalId, type TenantId, type UserId } from "@masanawa/contracts";

export type OperatorTaskPhase =
  | "proposed" | "clarifying" | "prepared" | "awaiting_approval"
  | "running" | "reconciling" | "succeeded" | "failed" | "cancelled";
export type OperatorTaskScope = "private-assistant" | "persona-chat";
export type OperatorOperationClass = "read" | "draft" | "send" | "financial";
export type OperatorDomainOutcome =
  | { readonly status: "confirmed"; readonly receiptRef: string }
  | { readonly status: "rejected"; readonly code: string }
  | { readonly status: "unknown" };

export class OperatorTaskError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "OperatorTaskError";
  }
}

export interface OperatorActor {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  /** SHA-256 of the currently verified access session, generated ONLY server-side. */
  readonly sessionDigest: string;
}

export interface OperatorTaskRecord {
  readonly taskId: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly requestId: string;
  readonly scope: OperatorTaskScope;
  readonly capabilityId: string;
  readonly capabilityVersion: number;
  readonly argumentDigest: string;
  readonly phase: OperatorTaskPhase;
  readonly version: number;
  readonly operationClass: OperatorOperationClass | null;
  readonly operationId: string | null;
  readonly termsDigest: string | null;
  readonly approvalDigest: string | null;
  readonly approvalSessionDigest: string | null;
  readonly approvalExpiresAt: string | null;
  readonly receiptRef: string | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OperatorTaskView = Readonly<Omit<OperatorTaskRecord,
  "argumentDigest" | "approvalDigest" | "approvalSessionDigest" | "termsDigest">>;

export interface OperatorTaskEvent {
  readonly taskId: string;
  readonly version: number;
  readonly phase: OperatorTaskPhase;
  readonly at: string;
  readonly code: string | null;
}

export interface OperatorTaskRepository {
  createOrRead(input: Readonly<{
    actor: OperatorActor;
    task: OperatorTaskRecord;
  }>): Promise<OperatorTaskRecord>;
  read(input: Readonly<{ actor: OperatorActor; taskId: string }>): Promise<OperatorTaskRecord | null>;
  list(input: Readonly<{ actor: OperatorActor; limit: number; before?: string }>): Promise<readonly OperatorTaskRecord[]>;
  events(input: Readonly<{ actor: OperatorActor; taskId: string; afterVersion: number; limit: number }>): Promise<readonly OperatorTaskEvent[]>;
  /** Single serializable/CAS commit: update task and append exactly one immutable event. */
  change(input: Readonly<{
    actor: OperatorActor;
    taskId: string;
    expectedVersion: number;
    allowedFrom: readonly OperatorTaskPhase[];
    patch: Readonly<Partial<Pick<OperatorTaskRecord,
      "phase" | "operationClass" | "operationId" | "termsDigest" | "approvalDigest" |
      "approvalSessionDigest" | "approvalExpiresAt" | "receiptRef" | "errorCode">>>;
    at: string;
  }>): Promise<OperatorTaskRecord>;
}

/** All trusted business checks are delegated to the existing R/C domain authorities. */
export interface OperatorTaskDomain {
  admit(input: Readonly<{
    actor: OperatorActor;
    scope: OperatorTaskScope;
    capabilityId: string;
    capabilityVersion: number;
    arguments: Readonly<Record<string, unknown>>;
  }>): Promise<void>;
  /** Executes at most once from this process after durable admission. Use operationId as the domain idempotency key. */
  /** Revalidate current account, persona, membership, quote, consent and risk. */
  authorizeConfirmation(input: Readonly<{ actor: OperatorActor; task: OperatorTaskRecord }>): Promise<void>;
  execute(input: Readonly<{ actor: OperatorActor; task: OperatorTaskRecord }>): Promise<OperatorDomainOutcome>;
  /** Read-only authoritative status lookup. Must not submit a second side effect. */
  reconcile(input: Readonly<{ actor: OperatorActor; task: OperatorTaskRecord }>): Promise<OperatorDomainOutcome>;
}

export interface OperatorTaskService {
  propose(input: Readonly<{
    actor: OperatorActor;
    requestId: string;
    scope: OperatorTaskScope;
    capabilityId: string;
    capabilityVersion: number;
    arguments: Readonly<Record<string, unknown>>;
  }>): Promise<OperatorTaskView>;
  read(input: Readonly<{ actor: OperatorActor; taskId: string }>): Promise<OperatorTaskView>;
  list(input: Readonly<{ actor: OperatorActor; limit?: number; before?: string }>): Promise<readonly OperatorTaskView[]>;
  events(input: Readonly<{ actor: OperatorActor; taskId: string; afterVersion?: number; limit?: number }>): Promise<readonly OperatorTaskEvent[]>;
  /** Internal trusted adapter ONLY; never map this method to an HTTP request body. */
  prepare(input: Readonly<{
    actor: OperatorActor;
    taskId: string;
    expectedVersion: number;
    operationClass: OperatorOperationClass;
    termsDigest: string;
    approvalExpiresAt: string;
  }>): Promise<Readonly<{ task: OperatorTaskView; approvalToken: string }>>;
  confirm(input: Readonly<{
    actor: OperatorActor;
    taskId: string;
    expectedVersion: number;
    approvalToken: string;
  }>): Promise<OperatorTaskView>;
  /** Internal reconciliation only; must NEVER replay execute(). */
  reconcile(input: Readonly<{ actor: OperatorActor; taskId: string }>): Promise<OperatorTaskView>;
  cancel(input: Readonly<{ actor: OperatorActor; taskId: string; expectedVersion: number }>): Promise<OperatorTaskView>;
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function validDigest(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}
function nowIso(): string { return new Date().toISOString(); }
function validCount(value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new OperatorTaskError("TASK_INVALID_LIMIT", 400);
  }
  return value;
}
function ensureTaskId(taskId: string): string {
  try { return parseCanonicalId("task", taskId); }
  catch { throw new OperatorTaskError("TASK_INVALID_ID", 400); }
}
function expose(record: OperatorTaskRecord): OperatorTaskView {
  const { argumentDigest: _arguments, termsDigest: _terms, approvalDigest: _approval,
    approvalSessionDigest: _session, ...view } = record;
  return Object.freeze(view);
}
function safeCode(code: string): string {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(code)) return "DOMAIN_STATUS_UNAVAILABLE";
  return code;
}
function validateActor(actor: OperatorActor): void {
  try {
    parseCanonicalId("tenant", actor.tenantId);
    parseCanonicalId("user", actor.userId);
  } catch { throw new OperatorTaskError("TASK_UNAUTHORIZED", 401); }
  if (!validDigest(actor.sessionDigest)) throw new OperatorTaskError("TASK_UNAUTHORIZED", 401);
}
function stable(value: unknown, depth = 0): string {
  if (depth > 10) throw new OperatorTaskError("TASK_ARGUMENTS_TOO_DEEP", 400);
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length > 64) throw new OperatorTaskError("TASK_ARGUMENTS_TOO_LARGE", 400);
    return "[" + value.map((item) => stable(item, depth + 1)).join(",") + "]";
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    if (keys.some(key => ["__proto__", "prototype", "constructor"].includes(key))) {
      throw new OperatorTaskError("TASK_INVALID_ARGUMENTS", 400);
    }
    if (keys.length > 64 || Object.getPrototypeOf(object) !== Object.prototype) {
      throw new OperatorTaskError("TASK_INVALID_ARGUMENTS", 400);
    }
    return "{" + keys.map(key => JSON.stringify(key) + ":" + stable(object[key], depth + 1)).join(",") + "}";
  }
  throw new OperatorTaskError("TASK_INVALID_ARGUMENTS", 400);
}
function isTerminal(phase: OperatorTaskPhase): boolean {
  return phase === "succeeded" || phase === "failed" || phase === "cancelled";
}

export function createOperatorTaskService(input: Readonly<{
  repository: OperatorTaskRepository;
  domain: OperatorTaskDomain;
  now?: () => string;
}>): OperatorTaskService {
  const clock = input.now ?? nowIso;

  async function owned(actor: OperatorActor, id: string): Promise<OperatorTaskRecord> {
    validateActor(actor);
    const task = await input.repository.read({ actor, taskId: ensureTaskId(id) });
    if (!task) throw new OperatorTaskError("TASK_NOT_FOUND", 404);
    return task;
  }
  async function transition(
    actor: OperatorActor, task: OperatorTaskRecord, allowedFrom: readonly OperatorTaskPhase[],
    patch: Parameters<OperatorTaskRepository["change"]>[0]["patch"],
  ): Promise<OperatorTaskRecord> {
    try {
      return await input.repository.change({
        actor, taskId: task.taskId, expectedVersion: task.version,
        allowedFrom, patch, at: clock(),
      });
    } catch (error) {
      if (error instanceof OperatorTaskError) throw error;
      throw error;
    }
  }
  async function settle(actor: OperatorActor, task: OperatorTaskRecord,
    outcome: OperatorDomainOutcome): Promise<OperatorTaskRecord> {
    try {
      if (outcome.status === "unknown") {
        if (task.phase === "reconciling") return task;
        return await transition(actor, task, ["running"], {
          phase: "reconciling", errorCode: "DOMAIN_OUTCOME_UNKNOWN",
        });
      }
      if (outcome.status === "confirmed") {
        if (!outcome.receiptRef || outcome.receiptRef.length > 200 ||
            !/^[a-zA-Z0-9:_./-]+$/u.test(outcome.receiptRef)) {
          return await transition(actor, task, ["running", "reconciling"],
            { phase: "reconciling", errorCode: "DOMAIN_RECEIPT_UNVERIFIED" });
        }
        return await transition(actor, task, ["running", "reconciling"],
          { phase: "succeeded", receiptRef: outcome.receiptRef, errorCode: null });
      }
      return await transition(actor, task, ["running", "reconciling"],
        { phase: "failed", errorCode: safeCode(outcome.code) });
    } catch (error) {
      // A recovery worker may have settled the same durable operation while
      // the request was performing its status read. Return the DB truth, never
      // an uncommitted result, and NEVER re-execute the external effect.
      if (!(error instanceof OperatorTaskError) ||
          error.code !== "TASK_REVISION_CONFLICT") throw error;
      const latest = await input.repository.read({ actor, taskId: task.taskId });
      if (!latest || latest.operationId !== task.operationId ||
          latest.capabilityId !== task.capabilityId ||
          latest.version <= task.version ||
          !["running", "reconciling", "succeeded", "failed"].includes(latest.phase)) {
        throw error;
      }
      return latest;
    }
  }

  return Object.freeze<OperatorTaskService>({
    async propose(request) {
      validateActor(request.actor);
      if (!/^[\w.-]{3,96}$/u.test(request.requestId) ||
          !/^[a-z][a-z0-9.-]{2,95}$/u.test(request.capabilityId) ||
          !Number.isSafeInteger(request.capabilityVersion) || request.capabilityVersion < 1 ||
          !["private-assistant", "persona-chat"].includes(request.scope)) {
        throw new OperatorTaskError("TASK_INVALID_PROPOSAL", 400);
      }
      const canonical = stable(request.arguments);
      if (Buffer.byteLength(canonical, "utf8") > 8192) throw new OperatorTaskError("TASK_ARGUMENTS_TOO_LARGE", 400);
      await input.domain.admit({
        actor: request.actor, scope: request.scope, capabilityId: request.capabilityId,
        capabilityVersion: request.capabilityVersion, arguments: request.arguments,
      });
      const at = clock();
      const task: OperatorTaskRecord = {
        taskId: createCanonicalId("task"), tenantId: request.actor.tenantId,
        userId: request.actor.userId, requestId: request.requestId, scope: request.scope,
        capabilityId: request.capabilityId, capabilityVersion: request.capabilityVersion,
        argumentDigest: digest(canonical), phase: "proposed", version: 1,
        operationClass: null, operationId: null, termsDigest: null,
        approvalDigest: null, approvalSessionDigest: null, approvalExpiresAt: null,
        receiptRef: null, errorCode: null, createdAt: at, updatedAt: at,
      };
      const persisted = await input.repository.createOrRead({ actor: request.actor, task });
      if (persisted.capabilityId !== task.capabilityId ||
          persisted.capabilityVersion !== task.capabilityVersion ||
          persisted.scope !== task.scope || persisted.argumentDigest !== task.argumentDigest) {
        throw new OperatorTaskError("TASK_REQUEST_REPLAY_CONFLICT", 409);
      }
      return expose(persisted);
    },
    async read({ actor, taskId }) { return expose(await owned(actor, taskId)); },
    async list({ actor, limit = 25, before }) {
      validateActor(actor);
      if (before) ensureTaskId(before);
      const rows = await input.repository.list({ actor, limit: validCount(limit, 50), ...(before ? { before } : {}) });
      return Object.freeze(rows.map(expose));
    },
    async events({ actor, taskId, afterVersion = 0, limit = 50 }) {
      await owned(actor, taskId);
      if (!Number.isSafeInteger(afterVersion) || afterVersion < 0) {
        throw new OperatorTaskError("TASK_INVALID_CURSOR", 400);
      }
      return input.repository.events({ actor, taskId, afterVersion, limit: validCount(limit, 100) });
    },
    async prepare(request) {
      const current = await owned(request.actor, request.taskId);
      if (current.version !== request.expectedVersion) throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
      if (!validDigest(request.termsDigest) ||
          !["read", "draft", "send", "financial"].includes(request.operationClass)) {
        throw new OperatorTaskError("TASK_INVALID_PREPARATION", 400);
      }
      const expiry = Date.parse(request.approvalExpiresAt);
      if (!Number.isFinite(expiry) || expiry <= Date.parse(clock()) ||
          expiry > Date.parse(clock()) + 15 * 60 * 1000) {
        throw new OperatorTaskError("TASK_APPROVAL_EXPIRY", 400);
      }
      const approvalToken = "ota_" + randomBytes(32).toString("base64url");
      const updated = await transition(request.actor, current, ["proposed", "clarifying", "prepared", "awaiting_approval"], {
        phase: "awaiting_approval", operationClass: request.operationClass,
        operationId: createCanonicalId("operation"), termsDigest: request.termsDigest,
        approvalDigest: digest(approvalToken), approvalSessionDigest: request.actor.sessionDigest,
        approvalExpiresAt: request.approvalExpiresAt, errorCode: null,
      });
      return Object.freeze({ task: expose(updated), approvalToken });
    },
    async confirm(request) {
      const current = await owned(request.actor, request.taskId);
      if (current.version !== request.expectedVersion) throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
      if (current.phase !== "awaiting_approval" || !current.operationId ||
          !current.approvalDigest || current.approvalSessionDigest !== request.actor.sessionDigest ||
          !current.approvalExpiresAt || Date.parse(current.approvalExpiresAt) <= Date.parse(clock()) ||
          !/^ota_[A-Za-z0-9_-]{43}$/u.test(request.approvalToken) ||
          digest(request.approvalToken) !== current.approvalDigest) {
        throw new OperatorTaskError("TASK_APPROVAL_INVALID", 403);
      }
      // Recheck permissions and terms at confirmation; adapters also recheck at the effect.
      await input.domain.authorizeConfirmation({ actor: request.actor, task: current });
      // The authority check may wait for remote policy, consent or quote readback.
      // Never admit an execution after the one-use approval expired during that wait.
      if (Date.parse(current.approvalExpiresAt) <= Date.parse(clock())) {
        throw new OperatorTaskError("TASK_APPROVAL_INVALID", 403);
      }
      // Persist the irrevocable execution admission BEFORE contacting the domain.
      // No API retry may call execute() again once this CAS has succeeded.
      const running = await transition(request.actor, current, ["awaiting_approval"], {
        phase: "running", approvalDigest: null, approvalSessionDigest: null,
      });
      // Execution acknowledgment alone is not proof of success. The domain's
      // separate readback MUST confirm the exact idempotent operation outcome.
      let outcome: OperatorDomainOutcome = { status: "unknown" };
      try {
        await input.domain.execute({ actor: request.actor, task: running });
        outcome = await input.domain.reconcile({ actor: request.actor, task: running });
      } catch {
        outcome = { status: "unknown" };
      }
      return expose(await settle(request.actor, running, outcome));
    },
    async reconcile({ actor, taskId }) {
      const current = await owned(actor, taskId);
      if (isTerminal(current.phase)) return expose(current);
      if (current.phase !== "running" && current.phase !== "reconciling") {
        throw new OperatorTaskError("TASK_NOT_RECONCILABLE", 409);
      }
      let outcome: OperatorDomainOutcome;
      try { outcome = await input.domain.reconcile({ actor, task: current }); }
      catch { outcome = { status: "unknown" }; }
      return expose(await settle(actor, current, outcome));
    },
    async cancel({ actor, taskId, expectedVersion }) {
      const current = await owned(actor, taskId);
      if (current.version !== expectedVersion) throw new OperatorTaskError("TASK_REVISION_CONFLICT", 409);
      return expose(await transition(actor, current,
        ["proposed", "clarifying", "prepared", "awaiting_approval"],
        { phase: "cancelled", approvalDigest: null, approvalSessionDigest: null, errorCode: null }));
    },
  });
}

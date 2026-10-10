/**
 * Account-fenced read-only projection of the ONE canonical U02 operator task journal.
 * Nothing here writes tasks, settles money, creates receipts or grants permissions.
 * The integrator injects U02's real service and a server-only resolver that binds
 * the currently verified access session to U02's actor/session digest.
 */
export type TaskHistoryPrincipal = Readonly<{
  tenantId: string; userId: string; accountId: string; sessionId: string; deviceId: string;
}>;
export type TaskHistoryActor = Readonly<{
  tenantId: string; userId: string; sessionDigest: string;
}>;
export type TaskHistoryPhase =
  | "proposed" | "clarifying" | "prepared" | "awaiting_approval"
  | "running" | "reconciling" | "succeeded" | "failed" | "cancelled";
export type TaskHistoryRecord = Readonly<{
  taskId: string; tenantId: string; userId: string; capabilityId: string;
  capabilityVersion: number; phase: TaskHistoryPhase; version: number;
  operationClass: string | null; receiptRef: string | null; errorCode: string | null;
  updatedAt: string;
}>;
export type TaskHistoryEvent = Readonly<{
  version: number; phase: TaskHistoryPhase; at: string; code: string | null;
}>;
export type TaskHistoryCard = Readonly<{
  taskId: string; capabilityId: string; capabilityVersion: number;
  phase: TaskHistoryPhase; version: number; operationClass: string | null;
  receiptAvailable: boolean; errorCode: string | null; updatedAt: string;
}>;
export class TaskHistoryError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TaskHistoryError";
  }
}
const fail = (code: string, status: number): never => { throw new TaskHistoryError(code, status); };
const phaseSet = new Set<TaskHistoryPhase>([
  "proposed", "clarifying", "prepared", "awaiting_approval",
  "running", "reconciling", "succeeded", "failed", "cancelled",
]);
const safeCode = (v: string | null): string | null =>
  typeof v === "string" && /^[A-Z][A-Z0-9_]{1,63}$/u.test(v) ? v : null;
const safeTaskId = (v: unknown): string =>
  typeof v === "string" && /^task_[A-Za-z0-9_-]{8,128}$/u.test(v)
    ? v : fail("OPERATOR_INVALID_ARGUMENTS", 400);

function project(r: TaskHistoryRecord, actor: TaskHistoryActor): TaskHistoryCard {
  if (r.tenantId !== actor.tenantId || r.userId !== actor.userId) {
    return fail("OPERATOR_FORBIDDEN", 403);
  }
  if (!safeTaskId(r.taskId) || !phaseSet.has(r.phase) ||
      !Number.isSafeInteger(r.version) || r.version < 0 ||
      !Number.isSafeInteger(r.capabilityVersion) || r.capabilityVersion < 1 ||
      typeof r.capabilityId !== "string" || !/^[a-z][a-z0-9._-]{2,96}$/u.test(r.capabilityId) ||
      typeof r.updatedAt !== "string" || !Number.isFinite(Date.parse(r.updatedAt))) {
    return fail("OPERATOR_SOURCE_UNAVAILABLE", 503);
  }
  // A succeeded task without durable domain receipt is NOT proof of execution.
  if (r.phase === "succeeded" && (typeof r.receiptRef !== "string" || !r.receiptRef)) {
    return fail("OPERATOR_SOURCE_UNAVAILABLE", 503);
  }
  return Object.freeze({
    taskId: r.taskId, capabilityId: r.capabilityId,
    capabilityVersion: r.capabilityVersion, phase: r.phase, version: r.version,
    operationClass: r.operationClass, receiptAvailable: r.phase === "succeeded",
    errorCode: safeCode(r.errorCode), updatedAt: r.updatedAt,
  });
}

export function createU04TaskHistory<TActor extends TaskHistoryActor>(input: Readonly<{
  resolveActor(request: Readonly<{
    authorizationHeader: string; principal: TaskHistoryPrincipal;
  }>): Promise<TActor>;
  tasks: Readonly<{
    list(request: Readonly<{ actor: TActor; limit: number }>): Promise<readonly TaskHistoryRecord[]>;
    read(request: Readonly<{ actor: TActor; taskId: string }>): Promise<TaskHistoryRecord>;
    events(request: Readonly<{
      actor: TActor; taskId: string; afterVersion: number; limit: number;
    }>): Promise<readonly TaskHistoryEvent[]>;
  }>;
}>) {
  async function actorFor(authorizationHeader: string, principal: TaskHistoryPrincipal): Promise<TActor> {
    if (!authorizationHeader.startsWith("Bearer ") ||
        ![principal.tenantId, principal.userId, principal.accountId,
          principal.sessionId, principal.deviceId].every(v => typeof v === "string" && v.length > 0)) {
      return fail("OPERATOR_UNAUTHORIZED", 401);
    }
    const actor = await input.resolveActor({ authorizationHeader, principal });
    if (!actor || actor.tenantId !== principal.tenantId || actor.userId !== principal.userId ||
        typeof actor.sessionDigest !== "string" || !/^[0-9a-f]{64}$/u.test(actor.sessionDigest)) {
      return fail("OPERATOR_UNAUTHORIZED", 401);
    }
    return actor;
  }
  return Object.freeze({
    async recent(request: Readonly<{
      authorizationHeader: string; principal: TaskHistoryPrincipal;
    }>): Promise<readonly TaskHistoryCard[]> {
      const actor = await actorFor(request.authorizationHeader, Object.freeze({ ...request.principal }));
      const rows = await input.tasks.list({ actor, limit: 20 });
      if (!Array.isArray(rows) || rows.length > 20) return fail("OPERATOR_SOURCE_UNAVAILABLE", 503);
      return Object.freeze(rows.map(row => project(row, actor)));
    },
    async detail(request: Readonly<{
      authorizationHeader: string; principal: TaskHistoryPrincipal; taskId: string;
    }>): Promise<Readonly<{ task: TaskHistoryCard; events: readonly TaskHistoryEvent[] }>> {
      const taskId = safeTaskId(request.taskId);
      const actor = await actorFor(request.authorizationHeader, Object.freeze({ ...request.principal }));
      const row = await input.tasks.read({ actor, taskId });
      const card = project(row, actor);
      if (card.taskId !== taskId) return fail("OPERATOR_SOURCE_UNAVAILABLE", 503);
      const history = await input.tasks.events({ actor, taskId, afterVersion: 0, limit: 30 });
      if (!Array.isArray(history) || history.length > 30 ||
          history.some(e => !phaseSet.has(e.phase) ||
            !Number.isSafeInteger(e.version) || e.version < 1 || e.version > card.version ||
            typeof e.at !== "string" || !Number.isFinite(Date.parse(e.at)))) {
        return fail("OPERATOR_SOURCE_UNAVAILABLE", 503);
      }
      // Do not expose raw journal/approval metadata or provider receipt reference.
      return Object.freeze({ task: card, events: Object.freeze(history.map(e => Object.freeze({
        version: e.version, phase: e.phase, at: e.at, code: safeCode(e.code),
      }))) });
    },
  });
}

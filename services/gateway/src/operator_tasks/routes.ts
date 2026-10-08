import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { OperatorTaskError, type OperatorActor, type OperatorTaskService } from "@masanawa/operator-tasks";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";

/**
 * Isolated, strictly owner-authenticated task journal HTTP endpoints.
 * Does not expose prepare(), execute(), or internal reconciliation.
 * U04/C07 and Work must compose this only with a real domain authorizer and DB.
 */
export function registerOperatorTaskRoutes(
  app: FastifyInstance,
  dependencies: Readonly<{
    authorizer: PlatformCustomerSessionAuthorizer;
    tasks: OperatorTaskService;
  }>,
): void {
  async function actor(authorizationHeader: string | undefined): Promise<OperatorActor> {
    if (!authorizationHeader || !/^Bearer\s+msw_access_[A-Za-z0-9_-]{40,80}$/u.test(authorizationHeader)) {
      throw new OperatorTaskError("TASK_UNAUTHORIZED", 401);
    }
    const identity = await dependencies.authorizer.authorize({ authorizationHeader });
    return Object.freeze({
      tenantId: identity.tenantId,
      userId: identity.userId,
      sessionDigest: createHash("sha256").update(authorizationHeader).digest("hex"),
    });
  }

  // Encapsulate the task routes and their errors; do not replace Gateway-wide handlers.
  app.register(async scoped => {
  scoped.setErrorHandler((error, _request, reply) => {
    if (error instanceof OperatorTaskError) {
      return reply.code(error.statusCode).send({ code: error.code });
    }
    const statusCode = "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 503;
    return reply.code(statusCode).send({ code: statusCode === 503 ? "TASK_UNAVAILABLE" : "TASK_INVALID_REQUEST" });
  });

  scoped.post("/v1/operator/tasks", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || Object.keys(body).sort().join(",") !==
        ["arguments","capabilityId","capabilityVersion","requestId","scope"].sort().join(",")) {
      throw new OperatorTaskError("TASK_INVALID_PROPOSAL", 400);
    }
    if (typeof body.requestId !== "string" || typeof body.capabilityId !== "string" ||
        typeof body.capabilityVersion !== "number" || typeof body.scope !== "string" ||
        !body.arguments || Array.isArray(body.arguments) ||
        typeof body.arguments !== "object") {
      throw new OperatorTaskError("TASK_INVALID_PROPOSAL", 400);
    }
    const task = await dependencies.tasks.propose({
      actor: await actor(request.headers.authorization), requestId: body.requestId,
      capabilityId: body.capabilityId, capabilityVersion: body.capabilityVersion,
      scope: body.scope as "private-assistant", arguments: body.arguments as Record<string, unknown>,
    });
    return reply.code(201).header("Cache-Control","no-store").send(task);
  });
  scoped.get("/v1/operator/tasks", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some(key=>!["before","limit"].includes(key))) throw new OperatorTaskError("TASK_INVALID_QUERY",400);
    const limit = query.limit === undefined ? 25 : Number(query.limit);
    if (query.before !== undefined && typeof query.before !== "string") throw new OperatorTaskError("TASK_INVALID_CURSOR", 400);
    const tasks = await dependencies.tasks.list({
      actor: await actor(request.headers.authorization), limit,
      ...(typeof query.before === "string" ? { before: query.before } : {}),
    });
    return reply.header("Cache-Control","no-store").send({ tasks });
  });
  scoped.get("/v1/operator/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await dependencies.tasks.read({ actor: await actor(request.headers.authorization), taskId });
    return reply.header("Cache-Control","no-store").send(task);
  });
  scoped.get("/v1/operator/tasks/:taskId/events", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some(key=>!["afterVersion","limit"].includes(key))) throw new OperatorTaskError("TASK_INVALID_QUERY",400);
    const afterVersion = query.afterVersion === undefined ? 0 : Number(query.afterVersion);
    const limit = query.limit === undefined ? 50 : Number(query.limit);
    const events = await dependencies.tasks.events({
      actor: await actor(request.headers.authorization), taskId, afterVersion, limit,
    });
    return reply.header("Cache-Control","no-store").send({ events });
  });
  scoped.post("/v1/operator/tasks/:taskId/cancel", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = request.body as Record<string, unknown> | null;
    if (!body || Object.keys(body).join(",") !== "expectedVersion" ||
        !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) {
      throw new OperatorTaskError("TASK_INVALID_REVISION",400);
    }
    const task = await dependencies.tasks.cancel({
      actor: await actor(request.headers.authorization), taskId, expectedVersion: Number(body.expectedVersion),
    });
    return reply.header("Cache-Control","no-store").send(task);
  });
  scoped.post("/v1/operator/tasks/:taskId/confirm", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = request.body as Record<string, unknown> | null;
    if (!body || Object.keys(body).sort().join(",") !== "approvalToken,expectedVersion" ||
        typeof body.approvalToken !== "string" ||
        !Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) {
      throw new OperatorTaskError("TASK_INVALID_CONFIRMATION",400);
    }
    const task = await dependencies.tasks.confirm({
      actor: await actor(request.headers.authorization), taskId,
      approvalToken: body.approvalToken, expectedVersion: Number(body.expectedVersion),
    });
    return reply.header("Cache-Control","no-store").send(task);
  });
  });
}

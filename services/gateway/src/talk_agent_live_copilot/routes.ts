import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { LiveStageCopilotError, type createLiveStageCopilot } from "./copilot.js";

/**
 * Mount only by the elected shared Gateway integrator, after the proposed
 * U15 migration and authentic R02 worker composition are tested.
 * Request bodies never accept userId, tenantId, Seat price or output text.
 */
export function registerLiveStageCopilotRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createLiveStageCopilot>,
): void {
  const privateResponse = async (_request: unknown, reply: { header(name: string, value: string): unknown }) => {
    reply.header("Cache-Control", "no-store");
  };
  const safeError: NonNullable<Parameters<FastifyInstance["setErrorHandler"]>[0]> = (error, _request, reply) => {
    if (error instanceof LiveStageCopilotError) {
      return reply.code(error.statusCode).send({ error: error.code });
    }
    const status = error !== null && typeof error === "object" && "statusCode" in error
      ? error.statusCode : null;
    if (status === 401 || status === 403) {
      return reply.code(status).send({ error: "talks.host_forbidden" });
    }
    if (status === 400 || status === 413) {
      return reply.code(status).send({ error: "talks.copilot_request_invalid" });
    }
    return reply.code(503).send({ error: "talks.copilot_unavailable" });
  };
  const talkParams = Type.Object({
    talkId: Type.String({ minLength: 1, maxLength: 160 }),
  }, { additionalProperties: false });
  app.get(
    "/v1/talks/:talkId/ai-stage/suggestions",
    { onRequest: privateResponse, errorHandler: safeError, schema: { params: talkParams } },
    async request => {
      const { talkId } = request.params as { talkId: string };
      return { suggestions: await service.suggestions({
        authorizationHeader: request.headers.authorization, talkId,
      }) };
    },
  );
  app.post(
    "/v1/talks/:talkId/ai-stage/seats/:seatId/turns",
    {
      bodyLimit: 8 * 1024,
      onRequest: privateResponse,
      errorHandler: safeError,
      preValidation: async (request, reply) => {
        const body = request.body;
        if (body === null || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).some(key => key !== "requestId" && key !== "hostApprovedTranscript")) {
          return reply.code(400).send({ error: "talks.copilot_request_invalid" });
        }
      },
      schema: {
        params: Type.Object({
          talkId: Type.String({ minLength: 1, maxLength: 160 }),
          seatId: Type.String({ minLength: 1, maxLength: 160 }),
        }, { additionalProperties: false }),
        body: Type.Object({
          requestId: Type.String({ minLength: 1, maxLength: 128 }),
          hostApprovedTranscript: Type.String({ minLength: 1, maxLength: 500 }),
        }, { additionalProperties: false }),
      },
    },
    async (request, reply) => {
      const { talkId, seatId } = request.params as { talkId: string; seatId: string };
      const { requestId, hostApprovedTranscript } = request.body as {
        requestId: string; hostApprovedTranscript: string;
      };
      const result = await service.approveTurn({
        authorizationHeader: request.headers.authorization,
        talkId, seatId, requestId, hostApprovedTranscript,
      });
      if (result.status === "uncertain" || result.status === "in_progress") {
        reply.code(202);
      } else if (result.status === "budget_exhausted") {
        reply.code(429);
      } else if (result.status === "conflict" || result.status === "denied") {
        reply.code(409);
      }
      return result;
    },
  );
}


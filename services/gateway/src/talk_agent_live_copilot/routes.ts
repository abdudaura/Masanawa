import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { createLiveStageCopilot } from "./copilot.js";

/**
 * Mount only by the elected shared Gateway integrator, after the proposed
 * U15 migration and authentic R02 worker composition are tested.
 * Request bodies never accept userId, tenantId, Seat price or output text.
 */
export function registerLiveStageCopilotRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createLiveStageCopilot>,
): void {
  const talkParams = Type.Object({
    talkId: Type.String({ minLength: 1, maxLength: 160 }),
  }, { additionalProperties: false });
  app.get(
    "/talks/:talkId/ai-stage/suggestions",
    { schema: { params: talkParams } },
    async request => {
      const { talkId } = request.params as { talkId: string };
      return { suggestions: await service.suggestions({
        authorizationHeader: request.headers.authorization, talkId,
      }) };
    },
  );
  app.post(
    "/talks/:talkId/ai-stage/seats/:seatId/turns",
    {
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

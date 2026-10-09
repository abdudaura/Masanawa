import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { ReplayInsightService } from "./service.js";
import { ReplayInsightError } from "./service.js";

const Params = Type.Object({ talkId: Type.String({ minLength: 1, maxLength: 160, pattern: "^[A-Za-z0-9_-]+$" }) }, { additionalProperties: false });
export function registerReplayInsightRoutes(app: FastifyInstance, service: ReplayInsightService): void {
  // Deliberately do not install a global Fastify error handler: Gateway owns it.
  app.get("/talks/:talkId/post-session/insights", { schema: { params: Params } }, async (request, reply) => {
    reply.header("cache-control", "no-store").header("vary", "Authorization");
    const { talkId } = request.params as { talkId: string };
    return service.read({ authorizationHeader: request.headers.authorization, talkId });
  });
  app.post("/talks/:talkId/post-session/insights", {
    onRequest: async (_request, reply) => {
      reply.header("cache-control", "no-store").header("vary", "Authorization");
    },
    preValidation: async request => {
      // Reject caller authority before Fastify/AJV removes unknown fields.
      const body = request.body;
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          (body as Record<string, unknown>).processingConsent !== true) {
        throw new ReplayInsightError("talks.insights.invalid_request", 400);
      }
    },
    schema: { params: Params,
      body: Type.Object({ processingConsent: Type.Literal(true) }, { additionalProperties: false }) },
  }, async request => {
    const { talkId } = request.params as { talkId: string };
    return service.request({ authorizationHeader: request.headers.authorization, talkId, processingConsent: true });
  });
}


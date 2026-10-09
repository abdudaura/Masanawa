import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { ReplayInsightService } from "./service.js";

const Params = Type.Object({ talkId: Type.String({ minLength: 1, maxLength: 160, pattern: "^[A-Za-z0-9_-]+$" }) }, { additionalProperties: false });
export function registerReplayInsightRoutes(app: FastifyInstance, service: ReplayInsightService): void {
  // Deliberately do not install a global Fastify error handler: Gateway owns it.
  app.get("/v1/talks/:talkId/post-session/insights", { schema: { params: Params } }, async request => {
    const { talkId } = request.params as { talkId: string };
    return service.read({ authorizationHeader: request.headers.authorization, talkId });
  });
  app.post("/v1/talks/:talkId/post-session/insights", {
    schema: { params: Params,
      body: Type.Object({ processingConsent: Type.Literal(true) }, { additionalProperties: false }) },
  }, async request => {
    const { talkId } = request.params as { talkId: string };
    return service.request({ authorizationHeader: request.headers.authorization, talkId, processingConsent: true });
  });
}

import type { FastifyInstance } from "fastify";
import { createYouTubeWebSubService, YouTubeWebhookError, type YouTubeWebSubStore } from "./service.js";

/**
 * Public provider callback with cryptographic verification, scoped to an opaque
 * token. AF00 registers once; a provider callback must never authenticate as staff.
 * Root app must not add another body parser for application/atom+xml.
 */
export async function registerYouTubeWebSubRoutes(
  app: FastifyInstance,
  options: { store: YouTubeWebSubStore },
): Promise<void> {
  const handler = createYouTubeWebSubService(options.store);
  app.addContentTypeParser(["application/atom+xml", "application/xml"], {parseAs:"buffer", bodyLimit:65536},
    (_request, body, done) => done(null, body));
  app.get<{Params: {subscriptionToken:string}; Querystring: Record<string, string>}>(
    "/v1/webhooks/youtube/:subscriptionToken", async (request, reply) => {
      try {
        const answer = await handler.verifyChallenge(request.params.subscriptionToken, request.query);
        return reply.code(200).header("content-type", "text/plain; charset=utf-8").send(answer);
      } catch (error) {
        if (error instanceof YouTubeWebhookError) return reply.code(error.status).send({code:error.reason});
        throw error;
      }
    },
  );
  app.post<{Params: {subscriptionToken:string}}>("/v1/webhooks/youtube/:subscriptionToken",
    {bodyLimit:65536}, async (request, reply) => {
      try {
        if (!Buffer.isBuffer(request.body)) return reply.code(415).send({code:"invalid_content_type"});
        const signature = request.headers["x-hub-signature"];
        const result = await handler.notify(request.params.subscriptionToken, request.body,
          typeof signature === "string" ? signature : undefined);
        return reply.code(202).send(result);
      } catch (error) {
        if (error instanceof YouTubeWebhookError) return reply.code(error.status).send({code:error.reason});
        throw error;
      }
    });
}

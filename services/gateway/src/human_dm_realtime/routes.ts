import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HumanDmRealtimeService } from "./service.js";

/** Mounted by Gateway integration owner after C01 + C02 migrations/composition. */
export function registerHumanDmRealtimeRoutes(
  app: FastifyInstance, service: HumanDmRealtimeService,
): void {
  app.get("/messages/sync", {
    schema: {
      querystring: Type.Object({
        cursor: Type.Optional(Type.String({ minLength:1,maxLength:19 })),
        limit: Type.Optional(Type.Integer({ minimum:1,maximum:100 })),
        waitMs: Type.Optional(Type.Integer({ minimum:0,maximum:15000 })),
      },{ additionalProperties:false }),
    },
  }, async (request,reply) => {
    reply.header("Cache-Control","private, no-store");
    reply.header("Vary","Authorization");
    // A disconnected HTTP client must not occupy a long-poll worker until
    // its full wait window ends. No GET causes read receipt side effects.
    let closed = false;
    const onClose = () => { closed = true; };
    reply.raw.once("close",onClose);
    try {
      const query = request.query as {
        cursor?:string; limit?:number; waitMs?:number;
      };
      return await service.sync({
        authorizationHeader:request.headers.authorization,
        ...query,
        shouldStop:() => closed || request.raw.aborted,
      });
    } finally {
      reply.raw.removeListener("close",onClose);
    }
  });
}

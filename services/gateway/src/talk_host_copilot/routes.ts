import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { HostPrepService } from "./service.js";

const Params = Type.Object({ prepId: Type.String({ minLength: 36, maxLength: 36 }) }, { additionalProperties: false });
const Body = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 160 }),
  topic: Type.String({ minLength: 1, maxLength: 240 }),
  questions: Type.Array(Type.String({ minLength: 1, maxLength: 240 }), { maxItems: 8 }),
}, { additionalProperties: false });
const Edit = Type.Object({
  revision: Type.Integer({ minimum: 1 }), title: Type.String({ minLength: 1, maxLength: 160 }),
  topic: Type.String({ minLength: 1, maxLength: 240 }),
  questions: Type.Array(Type.String({ minLength: 1, maxLength: 240 }), { maxItems: 8 }),
}, { additionalProperties: false });

/** Isolated composition seam. Must be mounted only by elected Gateway integrator after
 * U14 schema is sequenced, actor auth is wired and native/device tests run. */
export function registerHostPrepRoutes(app: FastifyInstance, service: HostPrepService): void {
  app.get("/v1/talk-host-preparations", async (request) =>
    service.list({ authorizationHeader: request.headers.authorization }));
  app.post("/v1/talk-host-preparations", { schema: { body: Body } }, async (request, reply) => {
    const body = request.body as { title: string; topic: string; questions: string[] };
    const created = await service.create({ authorizationHeader: request.headers.authorization, ...body });
    reply.code(201);
    return created;
  });
  app.get("/v1/talk-host-preparations/:prepId", {
    schema: { params: Params },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    return service.get({ authorizationHeader: request.headers.authorization, prepId });
  });
  app.put("/v1/talk-host-preparations/:prepId", {
    schema: { params: Params, body: Edit },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    const body = request.body as { revision: number; title: string; topic: string; questions: string[] };
    return service.edit({ authorizationHeader: request.headers.authorization, prepId, ...body });
  });
  app.post("/v1/talk-host-preparations/:prepId/go-live", {
    schema: {
      params: Params,
      body: Type.Object({
        revision: Type.Integer({ minimum: 1 }),
        confirmGoLive: Type.Literal(true),
      }, { additionalProperties: false }),
    },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    const body = request.body as { revision: number; confirmGoLive: true };
    return service.goLive({ authorizationHeader: request.headers.authorization, prepId, ...body });
  });
  app.post("/v1/talk-host-preparations/:prepId/verify", {
    schema: { params: Params, body: Type.Object({}, { additionalProperties: false }) },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    return service.verify({ authorizationHeader: request.headers.authorization, prepId });
  });
  app.get("/v1/talk-host-preparations/:prepId/experts", {
    schema: { params: Params },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    return service.availableExperts({ authorizationHeader: request.headers.authorization, prepId });
  });
  app.post("/v1/talk-host-preparations/:prepId/expert-quote", {
    schema: {
      params: Params,
      body: Type.Object({ personaId: Type.String({ minLength: 1, maxLength: 160 }) },
        { additionalProperties: false }),
    },
  }, async (request) => {
    const { prepId } = request.params as { prepId: string };
    const { personaId } = request.body as { personaId: string };
    return service.quoteExpert({ authorizationHeader: request.headers.authorization, prepId, personaId });
  });
}
import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { CallHistoryService } from "./service.js";
import { CallHistoryError } from "./service.js";

function onlyKeys(value: unknown, allowed: readonly string[]): void {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw new CallHistoryError("calls.invalid_request", 400);
  }
}

const params = Type.Object({ callId: Type.String({ minLength: 36, maxLength: 36 }) }, { additionalProperties: false });
export function registerCallHistoryRoutes(app: FastifyInstance, service: CallHistoryService): void {
  app.get("/v1/calls", { preValidation: async request => onlyKeys(request.query, ["limit", "cursor", "q"]), schema: { querystring: Type.Object({
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 600 })),
    q: Type.Optional(Type.String({ maxLength: 80 })),
  }, { additionalProperties: false }) } }, async (request) => {
    const query = request.query as { limit?: number; cursor?: string; q?: string };
    return service.list({
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.q === undefined ? {} : { query: query.q }),
      ...(request.headers.authorization ? { authorizationHeader: request.headers.authorization } : {}),
    });
  });
  app.get("/v1/calls/:callId", { schema: { params } }, async (request) => {
    const { callId } = request.params as { callId: string };
    return service.get({ callId, ...(request.headers.authorization ? { authorizationHeader: request.headers.authorization } : {}) });
  });
  for (const [path, event] of [["connected", "connected"], ["end", "ended"]] as const) {
    app.post(`/v1/calls/:callId/${path}`, { preValidation: async request => onlyKeys(request.body, []), schema: { params, body: Type.Object({}, { additionalProperties: false }) } }, async (request) => {
      const { callId } = request.params as { callId: string };
      return service.report({ callId, event, ...(request.headers.authorization ? { authorizationHeader: request.headers.authorization } : {}) });
    });
  }
}

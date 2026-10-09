
import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { CustomerAuthError } from "../customer_auth.js";
import { strictRequestBody } from "../strict_request_body.js";
import { SupportError, type SupportOperationKind } from "./model.js";
import type { CustomerSupportService } from "./service.js";

const operationKind = Type.Union([Type.Literal("billing_quote"), Type.Literal("crypto_intent")]);
const ticketKind = Type.Union([Type.Literal("general"), Type.Literal("billing_quote"), Type.Literal("crypto_intent")]);

export function registerCustomerSupportRoutes(app: FastifyInstance, service: CustomerSupportService): void {
  const failure = (error: unknown, reply: { code(status: number): unknown }) => {
    if (error instanceof SupportError) {
      reply.code(error.statusCode);
      return { error: error.code };
    }
    if (error instanceof CustomerAuthError) {
      reply.code(error.statusCode);
      return { error: error.statusCode === 401 ? "SUPPORT_UNAUTHORIZED" : "SUPPORT_UNAVAILABLE" };
    }
    reply.code(503);
    return { error: "SUPPORT_UNAVAILABLE" };
  };
  // POST is intentionally READ-ONLY. Keep sensitive references out of URLs,
  // browser history, intermediary access logs and caches.
  app.post("/v1/support/operations/status", {
    preValidation: strictRequestBody(["kind", "reference"]),
    schema: { body: Type.Object({
      kind: operationKind, reference: Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_.-]+$" }),
    }, { additionalProperties: false }) },
  }, async (request, reply) => {
    try {
      const body = request.body as { kind: SupportOperationKind; reference: string };
      reply.header("Cache-Control", "no-store");
      return await service.status({ authorizationHeader: request.headers.authorization, ...body });
    } catch (error) { return failure(error, reply); }
  });

  app.post("/v1/support/tickets", {
    preValidation: async (request) => {
      await strictRequestBody(["requestKey", "kind", "reference", "summary", "shareWithSupport"])(request);
      const body = request.body as { shareWithSupport?: unknown } | null;
      if (body && typeof body.shareWithSupport !== "boolean") {
        throw Object.assign(new Error("Invalid consent"), { statusCode: 400 });
      }
    },
    schema: { body: Type.Object({
      requestKey: Type.String({ format: "uuid" }), kind: ticketKind,
      reference: Type.Optional(Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_.-]+$" })),
      summary: Type.String({ minLength: 20, maxLength: 1000 }),
      shareWithSupport: Type.Boolean(),
    }, { additionalProperties: false }) },
  }, async (request, reply) => {
    try {
      return await service.create({
        authorizationHeader: request.headers.authorization,
        ...request.body as { requestKey: string; kind: "general" | SupportOperationKind; reference?: string; summary: string; shareWithSupport: boolean },
      });
    } catch (error) { return failure(error, reply); }
  });

  app.get("/v1/support/tickets", {
    preValidation: async (request) => {
      if (Object.keys(request.query as object).some((field) => field !== "limit")) {
        throw Object.assign(new Error("Invalid request"), { statusCode: 400 });
      }
    },
    schema: { querystring: Type.Object({
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    }, { additionalProperties: false }) },
  }, async (request, reply) => {
    try {
      const query = request.query as { limit?: number };
      return { tickets: await service.list({ authorizationHeader: request.headers.authorization, limit: query.limit ?? 30 }) };
    } catch (error) { return failure(error, reply); }
  });

  app.get("/v1/support/tickets/:id", {
    schema: { params: Type.Object({ id: Type.String({ format: "uuid" }) }, { additionalProperties: false }) },
  }, async (request, reply) => {
    try {
      const params = request.params as { id: string };
      return await service.read({ authorizationHeader: request.headers.authorization, id: params.id });
    } catch (error) { return failure(error, reply); }
  });
}


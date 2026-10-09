import type { FastifyInstance } from "fastify";
import Type from "typebox";
import {
  U04ReadError, type U04AuthorizedRead, type U04Principal,
  type U04ReadResult,
} from "./read_service.js";

/**
 * U04 isolated route factory. The U01 proposal authorizer MUST:
 * - resolve principal/region/scope ONLY from server-authenticated session,
 * - call U01.parseOperatorProposal + authorizeOperatorProposal,
 * - enforce real capability predicates and resource context admission.
 * Model/client-provided tenant, user, role, account, session and region are
 * never honored here. This remains unmounted until U01 + F18 composition.
 */
export interface U04ReadRouteAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
    proposal: unknown;
  }>): Promise<Readonly<{
    principal: U04Principal;
    authorized: U04AuthorizedRead;
  }>>;
}
export interface U04RouteReader {
  read(input: Readonly<{
    authorizationHeader: string | undefined;
    principal: U04Principal;
    authorized: U04AuthorizedRead;
  }>): Promise<U04ReadResult>;
}

export function registerU04ReadRoutes(
  app: FastifyInstance,
  input: Readonly<{
    authorizer: U04ReadRouteAuthorizer;
    reader: U04RouteReader;
  }>,
): void {
  app.post("/operator/v1/read", {
    bodyLimit: 12 * 1024,
    onRequest: async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
    },
    // Fastify's default AJV configuration removes additional properties.
    // Check the parsed body before schema validation can erase hostile fields.
    preValidation: async (request, reply) => {
      const body = request.body;
      if (body === null || typeof body !== "object" || Array.isArray(body) ||
          !Object.hasOwn(body, "proposal") ||
          Object.keys(body).some(key => key !== "proposal")) {
        return reply.code(400).send({ error: "OPERATOR_INVALID_PROPOSAL" });
      }
    },
    schema: {
      body: Type.Object({ proposal: Type.Unknown() }, { additionalProperties: false }),
    },
  }, async (request, reply) => {
    try {
      const { proposal } = request.body as { proposal: unknown };
      const authorized = await input.authorizer.authorize({
        authorizationHeader: request.headers.authorization,
        proposal,
      });
      return await input.reader.read({
        authorizationHeader: request.headers.authorization,
        principal: authorized.principal,
        authorized: authorized.authorized,
      });
    } catch (error) {
      // Only typed public errors escape; never serialize provider/DB details.
      const record = error !== null && typeof error === "object" ? error as {
        name?: unknown; code?: unknown; statusCode?: unknown;
      } : {};
      let safe: U04ReadError;
      if (error instanceof U04ReadError) safe = error;
      else if (record.name === "OperatorContractError") {
        if (record.code === "not_authorized") safe = new U04ReadError("OPERATOR_FORBIDDEN", 403);
        else if (record.code === "not_qualified") safe = new U04ReadError("OPERATOR_NOT_QUALIFIED", 503);
        else safe = new U04ReadError("OPERATOR_INVALID_PROPOSAL", 400);
      } else if (record.statusCode === 401) safe = new U04ReadError("OPERATOR_UNAUTHORIZED", 401);
      else if (record.statusCode === 403) safe = new U04ReadError("OPERATOR_FORBIDDEN", 403);
      else if (record.statusCode === 429) safe = new U04ReadError("OPERATOR_RATE_LIMITED", 429);
      else safe = new U04ReadError("OPERATOR_SOURCE_UNAVAILABLE", 503);
      reply.code(safe.statusCode);
      return Object.freeze({ error: safe.code });
    }
  });
}


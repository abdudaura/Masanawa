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
      const safe = error instanceof U04ReadError ? error :
        new U04ReadError("OPERATOR_UNAUTHORIZED", 401);
      reply.code(safe.statusCode);
      return Object.freeze({ error: safe.code });
    }
  });
}

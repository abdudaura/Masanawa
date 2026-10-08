import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { InternalCryptoTransferService } from "./internal_crypto_transfer.js";

const request = Type.Object({
  requestId: Type.String({ minLength: 40, maxLength: 80 }),
  recipient: Type.String({ minLength: 3, maxLength: 320 }),
  providerCode: Type.String({ minLength: 2, maxLength: 32 }),
  amount: Type.String({ minLength: 1, maxLength: 80 }),
}, { additionalProperties: false });
const idParams = Type.Object({
  requestId: Type.String({ minLength: 40, maxLength: 80 }),
}, { additionalProperties: false });
const consentBody = Type.Object({
  confirmationToken: Type.String({ pattern: "^[0-9a-f]{64}$" }),
}, { additionalProperties: false });

function failure(error: unknown, reply: { code(status: number): unknown }) {
  const code = error instanceof Error ? error.message : "crypto.transfer.unavailable";
  const safe = code.startsWith("crypto.") ? code : "crypto.transfer.unavailable";
  const status =
    safe.includes("not_found") ? 404 :
    safe.includes("insufficient") ? 409 :
    safe.includes("approval_invalid") ? 403 :
    safe.includes("request_conflict") ? 409 :
    safe.includes("quote_unavailable") || safe.includes("account_unavailable") ||
    safe.includes("deletion_pending") || safe.includes("limit_reached") ||
    safe.includes("self_forbidden") ? 409 :
    safe.includes("route_unavailable") || safe.includes("not_qualified") ||
    safe.includes("custody_unavailable") ? 503 :
    safe.includes("invalid") ? 422 : 503;
  reply.code(status);
  return { error: safe };
}
export function registerInternalCryptoTransferRoutes(
  app: FastifyInstance,
  service: InternalCryptoTransferService,
): void {
  app.post("/v1/financial/crypto/internal-transfers/quotes",
    { schema: { body: request } },
    async (req, reply) => {
      try {
        return await service.quote({
          authorizationHeader: req.headers.authorization,
          ...req.body,
        });
      } catch (error) { return failure(error, reply); }
    });
  app.get("/v1/financial/crypto/internal-transfers/:requestId",
    { schema: { params: idParams } },
    async (req, reply) => {
      try {
        const value = await service.read({
          authorizationHeader: req.headers.authorization,
          requestId: req.params.requestId,
        });
        if (!value) { reply.code(404); return { error: "crypto.transfer.quote_not_found" }; }
        return value;
      } catch (error) { return failure(error, reply); }
    });
  app.post("/v1/financial/crypto/internal-transfers/:requestId/confirm",
    { schema: { params: idParams, body: consentBody } },
    async (req, reply) => {
      try {
        const result = await service.confirm({
          authorizationHeader: req.headers.authorization,
          requestId: req.params.requestId,
          confirmationToken: req.body.confirmationToken,
        });
        // Fail closed for guessed or invalid tokens even though the durable
        // attempt counter itself is committed on PostgreSQL.
        if (result.status !== "completed") {
          reply.code(409);
        }
        return result;
      } catch (error) { return failure(error, reply); }
    });
}

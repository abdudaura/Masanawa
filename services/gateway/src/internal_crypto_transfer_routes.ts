import type { FastifyInstance, FastifyReply } from "fastify";
import {
  InternalCryptoTransferError,
  type InternalCryptoTransferService,
} from "./internal_crypto_transfer.js";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InternalCryptoTransferError("crypto.internal.invalid_body", 400);
  return value as Record<string, unknown>;
}
function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0 || value.length > 128)
    throw new InternalCryptoTransferError("crypto.internal.invalid_" + key, 400);
  return value;
}
function respondError(reply: FastifyReply, error: unknown) {
  if (error instanceof InternalCryptoTransferError)
    return reply.code(error.statusCode).send({ code: error.code });
  const code = error instanceof Error ? error.message : "";
  if (code === "financial.auth.unauthorized")
    return reply.code(401).send({ code: "crypto.internal.unauthorized" });
  if (code === "crypto.amount.invalid" || code === "crypto.asset.invalid" ||
      code === "crypto.network.invalid" || code === "crypto.internal.self_transfer" ||
      code.startsWith("crypto.internal.request_") ||
      code.startsWith("crypto.internal.recipient_")) {
    return reply.code(400).send({ code });
  }
  if (code === "crypto.internal.recipient_unavailable")
    return reply.code(404).send({ code: "crypto.internal.recipient_unavailable" });
  if (code === "crypto.internal.account_inactive")
    return reply.code(403).send({ code: "crypto.internal.account_inactive" });
  if (code === "crypto.insufficient_balance")
    return reply.code(409).send({ code });
  if (code === "crypto.internal.quote_expired" ||
      code === "crypto.internal.quote_already_used" ||
      code === "crypto.internal.replay_conflict" ||
      code === "crypto.internal.quote_replay_conflict" ||
      code === "crypto.internal.policy_changed")
    return reply.code(409).send({ code });
  if (code === "crypto.internal.quote_not_found")
    return reply.code(404).send({ code });
  // Unknown provider/SQL failures are never returned verbatim.
  return reply.code(503).send({ code: "crypto.internal.temporarily_unavailable" });
}
export function registerInternalCryptoTransferRoutes(
  app: FastifyInstance,
  service: InternalCryptoTransferService,
): void {
  app.get("/v1/financial/crypto/internal/capabilities", async (request, reply) => {
    try {
      return await service.capabilities({
        authorizationHeader: request.headers.authorization,
      });
    } catch (error) { return respondError(reply, error); }
  });
  app.post("/v1/financial/crypto/internal/quotes", async (request, reply) => {
    try {
      const body = object(request.body);
      return await service.quote({
        authorizationHeader: request.headers.authorization,
        quoteRequestId: stringField(body, "quoteRequestId"),
        recipientUserId: stringField(body, "recipientUserId"),
        providerCode: stringField(body, "providerCode"),
        amount: stringField(body, "amount"),
      });
    } catch (error) { return respondError(reply, error); }
  });
  app.post("/v1/financial/crypto/internal/transfers", async (request, reply) => {
    try {
      const body = object(request.body);
      return await service.transfer({
        authorizationHeader: request.headers.authorization,
        requestId: stringField(body, "requestId"),
        quoteId: stringField(body, "quoteId"),
        confirmed: body.confirmed === true,
      });
    } catch (error) { return respondError(reply, error); }
  });
  app.get("/v1/financial/crypto/internal/requests/:requestId", async (request, reply) => {
    try {
      const params = object(request.params);
      const receipt = await service.readByRequest({
        authorizationHeader: request.headers.authorization,
        requestId: stringField(params, "requestId"),
      });
      return receipt ?? reply.code(404).send({ code: "crypto.internal.not_found" });
    } catch (error) { return respondError(reply, error); }
  });
  app.get("/v1/financial/crypto/internal/transfers/:transferId", async (request, reply) => {
    try {
      const params = object(request.params);
      const receipt = await service.read({
        authorizationHeader: request.headers.authorization,
        transferId: stringField(params, "transferId"),
      });
      return receipt ?? reply.code(404).send({ code: "crypto.internal.not_found" });
    } catch (error) { return respondError(reply, error); }
  });
  app.get("/v1/financial/crypto/internal/history", async (request, reply) => {
    try {
      const query = object(request.query);
      const limit = query.limit === undefined ? 50 : Number(query.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new InternalCryptoTransferError("crypto.internal.invalid_limit", 400);
      return { transfers: await service.history({
        authorizationHeader: request.headers.authorization, limit,
      }) };
    } catch (error) { return respondError(reply, error); }
  });
}

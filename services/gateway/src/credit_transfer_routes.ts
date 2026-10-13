import type { FastifyInstance } from "fastify";
import type { CreditTransferService } from "./credit_transfer.js";
import type { GiftService } from "./gifts.js";

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value.trim();
}

function amount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1_000_000_000_000) {
    throw new TypeError("Invalid amountCredits");
  }
  return parsed;
}

export function registerCreditTransferRoutes(
  app: FastifyInstance,
  service: CreditTransferService,
  enabled: () => boolean = () => false,
): void {
  app.post("/v1/wallet/transfers", async (request, reply) => {
    // A registered endpoint is not authorization to execute money movement.
    // The operator-only server gate precedes parsing, identity resolution and
    // any idempotent credit-ledger write.
    if (!enabled()) {
      return reply.code(503).send({
        code: "WALLET_SEND_DISABLED",
        message: "Credits transfers are not available yet.",
      });
    }
    const body = request.body as Record<string, unknown>;
    return service.transfer({
      authorizationHeader: request.headers.authorization,
      requestId: text(body.requestId, "requestId"),
      recipient: text(body.recipient, "recipient"),
      amountCredits: amount(body.amountCredits),
    });
  });
}

export function registerGiftRoutes(
  app: FastifyInstance,
  service: GiftService,
): void {
  app.post("/v1/twins/:characterId/gifts", async (request) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, unknown>;
    return service.gift({
      authorizationHeader: request.headers.authorization,
      requestId: text(body.requestId, "requestId"),
      characterId: text(params.characterId, "characterId"),
      amountCredits: amount(body.amountCredits),
    });
  });
}

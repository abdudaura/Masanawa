import type { FastifyInstance } from "fastify";
import type { WalletProjectionService } from "./wallet_projection.js";

export function registerWalletProjectionRoutes(
  app: FastifyInstance,
  service: WalletProjectionService,
): void {
  app.get("/v1/wallet", async (request) => {
    const query = request.query as Record<string, unknown>;
    const raw = query.limit;
    let limit: number | undefined;
    if (raw !== undefined) {
      const parsed = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new TypeError("Invalid wallet history limit");
      }
      limit = parsed;
    }
    return service.read({
      authorizationHeader: request.headers.authorization,
      ...(limit === undefined ? {} : { limit }),
    });
  });
}

import type { FastifyInstance } from "fastify";
import type { MsnBalance } from "./store.js";

export interface MsnBalanceAuthority {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<{ readonly tenantId: string; readonly userId: string }>;
}
export interface MsnBalanceReader {
  readBalance(tenantId: string, userId: string): Promise<MsnBalance>;
}

/**
 * Read-only authenticated MSN endpoint. Composition is deliberately optional:
 * migration, financial reserve qualification and the final finance owner must
 * be verified before enabling this in main.ts/app.ts. No mint/send/transfer
 * endpoint accepts a user-provided proof or privileged issue operation.
 */
export function registerMsnBalanceRoutes(
  app: FastifyInstance,
  deps: { readonly authorizer: MsnBalanceAuthority; readonly ledger: MsnBalanceReader },
): void {
  app.get("/v1/wallet/msn", async (request, reply) => {
    let owner: { readonly tenantId: string; readonly userId: string };
    try {
      owner = await deps.authorizer.authorize({
        authorizationHeader: request.headers.authorization,
      });
    } catch (error) {
      if (error instanceof Error && "statusCode" in error &&
          error.statusCode === 503) {
        reply.code(503);
        return { error: "msn.auth_unavailable" };
      }
      reply.code(401);
      return { error: "msn.auth_required" };
    }
    if (!owner.tenantId || !owner.userId) {
      reply.code(401);
      return { error: "msn.auth_required" };
    }
    try {
      const value = await deps.ledger.readBalance(owner.tenantId, owner.userId);
      if (value.asset !== "MSN" || !/^(0|[1-9][0-9]*)$/.test(value.spendableMicro))
        throw new Error("msn.balance.invalid");
      return Object.freeze({
        asset: "MSN" as const,
        spendableMicro: value.spendableMicro,
      });
    } catch {
      reply.code(503);
      return { error: "msn.balance_unavailable" };
    }
  });
}

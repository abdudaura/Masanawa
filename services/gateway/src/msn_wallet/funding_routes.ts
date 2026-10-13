import type { FastifyInstance } from "fastify";
import type { MsnBalanceAuthority } from "./routes.js";
import type { MsnFundingStatus } from "./quote_journal.js";

export interface MsnFundingStatusReader {
  listStatus(tenantId: string, userId: string): Promise<readonly MsnFundingStatus[]>;
}

/** Read-only, owner-authorized funding status, not a fiat-wallet balance.
 * Never expose saveQuote(), verifyFiat(), issuance or a provider secret here.
 */
export function registerMsnFundingStatusRoutes(
  app: FastifyInstance,
  deps: Readonly<{authorizer:MsnBalanceAuthority;reader:MsnFundingStatusReader}>,
): void {
  app.get("/v1/wallet/msn/funding", async(request,reply) => {
    let identity: {tenantId:string;userId:string};
    try {
      identity=await deps.authorizer.authorize({
        authorizationHeader:request.headers.authorization,
      });
    } catch(error) {
      const unavailable = error instanceof Error && "statusCode" in error &&
        error.statusCode===503;
      reply.code(unavailable?503:401);
      return {error:unavailable?"msn.funding.auth_unavailable":"msn.funding.auth_required"};
    }
    if (!identity?.tenantId || !identity.userId) {
      reply.code(401);
      return {error:"msn.funding.auth_required"};
    }
    try {
      const entries=await deps.reader.listStatus(identity.tenantId,identity.userId);
      if (!Array.isArray(entries) || entries.length>20 ||
          entries.some(x=>!x || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(x.quoteId) ||
            !["awaiting_verified_funding","fiat_verified_backing_pending","backed_issued"].includes(x.state)))
        throw new Error("msn.funding.invalid_readback");
      return {items:entries};
    } catch {
      reply.code(503);
      return {error:"msn.funding.unavailable"};
    }
  });
}

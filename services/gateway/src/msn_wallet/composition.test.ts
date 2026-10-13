import { describe, expect, it } from "vitest";
import { createGatewayApp } from "../app.js";

describe("MSN optional Gateway composition", () => {
  it("does not register an MSN endpoint on normal deployments", async () => {
    const app = createGatewayApp();
    const response = await app.inject({ method: "GET", url: "/v1/wallet/msn" });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("requires authenticated authority and never trusts caller tenant/user", async () => {
    const seen: string[] = [];
    const app = createGatewayApp({
      msnBalance: {
        authorizer: {
          async authorize({ authorizationHeader }) {
            if (authorizationHeader !== "Bearer trusted") throw new Error("no session");
            return { tenantId: "tenant-authorized", userId: "fan-authorized" };
          },
        },
        ledger: {
          async readBalance(tenantId, userId) {
            seen.push(tenantId, userId);
            return { asset: "MSN", spendableMicro: "1234567" };
          },
        },
      },
    });
    const denied = await app.inject({
      method: "GET", url: "/v1/wallet/msn",
      headers: { authorization: "Bearer forged" },
    });
    expect(denied.statusCode).toBe(401);
    expect(seen).toEqual([]);
    const good = await app.inject({
      method: "GET", url: "/v1/wallet/msn",
      headers: { authorization: "Bearer trusted" },
    });
    expect(good.statusCode).toBe(200);
    expect(JSON.parse(good.body)).toEqual({
      asset: "MSN", spendableMicro: "1234567",
    });
    expect(seen).toEqual(["tenant-authorized", "fan-authorized"]);
    await app.close();
  });
});

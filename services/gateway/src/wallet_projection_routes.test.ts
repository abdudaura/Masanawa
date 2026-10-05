import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { WalletProjectionService } from "./wallet_projection.js";
import { registerWalletProjectionRoutes } from "./wallet_projection_routes.js";

const apps = new Array<ReturnType<typeof Fastify>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("wallet projection routes", () => {
  it("forwards authorization to the Wallet projection", async () => {
    let authorizationHeader: string | undefined;
    const service: WalletProjectionService = {
      async read(input) {
        authorizationHeader = input.authorizationHeader;
        return {
          spendableCredits: 1,
          pendingEarningsCredits: 2,
          availableEarningsCredits: 3,
          entries: [],
        };
      },
    };
    const app = Fastify();
    apps.push(app);
    registerWalletProjectionRoutes(app, service);

    const response = await app.inject({
      method: "GET",
      url: "/v1/wallet?limit=25",
      headers: { authorization: "Bearer user" },
    });

    expect(response.statusCode).toBe(200);
    expect(authorizationHeader).toBe("Bearer user");
    expect(response.json().availableEarningsCredits).toBe(3);
  });
});

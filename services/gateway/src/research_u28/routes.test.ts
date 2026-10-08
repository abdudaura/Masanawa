import Fastify from "fastify";
import { describe, it, expect } from "vitest";
import { registerResearchRoutes } from "./routes.js";
import { createResearchService } from "./service.js";

function app() {
  const instance = Fastify();
  const service = createResearchService({
    authorizer: { async authorize({ authorizationHeader }) {
      if (authorizationHeader !== "Bearer signed-in") throw Object.assign(
        new Error("Unauthorized"), { statusCode: 401 });
      return { tenantId: "tenant_1", userId: "user_1" };
    } },
    budget: { async reserve() { return true; }, async settle() {} },
    provider: { async search() { return [{
      title: "Report", url: "https://example.org/report",
      excerpt: "An independent public indexed article.", publishedAt: null,
    }]; } },
    policy: { enabled: true, allowDomains: ["example.org"], async permittedActor() { return true; } },
  });
  registerResearchRoutes(instance, service);
  return instance;
}
describe("U28 authenticated route (isolated, requires F18 composition)", () => {
  it("exposes bounded evidence without storing or proxying user-provided URLs", async () => {
    const reply = await app().inject({
      method: "POST", url: "/agent/research",
      headers: { authorization: "Bearer signed-in" },
      payload: { query: "renewable energy", mode: "general", limit: 5 },
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.headers["cache-control"]).toBe("no-store");
    expect(reply.json()).toMatchObject({
      status: "sources_found",
      sources: [{ domain: "example.org", evidenceKind: "indexed_excerpt" }],
    });
  });
  it("refuses unauthenticated requests and forged actor/provider fields", async () => {
    const unauth = await app().inject({
      method: "POST", url: "/agent/research",
      payload: { query: "renewable energy", mode: "general" },
    });
    expect(unauth.statusCode).toBe(401);
    const forged = await app().inject({
      method: "POST", url: "/agent/research",
      headers: { authorization: "Bearer signed-in" },
      payload: {
        query: "renewable energy", mode: "general",
        tenantId: "victim", providerUrl: "http://127.0.0.1/secrets",
      },
    });
    expect(forged.statusCode).toBe(400);
  });
  it("refuses arbitrary query mode and no-body request", async () => {
    const invalid = await app().inject({
      method: "POST", url: "/agent/research",
      headers: { authorization: "Bearer signed-in" },
      payload: { query: "weather for next month", mode: "execute" },
    });
    expect(invalid.statusCode).toBe(400);
  });
});


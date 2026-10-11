import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerApiVersionAliases } from "./api_versioning.js";

describe("gateway API version compatibility", () => {
  it("retains encapsulated plugin authentication and response hooks", async () => {
    const app = Fastify();
    registerApiVersionAliases(app);
    await app.register(async child => {
      child.addHook("preValidation", async (request, reply) => {
        if (request.headers.authorization !== "Bearer child") return reply.code(401).send();
      });
      child.addHook("onSend", async (_request, reply, payload) => { reply.header("cache-control", "private, no-store"); return payload; });
      child.get("/private-child", async () => ({ private: true }));
    });
    try {
      for (const prefix of ["", "/v1"]) {
        expect((await app.inject({ method: "GET", url: `${prefix}/private-child` })).statusCode).toBe(401);
        const response = await app.inject({ method: "GET", url: `${prefix}/private-child`, headers: { authorization: "Bearer child" } });
        expect(response.json()).toEqual({ private: true });
        expect(response.headers["cache-control"]).toBe("private, no-store");
      }
    } finally { await app.close(); }
  });
  it("uses the same authenticated handler and validation on legacy and v1 routes", async () => {
    const app = Fastify();
    registerApiVersionAliases(app);
    const seen: string[] = [];
    app.post("/profiles/:id", {
      preHandler: async (request, reply) => {
        if (request.headers.authorization !== "Bearer test") return reply.code(401).send();
      },
      schema: { body: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 2 } } } },
    }, async request => { seen.push(request.url); return { saved: true }; });
    try {
      for (const prefix of ["", "/v1"]) {
        expect((await app.inject({ method: "POST", url: `${prefix}/profiles/self`, payload: { name: "Amina" } })).statusCode).toBe(401);
        expect((await app.inject({ method: "POST", url: `${prefix}/profiles/self`, headers: { authorization: "Bearer test" }, payload: { name: "A" } })).statusCode).toBe(400);
        expect((await app.inject({ method: "POST", url: `${prefix}/profiles/self`, headers: { authorization: "Bearer test" }, payload: { name: "Amina" } })).json()).toEqual({ saved: true });
      }
      expect(seen).toEqual(["/profiles/self", "/v1/profiles/self"]);
    } finally { await app.close(); }
  });

  it("keeps probes unversioned, existing versions unchanged, and automatic HEAD available", async () => {
    const app = Fastify();
    registerApiVersionAliases(app);
    app.get("/healthz", async () => ({ ok: true }));
    app.get("/readyz", async () => ({ ready: true }));
    app.get("/talks", async () => ({ talks: [] }));
    app.head("/explicit-head", async (_request, reply) => reply.header("x-version-test", "head").send());
    app.get("/v1/wallet", async () => ({ balance: 1 }));
    app.get("/v2/future", async () => ({ future: true }));
    try {
      for (const url of ["/healthz", "/readyz", "/talks", "/v1/talks", "/v1/wallet", "/v2/future"]) {
        expect((await app.inject({ method: "GET", url })).statusCode).toBe(200);
      }
      expect((await app.inject({ method: "HEAD", url: "/v1/talks" })).statusCode).toBe(200);
      expect((await app.inject({ method: "HEAD", url: "/v1/explicit-head" })).headers["x-version-test"]).toBe("head");
      for (const url of ["/v1/healthz", "/v1/readyz", "/v1/v1/wallet", "/v1/v2/future"]) {
        expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
      }
    } finally { await app.close(); }
  });
});

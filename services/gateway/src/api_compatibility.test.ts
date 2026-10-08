import fs from "node:fs";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { legacyVersionedPaths, registerVersionedCompatibility } from "./api_compatibility.js";

describe("audited API v1 compatibility", () => {
  it("keeps the exact runtime URL inventory synchronized with the lifecycle manifest", () => {
    const manifest = JSON.parse(fs.readFileSync("docs/API-LIFECYCLE.json", "utf8"));
    expect([...legacyVersionedPaths]).toEqual(manifest.http.compatibilityUnversionedPaths);
  });

  it("runs the same authorization, schema and handler for legacy and v1 URLs", async () => {
    const app = Fastify();
    registerVersionedCompatibility(app);
    app.post("/messages", {
      schema: { body: { type: "object", required: ["text"], properties: { text: { type: "string" } } } },
      preHandler: async (request, reply) => {
        if (request.headers.authorization !== "Bearer owner") return reply.code(401).send({ error: "unauthorized" });
      },
    }, async request => ({ received: request.body }));
    try {
      for (const url of ["/messages", "/v1/messages"]) {
        expect((await app.inject({ method: "POST", url, payload: { text: "hello" } })).statusCode).toBe(401);
        expect((await app.inject({ method: "POST", url, payload: {} })).statusCode).toBe(400);
        const accepted = await app.inject({ method: "POST", url, payload: { text: "hello" }, headers: { authorization: "Bearer owner" } });
        expect(accepted.statusCode).toBe(200);
        expect(accepted.json()).toEqual({ received: { text: "hello" } });
      }
    } finally { await app.close(); }
  });

  it("does not implicitly admit a future unversioned route", async () => {
    const app = Fastify();
    registerVersionedCompatibility(app);
    const futureUrl = "/future-feature";
    app.get(futureUrl, async () => ({ ok: true }));
    try { expect((await app.inject("/v1" + futureUrl)).statusCode).toBe(404); }
    finally { await app.close(); }
  });
});

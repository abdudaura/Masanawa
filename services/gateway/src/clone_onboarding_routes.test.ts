import Fastify from "fastify";
import { expect, it, vi } from "vitest";
import { CloneSetupError } from "@masanawa/identity";
import { PlatformError } from "@masanawa/contracts";
import { createGatewayWithCloneOnboarding, registerCloneOnboardingRoutes } from "./clone_onboarding_routes.js";
import type { CloneOnboardingService, CloneOnboardingView } from "./clone_onboarding.js";

async function fixture() {
  const view: CloneOnboardingView = { setup: null, supportAgents: [], defaultSupportAgentId: null, nextStep: "name", prompt: "Name?", runtimeReadiness: "not-verified" };
  const service = Object.fromEntries(["read", "save", "preview", "confirm", "cancel", "selectSupport"].map(key => [key, vi.fn(async () => view)])) as unknown as { [K in keyof CloneOnboardingService]: ReturnType<typeof vi.fn> };
  const app = Fastify({ logger: false });
  await registerCloneOnboardingRoutes(app, service as unknown as CloneOnboardingService);
  return { app, service };
}
it("passes current authorization and form data to the onboarding service", async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({ method: "PUT", url: "/creator/onboarding/profile", headers: { authorization: "Bearer private" }, payload: { expectedRevision: null, profile: { displayName: "Nasir", languages: ["Hausa"] } } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(f.service.save).toHaveBeenCalledWith({ authorizationHeader: "Bearer private", expectedRevision: null, profile: { displayName: "Nasir", languages: ["Hausa"] } });
  } finally { await f.app.close(); }
});
it("rejects technical fields and client-supplied scope before service execution", async () => {
  const f = await fixture();
  try {
    for (const payload of [{ expectedRevision: null, profile: { apiKey: "secret" } }, { expectedRevision: null, profile: {}, userId: "forged" }, { expectedRevision: -1, profile: {} }]) {
      const response = await f.app.inject({ method: "PUT", url: "/creator/onboarding/profile", payload });
      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain("secret");
    }
    expect(f.service.save).not.toHaveBeenCalled();
  } finally { await f.app.close(); }
});
it("requires explicit preview revision and request identity for confirmation", async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject({ method: "POST", url: "/creator/onboarding/confirm", payload: { expectedPreviewRevision: 2 } });
    expect(response.statusCode).toBe(400);
    expect(f.service.confirm).not.toHaveBeenCalled();
  } finally { await f.app.close(); }
});
it("returns a conflict for a changed preview without disclosing profile internals", async () => {
  const f = await fixture();
  try {
    f.service.preview.mockRejectedValue(new CloneSetupError("conflict"));
    const response = await f.app.inject({ method: "POST", url: "/creator/onboarding/preview", payload: { expectedRevision: 1 } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("clone.setup.conflict");
  } finally { await f.app.close(); }
});
it("redacts arbitrary provider/DB failures and preserves denied authentication status", async () => {
  const f = await fixture();
  try {
    f.service.read.mockRejectedValueOnce(new Error("postgres://password gemini-api-key raw-profile"));
    const unavailable = await f.app.inject({ method: "GET", url: "/creator/onboarding" });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.headers["cache-control"]).toBe("private, no-store");
    expect(unavailable.body).not.toMatch(/password|gemini|raw-profile/);
    for (const category of ["authentication", "authorization"] as const) {
      f.service.read.mockRejectedValueOnce(new PlatformError({ code: "private.policy", category, message: "private details", retryable: false }));
      const denied = await f.app.inject({ method: "GET", url: "/creator/onboarding" });
      expect(denied.statusCode).toBe(category === "authentication" ? 401 : 403);
      expect(denied.body).not.toContain("private");
    }
  } finally { await f.app.close(); }
});
it("composes onboarding with the existing Gateway health, readiness and directory routes", async () => {
  const f = await fixture();
  await f.app.close();
  const app = createGatewayWithCloneOnboarding({ cloneOnboarding: f.service as unknown as CloneOnboardingService, agentDirectory: {
    list: async () => [], setDefaultPlatformAgent: async () => { throw new Error("not used"); },
  } });
  try {
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/agent/directory" })).json()).toEqual({ agents: [] });
    const response = await app.inject({ method: "GET", url: "/creator/onboarding" });
    expect(response.statusCode).toBe(200);
    expect(f.service.read).toHaveBeenCalledTimes(1);
  } finally { await app.close(); }
});
it.each(["", "/v1"])("preserves scoped onboarding field fences and no-store on %s routes", async prefix => {
  const f = await fixture();
  await f.app.close();
  const app = createGatewayWithCloneOnboarding({ cloneOnboarding: f.service as unknown as CloneOnboardingService });
  try {
    for (const payload of [
      { expectedRevision: null, profile: { displayName: "Nasir" }, userId: "forged" },
      { expectedRevision: null, profile: { displayName: "Nasir", apiKey: "secret" } },
      { expectedRevision: null, profile: { displayName: "Nasir", avatarUrl: "https://attacker.example" } },
    ]) {
      const denied = await app.inject({ method: "PUT", url: `${prefix}/creator/onboarding/profile`, headers: { authorization: "Bearer private" }, payload });
      expect(denied.statusCode).toBe(400);
      expect(denied.headers["cache-control"]).toBe("private, no-store");
      expect(denied.body).not.toMatch(/forged|secret|attacker/);
    }
    expect(f.service.save).not.toHaveBeenCalled();
    const valid = await app.inject({ method: "PUT", url: `${prefix}/creator/onboarding/profile`, headers: { authorization: "Bearer private" }, payload: { expectedRevision: null, profile: { displayName: "Nasir", languages: ["Hausa"] } } });
    expect(valid.statusCode).toBe(200);
    expect(valid.headers["cache-control"]).toBe("private, no-store");
    expect(f.service.save).toHaveBeenCalledTimes(1);
    expect(f.service.save).toHaveBeenCalledWith({ authorizationHeader: "Bearer private", expectedRevision: null, profile: { displayName: "Nasir", languages: ["Hausa"] } });
  } finally { await app.close(); }
});

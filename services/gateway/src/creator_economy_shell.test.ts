import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, PlatformError } from "@masanawa/contracts";
import { createCreatorEconomyShell, projectCreatorEconomyToShellDocument, registerCreatorEconomyShellRoutes } from "./creator_economy_shell.js";

const snapshot = () => ({ hasClone: true, characterId: createCanonicalId("character"), customerCredits: 12345, agentFloatCredits: 2345, pendingEarningsCredits: 345, availableEarningsCredits: 45 });
const options = { documentId: "creator-economy", revision: 1 };
describe("creator economic ShellDocument", () => {
  it("renders four separate canonical balances in Credits without fiat conversion or financial actions", () => {
    const document = projectCreatorEconomyToShellDocument(snapshot(), options);
    expect(document.nodes.filter(n => n.type === "metric").map(n => [n.id, n.value])).toEqual([
      ["customer-credits", "12,345 Credits"], ["agent-float", "2,345 Credits"], ["pending-earnings", "345 Credits"], ["available-earnings", "45 Credits"],
    ]);
    expect(document.nodes.some(n => (n.type as string) === "button")).toBe(false);
    expect(JSON.stringify(document)).not.toMatch(/NGN|₦/u);
    expect(document.fallback).toContain("Pending earnings: 345 Credits");
    expect(Object.isFrozen(document.nodes)).toBe(true);
    expect(document.nodes.every(Object.isFrozen)).toBe(true);
  });
  it("shows real zero balances and gives a clone setup path without inventing an empty earnings account", () => {
    const document = projectCreatorEconomyToShellDocument({ hasClone: false, characterId: null, customerCredits: 0, agentFloatCredits: 0, pendingEarningsCredits: 0, availableEarningsCredits: 0 }, options);
    expect(document.nodes.filter(n => n.type === "metric")).toHaveLength(1);
    expect(document.nodes.find(n => n.type === "metric")?.value).toBe("0 Credits");
    expect(document.fallback).toContain("Create your personal clone");
  });
  it("refuses malformed or inconsistent balances and document scope", () => {
    for (const patch of [{ customerCredits: -1 }, { agentFloatCredits: 0.5 }, { availableEarningsCredits: Number.MAX_SAFE_INTEGER + 1 }, { hasClone: false }, { characterId: "forged" }]) {
      expect(() => projectCreatorEconomyToShellDocument({ ...snapshot(), ...patch }, options)).toThrow();
    }
    expect(() => projectCreatorEconomyToShellDocument(snapshot(), { ...options, revision: -1 })).toThrow();
    expect(() => projectCreatorEconomyToShellDocument(snapshot(), { ...options, documentId: "invalid id" })).toThrow();
  });
  it("reauthorizes every refresh through the existing service and propagates outages", async () => {
    const read = vi.fn(async () => snapshot());
    const shell = createCreatorEconomyShell({ economy: { read } });
    await shell.read({ ...options, authorizationHeader: "Bearer current" });
    expect(read).toHaveBeenCalledWith({ authorizationHeader: "Bearer current" });
    read.mockRejectedValueOnce(new Error("database/private"));
    await expect(shell.read({ ...options, authorizationHeader: "Bearer current" })).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("isolates each projection and never reuses a previous user's balances", async () => {
    const first = snapshot(); const second = { ...snapshot(), customerCredits: 99 };
    const read = vi.fn(async () => first).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const shell = createCreatorEconomyShell({ economy: { read } });
    expect((await shell.read({ ...options, authorizationHeader: "Bearer first" })).snapshot).toBe(first);
    const next = await shell.read({ ...options, revision: 2, authorizationHeader: "Bearer second" });
    expect(next.document.nodes.find(n => n.id === "customer-credits")?.value).toBe("99 Credits");
  });
  it("registers authenticated fresh reads without caching and keeps service failures private", async () => {
    const app = Fastify();
    const read = vi.fn(async () => snapshot());
    const scopes = vi.fn(async () => options);
    await registerCreatorEconomyShellRoutes(app, { shell: createCreatorEconomyShell({ economy: { read } }), nextDocumentScope: scopes });
    try {
      const response = await app.inject({ method: "GET", url: "/creator/economy/document", headers: { authorization: "Bearer current" } });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.json().document.version).toBe(1);
      expect(read).toHaveBeenCalledWith({ authorizationHeader: "Bearer current" });
      read.mockRejectedValueOnce(new Error("private-account-provider-secret"));
      const failed = await app.inject({ method: "GET", url: "/creator/economy/document" });
      expect(failed.statusCode).toBe(503);
      expect(failed.body).not.toContain("private-account");
      expect(failed.json()).not.toHaveProperty("snapshot");
      read.mockRejectedValueOnce(new PlatformError({ code: "denied", category: "authorization", message: "private-rule", retryable: false }));
      expect((await app.inject({ method: "GET", url: "/creator/economy/document" })).statusCode).toBe(403);
    } finally { await app.close(); }
  });
});

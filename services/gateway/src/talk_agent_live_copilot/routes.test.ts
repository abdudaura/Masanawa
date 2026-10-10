import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerLiveStageCopilotRoutes } from "./routes.js";
import type { createLiveStageCopilot } from "./copilot.js";
import { LiveStageCopilotError } from "./copilot.js";

describe("U15 private Host copilot HTTP transport", () => {
  it("redacts upstream secrets and prohibits caching Host-only readback", async () => {
    const service = { suggestions: vi.fn(async () => { throw new Error("private-db-password"); }),
      approveTurn: vi.fn(async () => { throw new LiveStageCopilotError("talks.host_forbidden", 403); }) };
    const app = Fastify();
    registerLiveStageCopilotRoutes(app, service as unknown as ReturnType<typeof createLiveStageCopilot>);
    try {
      const get = await app.inject({ method: "GET", url: "/v1/talks/talk-1/ai-stage/suggestions" });
      expect(get.statusCode).toBe(503);
      expect(get.json()).toEqual({ error: "talks.copilot_unavailable" });
      expect(get.headers["cache-control"]).toBe("no-store");
      expect(get.body).not.toContain("private-db-password");
      const post = await app.inject({ method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
        payload: { requestId: "turn-1", hostApprovedTranscript: "Question" } });
      expect(post.statusCode).toBe(403);
      expect(post.json()).toEqual({ error: "talks.host_forbidden" });
    } finally { await app.close(); }
  });

  it("rejects every authority/output key before schema stripping and bounds payload size", async () => {
    const service = { suggestions: vi.fn(), approveTurn: vi.fn() };
    const app = Fastify();
    registerLiveStageCopilotRoutes(app, service as unknown as ReturnType<typeof createLiveStageCopilot>);
    try {
      for (const key of ["userId", "accountId", "seatId", "role", "approved", "outputText", "priceCredits", "tenantId", "hostUserId"]) {
        const result = await app.inject({ method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
          payload: { requestId: "turn-1", hostApprovedTranscript: "Question", [key]: "forged" } });
        expect(result.statusCode).toBe(400);
        expect(result.headers["cache-control"]).toBe("no-store");
      }
      const huge = await app.inject({ method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
        payload: { requestId: "turn-1", hostApprovedTranscript: "Q".repeat(9000) } });
      expect(huge.statusCode).toBe(413);
      expect(service.approveTurn).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it("rejects fabricated tenant, payer and actor fields before touching authority", async () => {
    const service = {
      suggestions: vi.fn(),
      approveTurn: vi.fn(),
    };
    const app = Fastify();
    registerLiveStageCopilotRoutes(app, service as unknown as ReturnType<typeof createLiveStageCopilot>);
    const result = await app.inject({
      method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
      payload: {
        requestId: "turn-1", hostApprovedTranscript: "Please answer",
        tenantId: "forged", hostUserId: "forged", priceCredits: 0,
      },
    });
    expect(result.statusCode).toBe(400);
    expect(service.approveTurn).not.toHaveBeenCalled();
    await app.close();
  });
  it("preserves authenticated Host approval identity and request scope", async () => {
    const service = {
      suggestions: vi.fn(async () => []),
      approveTurn: vi.fn(async () => ({ status: "published", reason: "published" })),
    };
    const app = Fastify();
    registerLiveStageCopilotRoutes(app, service as unknown as ReturnType<typeof createLiveStageCopilot>);
    const result = await app.inject({
      method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
      headers: { authorization: "Bearer session-1" },
      payload: { requestId: "turn-1", hostApprovedTranscript: "Please answer" },
    });
    expect(result.statusCode).toBe(200);
    expect(service.approveTurn).toHaveBeenCalledWith({
      authorizationHeader: "Bearer session-1", talkId: "talk-1", seatId: "seat-1",
      requestId: "turn-1", hostApprovedTranscript: "Please answer",
    });
    await app.close();
  });
  it("returns 202, not success, for an uncertain LiveKit publish", async () => {
    const service = {
      suggestions: vi.fn(async () => []),
      approveTurn: vi.fn(async () => ({
        status: "uncertain", reason: "worker_outcome_unknown",
      })),
    };
    const app = Fastify();
    registerLiveStageCopilotRoutes(app, service as unknown as ReturnType<typeof createLiveStageCopilot>);
    const result = await app.inject({
      method: "POST", url: "/v1/talks/talk-1/ai-stage/seats/seat-1/turns",
      payload: { requestId: "turn-2", hostApprovedTranscript: "Please answer" },
    });
    expect(result.statusCode).toBe(202);
    expect(result.json().status).toBe("uncertain");
    await app.close();
  });
});


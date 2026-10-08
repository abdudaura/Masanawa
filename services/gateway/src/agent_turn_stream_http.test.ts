import { afterEach, describe, expect, it } from "vitest";
import { createCanonicalId, PlatformError } from "@masanawa/contracts";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import { createGatewayApp } from "./app.js";
import { CustomerAuthError } from "./customer_auth.js";

const apps: ReturnType<typeof createGatewayApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

function failure(code: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message: "Sensitive internal error detail must not leak",
    retryable: false,
  });
}

function service(turn: AgentConversationService["turn"]): AgentConversationService {
  return {
    open: async () => { throw new Error("not in test"); },
    turn,
    mediaTurn: async () => { throw new Error("not in test"); },
    mediaSetTurn: async () => { throw new Error("not in test"); },
    close: async () => undefined,
  };
}

async function streamedTurn(turn: AgentConversationService["turn"]) {
  const app = createGatewayApp({ agentConversation: service(turn) });
  apps.push(app);
  return app.inject({
    method: "POST",
    url: `/agent/sessions/${createCanonicalId("character-session")}/turn-stream`,
    headers: {
      authorization: "Bearer sample",
      "x-request-id": createCanonicalId("request"),
      "x-correlation-id": createCanonicalId("correlation"),
    },
    payload: { characterId: createCanonicalId("character"), text: "Hello" },
  });
}

describe("R19 Gateway NDJSON streamed persona recovery", () => {
  it("emits an allowlisted changed-persona code before inference output", async () => {
    const response = await streamedTurn(async () => {
      throw failure("agents.session_persona_changed");
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/x-ndjson");
    const events = response.body.trim().split("\n").map((line) => JSON.parse(line) as unknown);
    expect(events).toEqual([{ type: "error", code: "agents.session_persona_changed" }]);
  });

  it("hides otherwise-recoverable codes after any output", async () => {
    const response = await streamedTurn(async (request) => {
      await request.onTextDelta?.("Hello");
      throw failure("agents.session_persona_changed");
    });
    const events = response.body.trim().split("\n").map((line) => JSON.parse(line) as unknown);
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      { type: "error", code: "turn_failed" },
    ]);
    expect(response.body).not.toContain("Sensitive internal error detail");
  });

  it("provides only a sanitized pre-output login prompt for expired auth", async () => {
    const response = await streamedTurn(async () => {
      throw new CustomerAuthError("UNAUTHORIZED", 401);
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.trim()).toBe('{"type":"error","code":"auth_required"}');
    expect(response.body).not.toContain("UNAUTHORIZED");
  });

  it("keeps cross-account and financial ambiguity as generic failure", async () => {
    for (const code of ["agents.session_scope_mismatch", "agents.turn_pending", "commerce.payment_outcome_unknown"]) {
      const response = await streamedTurn(async () => { throw failure(code); });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('"code":"turn_failed"');
      expect(response.body).not.toContain(code);
    }
  });
});

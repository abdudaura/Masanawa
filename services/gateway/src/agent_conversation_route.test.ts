import { afterEach, describe, expect, it } from "vitest";
import { isCanonicalId } from "@masanawa/contracts";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Alpha agent conversation routes", () => {
  it("forwards Character scope through open, turn, media and close", async () => {
    const seen: string[] = [];
    const sessionId =
      "character-session_0199f0d0-0000-7000-8000-000000000001";
    const runId = "agent-run_0199f0d0-0000-7000-8000-000000000002";
    const characterId =
      "character_0199f0d0-0000-7000-8000-000000000003";

    const conversation: AgentConversationService = {
      async open(input) {
        seen.push(`open:${input.characterId}:${input.authorizationHeader}`);
        return { characterSessionId: sessionId as never };
      },
      async turn(input) {
        expect(isCanonicalId("request", input.requestId)).toBe(true);
        expect(isCanonicalId("correlation", input.correlationId)).toBe(true);
        seen.push(`turn:${input.characterId}:${input.text}`);
        return { reply: "Hello", agentRunId: runId, parts: [] };
      },
      async mediaTurn(input) {
        expect(isCanonicalId("request", input.requestId)).toBe(true);
        expect(isCanonicalId("correlation", input.correlationId)).toBe(true);
        seen.push(`media:${input.characterId}:${input.mimeType}`);
        return { reply: "I heard you", agentRunId: runId, parts: [] };
      },
      async close(input) {
        seen.push(`close:${input.characterId}`);
      },
    };

    const app = createGatewayApp({ agentConversation: conversation });
    apps.push(app);

    const headers = { authorization: "Bearer alpha-test-token" };
    const opened = await app.inject({
      method: "POST",
      url: "/v1/agent/sessions/open",
      headers,
      payload: { characterId },
    });
    expect(opened.statusCode).toBe(200);

    const turn = await app.inject({
      method: "POST",
      url: `/v1/agent/sessions/${sessionId}/turn`,
      headers,
      payload: { characterId, text: "Hi" },
    });
    expect(turn.statusCode).toBe(200);
    expect(turn.json().reply).toBe("Hello");

    const media = await app.inject({
      method: "POST",
      url: `/v1/agent/sessions/${sessionId}/media-turn`,
      headers,
      payload: {
        characterId,
        caption: "",
        mimeType: "audio/mp4",
        dataBase64: "YWJj",
      },
    });
    expect(media.statusCode).toBe(200);
    expect(media.json().reply).toBe("I heard you");

    const closed = await app.inject({
      method: "POST",
      url: `/v1/agent/sessions/${sessionId}/close`,
      headers,
      payload: { characterId },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual({ closed: true });

    expect(seen).toEqual([
      `open:${characterId}:Bearer alpha-test-token`,
      `turn:${characterId}:Hi`,
      `media:${characterId}:audio/mp4`,
      `close:${characterId}`,
    ]);
  });
});

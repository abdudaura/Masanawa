import { afterEach, describe, expect, it } from "vitest";
import { createCanonicalId, isCanonicalId, PlatformError } from "@masanawa/contracts";
import type { AgentConversationService } from "./agent_conversation_contract.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Alpha agent conversation routes", () => {
  function streamService(turn: AgentConversationService["turn"]): AgentConversationService {
    return {
      turn,
      async open() { throw new Error("unused"); },
      async close() {},
      async mediaTurn() { throw new Error("unused"); },
      async mediaSetTurn() { throw new Error("unused"); },
    };
  }

  it("streams the canonical custody receipt while the model is still blocked", async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const requestId = createCanonicalId("request");
    let completed = false;
    const app = createGatewayApp({ agentConversation: streamService(async input => {
      input.onAccepted?.({ requestId: input.requestId, state: "pending" });
      await pending;
      completed = true;
      return { reply: "Hello", agentRunId: createCanonicalId("agent-run"), parts: [] };
    }) });
    apps.push(app);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(`${address}/agent/sessions/${createCanonicalId("character-session")}/turn-stream`, {
        method: "POST", signal: AbortSignal.timeout(1500),
        headers: { "content-type": "application/json", "x-request-id": requestId },
        body: JSON.stringify({ characterId: createCanonicalId("character"), text: "hello" }),
      });
      expect(response.status).toBe(200);
      reader = response.body!.getReader();
      const first = await reader.read();
      const event = JSON.parse(new TextDecoder().decode(first.value).trim());
      expect(event).toEqual({ type: "accepted", requestId, state: "pending" });
      expect(completed).toBe(false);
      release();
      let rest = "";
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        rest += new TextDecoder().decode(chunk.value);
      }
      expect(JSON.parse(rest.trim())).toMatchObject({ type: "done", reply: "Hello" });
    } finally {
      release();
      await reader?.cancel().catch(() => undefined);
    }
  });

  it.each(["agents.turn_pending", "agents.turn_settlement_uncertain"])(
    "preserves safe %s recovery without disclosing internal errors",
    async code => {
      const app = createGatewayApp({ agentConversation: streamService(async () => {
        throw new PlatformError({ code, category: "conflict", retryable: code === "agents.turn_pending", message: "private diagnostic" });
      }) });
      apps.push(app);
      const response = await app.inject({ method: "POST", url: `/agent/sessions/${createCanonicalId("character-session")}/turn-stream`,
        payload: { characterId: createCanonicalId("character"), text: "hello" } });
      expect(JSON.parse(response.body.trim())).toMatchObject({ type: "error", code });
      expect(response.body).not.toContain("private diagnostic");
    },
  );

  it.each(["turn", "turn-stream", "media-turn", "media-set-turn"])(
    "preserves the same canonical request key across retries of %s",
    async route => {
      const seen: string[] = [];
      const execute = async (input: { requestId: string }) => {
        seen.push(input.requestId);
        return { reply: "Hello", agentRunId: createCanonicalId("agent-run"), parts: [] };
      };
      const app = createGatewayApp({ agentConversation: {
        ...streamService(execute), mediaTurn: execute, mediaSetTurn: execute,
      } });
      apps.push(app);
      const requestId = createCanonicalId("request");
      const characterId = createCanonicalId("character");
      const media = [{ mimeType: "image/jpeg", dataBase64: "YWJj" }, { mimeType: "image/jpeg", dataBase64: "ZGVm" }];
      const payload = route.startsWith("media")
        ? route === "media-turn" ? { characterId, caption: "", ...media[0] } : { characterId, caption: "", media }
        : { characterId, text: "hello" };
      for (let retry = 0; retry < 2; retry++) {
        const response = await app.inject({ method: "POST", url: `/agent/sessions/${createCanonicalId("character-session")}/${route}`,
          headers: { "x-request-id": requestId }, payload });
        expect(response.statusCode).toBe(200);
      }
      expect(seen).toEqual([requestId, requestId]);
    },
  );

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
      async mediaSetTurn(input) {
        expect(isCanonicalId("request", input.requestId)).toBe(true);
        expect(isCanonicalId("correlation", input.correlationId)).toBe(true);
        seen.push(`media-set:${input.characterId}:${input.media.length}`);
        return { reply: "I reviewed both", agentRunId: runId, parts: [] };
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
      url: "/agent/sessions/open",
      headers,
      payload: { characterId },
    });
    expect(opened.statusCode).toBe(200);

    const turn = await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/turn`,
      headers,
      payload: { characterId, text: "Hi" },
    });
    expect(turn.statusCode).toBe(200);
    expect(turn.json().reply).toBe("Hello");

    const media = await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/media-turn`,
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

    const mediaSet = await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/media-set-turn`,
      headers,
      payload: {
        characterId,
        caption: "Compare",
        media: [
          { mimeType: "image/jpeg", dataBase64: "YWJj", name: "one.jpg" },
          { mimeType: "image/jpeg", dataBase64: "ZGVm", name: "two.jpg" },
        ],
      },
    });
    expect(mediaSet.statusCode).toBe(200);
    expect(mediaSet.json().reply).toBe("I reviewed both");

    const closed = await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/close`,
      headers,
      payload: { characterId },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual({ closed: true });

    expect(seen).toEqual([
      `open:${characterId}:Bearer alpha-test-token`,
      `turn:${characterId}:Hi`,
      `media:${characterId}:audio/mp4`,
      `media-set:${characterId}:2`,
      `close:${characterId}`,
    ]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createLiveKitTalkAiRuntimeDispatcher } from "./livekit_dispatch.js";

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("LiveKit Talk AI runtime dispatch", () => {
  it("creates one explicit dispatch with canonical Seat metadata", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockResolvedValueOnce(response({ id: "dispatch-1" }));
    const dispatcher = createLiveKitTalkAiRuntimeDispatcher({
      serverUrl: "wss://live.example.test",
      apiKey: "key",
      apiSecret: "0123456789abcdef",
      fetchImpl,
      now: () => new Date("2026-10-07T12:00:00Z"),
    });

    await dispatcher.dispatch({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      personaId: "twin-1",
      kind: "twin",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const create = fetchImpl.mock.calls[1]!;
    expect(create[0]).toContain("AgentDispatchService/CreateDispatch");
    const body = JSON.parse((create[1] as RequestInit).body as string);
    expect(body.room).toBe("talk-1");
    expect(body.agent_name).toBe("masanawa-talk-ai");
    expect(JSON.parse(body.metadata)).toEqual({
      schemaVersion: 1,
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      personaId: "twin-1",
      kind: "twin",
    });
  });

  it("is idempotent when the same Seat already has a dispatch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      agent_dispatches: [{
        agent_name: "masanawa-talk-ai",
        metadata: JSON.stringify({ seatId: "seat-1" }),
      }],
    }));
    const dispatcher = createLiveKitTalkAiRuntimeDispatcher({
      serverUrl: "wss://live.example.test",
      apiKey: "key",
      apiSecret: "0123456789abcdef",
      fetchImpl,
    });
    await dispatcher.dispatch({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-1",
      personaId: "expert-1",
      kind: "expert",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

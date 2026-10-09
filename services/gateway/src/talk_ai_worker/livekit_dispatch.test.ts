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
        metadata: JSON.stringify({
          schemaVersion: 1, tenantId: "tenant-1", talkId: "talk-1",
          seatId: "seat-1", personaId: "expert-1", kind: "expert",
        }),
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
  const seat = {
    tenantId: "tenant-1",
    talkId: "talk-1",
    seatId: "seat-1",
    personaId: "expert-1",
    kind: "expert" as const,
  };
  const metadata = JSON.stringify({ schemaVersion: 1, ...seat });
  function build(fetchImpl: typeof fetch) {
    return createLiveKitTalkAiRuntimeDispatcher({
      serverUrl: "wss://live.example.test",
      apiKey: "key",
      apiSecret: "0123456789abcdef",
      fetchImpl,
      now: () => new Date("2026-10-08T06:00:00Z"),
    });
  }

  it("does not reuse the previous persona when the Seat ID is the same", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      agent_dispatches: [{
        id: "dispatch-old", agent_name: "masanawa-talk-ai",
        room: "talk-1",
        metadata: JSON.stringify({ ...JSON.parse(metadata), personaId: "twin-old" }),
      }],
    }));
    await expect(build(fetchImpl).dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_identity_conflict");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-tenant, wrong Talk, and wrong kind dispatches sharing a Seat ID", async () => {
    for (const change of [
      { tenantId: "other-tenant" }, { talkId: "other-talk" },
      { kind: "twin" }, { schemaVersion: 2 },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(response({
        agentDispatches: [{
          agentName: "masanawa-talk-ai",
          metadata: JSON.stringify({ ...JSON.parse(metadata), ...change }),
        }],
      }));
      await expect(build(fetchImpl).dispatch(seat))
        .rejects.toThrow("talks.ai_dispatch_identity_conflict");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects another named worker or multiple live dispatches for this Seat", async () => {
    for (const duplicates of [
      [{ agent_name: "different-worker", metadata }],
      [
        { agent_name: "masanawa-talk-ai", metadata },
        { agent_name: "masanawa-talk-ai", metadata },
      ],
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(response({
        agent_dispatches: duplicates,
      }));
      await expect(build(fetchImpl).dispatch(seat))
        .rejects.toThrow("talks.ai_dispatch_identity_conflict");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("ignores terminated dispatches and can create a new qualified job", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({
        agent_dispatches: [{
          agent_name: "masanawa-talk-ai", metadata,
          state: { deleted_at: 1791440000 },
        }],
      }))
      .mockResolvedValueOnce(response({
        id: "new-dispatch", metadata, agent_name: "masanawa-talk-ai", room: "talk-1",
      }));
    await expect(build(fetchImpl).dispatch(seat)).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses malformed list responses and never creates on uncertain room state", async () => {
    for (const body of [
      { agent_dispatches: null }, { agent_dispatches: [{} , null] },
      { agent_dispatches: "not-an-array" },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(response(body));
      await expect(build(fetchImpl).dispatch(seat))
        .rejects.toThrow("talks.ai_dispatch_list_invalid");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("treats omitted Proto3 repeated dispatch field as a valid empty room", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({
        id: "AD_1", agent_name: "masanawa-talk-ai", room: "talk-1", metadata,
      }));
    await expect(build(fetchImpl).dispatch(seat)).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toContain("CreateDispatch");
  });

  it("coalesces truly concurrent identical dispatches into one LiveKit create request", async () => {
    let releaseList!: (value: Response) => void;
    const pendingList = new Promise<Response>((resolve) => { releaseList = resolve; });
    const fetchImpl = vi.fn()
      .mockReturnValueOnce(pendingList)
      .mockResolvedValueOnce(response({ id: "dispatch-1" }));
    const dispatcher = build(fetchImpl);
    const first = dispatcher.dispatch(seat);
    const second = dispatcher.dispatch({ ...seat });
    releaseList(response({ agent_dispatches: [] }));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.filter((args) => String(args[0]).includes("CreateDispatch")))
      .toHaveLength(1);
  });

  it("rejects concurrent persona reassignment before creating a second AI job", async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const fetchImpl = vi.fn().mockReturnValueOnce(pending)
      .mockResolvedValueOnce(response({ id: "dispatch-1" }));
    const dispatcher = build(fetchImpl);
    const first = dispatcher.dispatch(seat);
    await expect(dispatcher.dispatch({ ...seat, personaId: "another-persona" }))
      .rejects.toThrow("talks.ai_dispatch_identity_conflict");
    release(response({ agent_dispatches: [] }));
    await first;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed on CreateDispatch confirmation mismatch or missing dispatch ID", async () => {
    for (const created of [
      {}, { id: "" },
      { id: "dispatch-1", metadata: JSON.stringify({ ...JSON.parse(metadata), kind: "twin" }) },
      { id: "dispatch-1", room: "other-room" },
    ]) {
      const fetchImpl = vi.fn().mockResolvedValueOnce(response({ agent_dispatches: [] }))
        .mockResolvedValueOnce(response(created));
      await expect(build(fetchImpl).dispatch(seat))
        .rejects.toThrow("talks.ai_dispatch_create_invalid");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("does not automatically retry ambiguous CreateDispatch transport failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockRejectedValueOnce(new Error("connection lost; may have accepted dispatch"));
    await expect(build(fetchImpl).dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_createdispatch_unconfirmed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("validates identity and kind before touching LiveKit", async () => {
    const fetchImpl = vi.fn();
    const dispatcher = build(fetchImpl);
    await expect(dispatcher.dispatch({ ...seat, personaId: "" }))
      .rejects.toThrow("talks.ai_dispatch_persona_invalid");
    await expect(dispatcher.dispatch({ ...seat, kind: "synthetic" as "expert" }))
      .rejects.toThrow("talks.ai_dispatch_kind_invalid");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("redacts transport error text and malformed JSON responses", async () => {
    const withSecret = vi.fn().mockRejectedValue(new Error("Bearer PRIVATE_SECRET"));
    await expect(build(withSecret).dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_listdispatch_unconfirmed");
    const badJson = new Response("{PRIVATE_SECRET}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const malformed = vi.fn().mockResolvedValue(badJson);
    await expect(build(malformed).dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_listdispatch_invalid_response");
  });

  it("holds an ambiguous CreateDispatch and reconciles without a second create", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockRejectedValueOnce(new Error("private transport details"))
      .mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockResolvedValueOnce(response({
        agent_dispatches: [{
          id: "dispatched", agent_name: "masanawa-talk-ai",
          room: "talk-1", metadata,
        }],
      }));
    const dispatcher = build(fetchImpl);
    await expect(dispatcher.dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_createdispatch_unconfirmed");
    await expect(dispatcher.dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_createdispatch_unconfirmed");
    await expect(dispatcher.dispatch(seat)).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls.map((args) => String(args[0]).split("/").pop())).toEqual([
      "ListDispatch", "CreateDispatch", "ListDispatch", "ListDispatch",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("refuses a different persona while a previous dispatch is still uncertain", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockRejectedValueOnce(new Error("connection aborted"));
    const dispatcher = build(fetchImpl);
    await expect(dispatcher.dispatch(seat))
      .rejects.toThrow("talks.ai_dispatch_createdispatch_unconfirmed");
    await expect(dispatcher.dispatch({ ...seat, personaId: "swapped" }))
      .rejects.toThrow("talks.ai_dispatch_identity_conflict");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a previously ambiguous dispatch materializes as another persona", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ agent_dispatches: [] }))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(response({
        agent_dispatches: [{
          agent_name: "masanawa-talk-ai",
          metadata: JSON.stringify({ ...JSON.parse(metadata), personaId: "wrong" }),
        }],
      }));
    const dispatcher = build(fetchImpl);
    await expect(dispatcher.dispatch(seat)).rejects.toThrow("unconfirmed");
    await expect(dispatcher.dispatch(seat)).rejects.toThrow("identity_conflict");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

});


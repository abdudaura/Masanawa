import { describe, expect, it, vi } from "vitest";
import { projectInboxEvent } from "./inbox_projection.js";

describe("C08 inbox projection on canonical outbox claim", () => {
  const base = {
    tenantId: "tenant_one", eventId: "evt_1", recipientFanId: "fan_1",
    kind: "room_answer" as const, targetKind: "room" as const, targetId: "room_1",
  };
  it("projects only safe copy to the intended account", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    await projectInboxEvent(base, { deliver });
    expect(deliver).toHaveBeenCalledWith({
      tenantId: "tenant_one", fanUserId: "fan_1", eventId: "evt_1",
      kind: "room_answer", targetKind: "room", targetId: "room_1",
      title: "Your Room question", body: "A Masana answered your question.",
    });
  });
  it("denies a target-kind mismatch before persistent writes", async () => {
    const deliver = vi.fn();
    await expect(projectInboxEvent({ ...base, targetKind: "wallet" }, { deliver }))
      .rejects.toThrow("Mismatched");
    expect(deliver).not.toHaveBeenCalled();
  });
  it("rejects missing tenant, event and recipient IDs", async () => {
    const deliver = vi.fn();
    for (const patch of [{ tenantId: "" }, { eventId: "" }, { recipientFanId: "" }, { targetId: "../x" }]) {
      await expect(projectInboxEvent({ ...base, ...patch }, { deliver })).rejects.toThrow();
    }
    expect(deliver).not.toHaveBeenCalled();
  });
  it("propagates persistence failures for canonical outbox retry", async () => {
    await expect(projectInboxEvent(base, {
      deliver: async () => { throw new Error("db down"); },
    })).rejects.toThrow("db down");
  });
});

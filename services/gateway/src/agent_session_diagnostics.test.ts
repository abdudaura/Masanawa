import { describe, expect, it, vi } from "vitest";
import { observeSessionOpen, sessionOpenFailure } from "./agent_session_diagnostics.js";

describe("session-open diagnostics", () => {
  it("preserves successful results without logging", async () => {
    const report = vi.fn();
    const result = Object.freeze({ characterSessionId: "existing-result" });
    expect(await observeSessionOpen("admission", async () => result, report)).toBe(result);
    expect(report).not.toHaveBeenCalled();
  });
  it("reports the failing boundary and preserves the original exception", async () => {
    const error = Object.assign(new Error("private content"), { code: "authority.policy_unavailable" });
    const report = vi.fn();
    await expect(observeSessionOpen("session-create", async () => { throw error; }, report)).rejects.toBe(error);
    expect(report).toHaveBeenCalledWith({
      event: "agent.session_open_failed", stage: "session-create",
      code: "authority.policy_unavailable", errorType: "Error",
    });
  });
  it("does not expose messages, stack traces, tokens or arbitrary error metadata", () => {
    const error = Object.assign(new Error("private message Bearer SECRET"), {
      code: "SECRET", name: "SECRET", details: { authorization: "Bearer SECRET" },
      stack: "SECRET",
    });
    const failure = sessionOpenFailure("admission", error);
    expect(failure).toEqual({
      event: "agent.session_open_failed", stage: "admission", code: "unknown", errorType: "UnknownError",
    });
    expect(JSON.stringify(failure)).not.toContain("SECRET");
  });
  it("keeps the original error when the reporting sink fails", async () => {
    const error = new RangeError("original");
    await expect(observeSessionOpen("session-create", async () => { throw error; },
      () => { throw new Error("logger unavailable"); })).rejects.toBe(error);
  });
  it("handles non-error throws without copying their contents", () => {
    expect(sessionOpenFailure("admission", "Bearer SECRET")).toEqual({
      event: "agent.session_open_failed", stage: "admission", code: "unknown", errorType: "UnknownError",
    });
  });
});

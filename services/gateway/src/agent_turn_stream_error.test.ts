import { describe, expect, it } from "vitest";
import { PlatformError } from "@masanawa/contracts";
import { CustomerAuthError } from "./customer_auth.js";
import { safeAgentTurnStreamErrorCode } from "./agent_turn_stream_error.js";

function conflict(code: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message: "Safe generic failure",
    retryable: false,
  });
}

describe("R19 streamed-turn error classification", () => {
  it.each([
    "agents.session_closed",
    "agents.session_persona_changed",
    "agents.session_not_found",
  ])("passes %s only before streamed output", (code) => {
    expect(safeAgentTurnStreamErrorCode(conflict(code), false)).toBe(code);
    expect(safeAgentTurnStreamErrorCode(conflict(code), true)).toBe("turn_failed");
  });

  it("returns a safe auth-required marker only for pre-output expired sessions", () => {
    expect(safeAgentTurnStreamErrorCode(
      new CustomerAuthError("UNAUTHORIZED", 401), false,
    )).toBe("auth_required");
    expect(safeAgentTurnStreamErrorCode(
      new CustomerAuthError("UNAUTHORIZED", 401), true,
    )).toBe("turn_failed");
    expect(safeAgentTurnStreamErrorCode(
      new CustomerAuthError("FORBIDDEN", 403), false,
    )).toBe("turn_failed");
    expect(safeAgentTurnStreamErrorCode(
      new CustomerAuthError("AUTH_UNAVAILABLE", 503), false,
    )).toBe("turn_failed");
  });

  it("never reveals financial, auth, provider or arbitrary errors", () => {
    for (const error of [
      conflict("agents.turn_pending"),
      conflict("commerce.payment_outcome_unknown"),
      conflict("agents.session_scope_mismatch"),
      new Error("Sensitive details"),
      { code: "agents.session_closed" },
      null,
    ]) {
      expect(safeAgentTurnStreamErrorCode(error, false)).toBe("turn_failed");
      expect(safeAgentTurnStreamErrorCode(error, true)).toBe("turn_failed");
    }
  });
});

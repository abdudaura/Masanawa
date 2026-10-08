/** Sanitized session-open diagnostics, independent of the disabled HTTP logger. */
export type SessionOpenStage = "admission" | "session-create";
export interface SessionOpenFailure {
  readonly event: "agent.session_open_failed";
  readonly stage: SessionOpenStage;
  readonly code: string;
  readonly errorType: string;
}
const codes = new Set([
  "UNAUTHORIZED", "FORBIDDEN", "AUTH_UNAVAILABLE",
  "authority.policy_unavailable", "authority.stale_policy", "authority.revoked",
  "agents.session_access_denied", "agents.session_conflict",
  "identity.relationship_unavailable", "identity.interaction_unavailable",
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "40001", "23503", "23505", "42P01",
]);
const errorTypes = new Set(["Error", "TypeError", "RangeError", "PlatformError", "CustomerAuthError"]);
export function sessionOpenFailure(stage: SessionOpenStage, error: unknown): SessionOpenFailure {
  const record = error !== null && typeof error === "object"
    ? error as { code?: unknown; name?: unknown } : {};
  return Object.freeze({
    event: "agent.session_open_failed",
    stage,
    code: typeof record.code === "string" && codes.has(record.code) ? record.code : "unknown",
    errorType: typeof record.name === "string" && errorTypes.has(record.name) ? record.name : "UnknownError",
  });
}
export async function observeSessionOpen<T>(
  stage: SessionOpenStage,
  operation: () => Promise<T>,
  report: (failure: SessionOpenFailure) => void = failure => console.error(JSON.stringify(failure)),
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Diagnostics must never replace the original failure or alter authorization.
    try { report(sessionOpenFailure(stage, error)); } catch { /* Preserve original error. */ }
    throw error;
  }
}

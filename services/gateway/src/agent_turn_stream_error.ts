import { PlatformError } from "@masanawa/contracts";
import { CustomerAuthError } from "./customer_auth.js";

/**
 * The streamed route has already emitted HTTP 200. Preserve only errors
 * proved to arise before any turn/run/tool operation: admission of a stale
 * or missing server session. No raw provider exceptions are sent to clients.
 *
 * Once any model/audio output was seen the outcome is ambiguous: the client
 * must reconcile the original request ID, never transparently resend.
 */
export function safeAgentTurnStreamErrorCode(
  error: unknown,
  outputEmitted: boolean,
): string {
  if (outputEmitted) return "turn_failed";
  // NDJSON's 200 status bypasses normal 401 refresh handling. Tell the
  // existing Flutter session UI when sign-in is required, without exposing
  // tokens or raw auth messages. Do not replay automatically.
  if (error instanceof CustomerAuthError && error.statusCode === 401) {
    return "auth_required";
  }
  if (!(error instanceof PlatformError)) return "turn_failed";
  switch (error.code) {
    case "agents.session_closed":
    case "agents.session_persona_changed":
    case "agents.session_not_found":
      return error.code;
    default:
      return "turn_failed";
  }
}

import { PlatformError } from "@masanawa/contracts";

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
  if (outputEmitted || !(error instanceof PlatformError)) return "turn_failed";
  switch (error.code) {
    case "agents.session_closed":
    case "agents.session_persona_changed":
    case "agents.session_not_found":
      return error.code;
    default:
      return "turn_failed";
  }
}

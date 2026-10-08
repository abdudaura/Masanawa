import '../core/network/api_client.dart';

/// Only errors known to occur *before* any agent turn side effects can
/// transparently reopen the current account's session. In particular a
/// generic 409, pending turn or uncertain payment must not be replayed.
bool isRecoverableAgentSessionError(Object error) {
  if (error is! ApiException) return false;
  switch (error.code) {
    case 'agents.session_not_found':
    case 'agents.session_closed':
    case 'agents.session_persona_changed':
      return true;
    default:
      // A bare 404 is ambiguous: it may be an unauthorized character,
      // removed account or unrelated route. Re-opening and resending the
      // original request would be unsafe without a precise pre-dispatch code.
      return false;
  }
}

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
    case null:
      // Backward compatibility for older Gateway builds that omit an error
      // code from a missing-session 404.
      return error.statusCode == 404;
    default:
      return false;
  }
}

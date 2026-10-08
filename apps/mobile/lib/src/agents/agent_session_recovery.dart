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


/// NDJSON is already HTTP 200 when a turn fails. Only a trusted, typed
/// pre-dispatch denial before ANY delta/audio can trigger automatic recovery.
/// In all other cases the original request outcome must be reconciled first.
ApiException streamedAgentTurnError(
  Map<String, dynamic> event, {
  required bool outputReceived,
}) {
  final code = event['code'];
  if (!outputReceived && code == 'auth_required') {
    return const ApiException(
      'Please sign in to continue this AI conversation.',
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    );
  }
  if (!outputReceived &&
      (code == 'agents.session_not_found' ||
          code == 'agents.session_closed' ||
          code == 'agents.session_persona_changed')) {
    return ApiException(
      'This AI conversation changed. Reconnecting is required.',
      statusCode: 409,
      code: code as String,
    );
  }
  return const ApiException(
    'The agent response ended unexpectedly. Check the conversation before retrying.',
    code: 'AGENT_TURN_OUTCOME_UNKNOWN',
  );
}

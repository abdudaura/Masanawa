import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_session_recovery.dart';
import 'package:masanawa/src/core/network/api_client.dart';

void main() {
  test('reopens only canonical old-session and persona-change errors', () {
    for (final code in [
      'agents.session_closed',
      'agents.session_not_found',
      'agents.session_persona_changed',
    ]) {
      expect(
        isRecoverableAgentSessionError(
          ApiException('Stale session', code: code, statusCode: 409),
        ),
        isTrue,
      );
    }
    expect(
      isRecoverableAgentSessionError(const ApiException('missing', statusCode: 404)),
      isTrue,
    );
  });

  test('never replays pending or unknown financial/turn conflict', () {
    for (final code in [
      'agents.turn_pending',
      'agents.shell_action_outcome_unknown',
      'commerce.payment_outcome_unknown',
      'billing.confirmation_pending',
    ]) {
      expect(
        isRecoverableAgentSessionError(
          ApiException('Unknown outcome', statusCode: 409, code: code),
        ),
        isFalse,
      );
    }
    expect(
      isRecoverableAgentSessionError(
        const ApiException('Conflict', statusCode: 409),
      ),
      isFalse,
    );
  });

  test('never treats denied authorization and generic network errors as session repair', () {
    expect(
      isRecoverableAgentSessionError(
        const ApiException('Forbidden', code: 'unauthorized', statusCode: 403),
      ),
      isFalse,
    );
    expect(
      isRecoverableAgentSessionError(
        const ApiException('Wrong target', code: 'person_not_found', statusCode: 404),
      ),
      isFalse,
    );
    expect(
      isRecoverableAgentSessionError(const ApiException('Disconnected')),
      isFalse,
    );
    expect(isRecoverableAgentSessionError(StateError('down')), isFalse);
  });
}

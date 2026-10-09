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
      isRecoverableAgentSessionError(
        const ApiException('Unknown missing resource', statusCode: 404),
      ),
      isFalse,
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

  test('streamed typed stale denial is retryable only before any output', () {
    for (final code in [
      'agents.session_not_found',
      'agents.session_closed',
      'agents.session_persona_changed',
    ]) {
      final preflight = streamedAgentTurnError(
        {'type': 'error', 'code': code},
        outputReceived: false,
      );
      expect(preflight.code, code);
      expect(isRecoverableAgentSessionError(preflight), isTrue);

      final afterAudioOrText = streamedAgentTurnError(
        {'type': 'error', 'code': code},
        outputReceived: true,
      );
      expect(isRecoverableAgentSessionError(afterAudioOrText), isFalse);
      expect(afterAudioOrText.code, 'AGENT_TURN_OUTCOME_UNKNOWN');
    }
  });

  test('unknown streamed errors never retry or expose server messages', () {
    for (final event in [
      <String, dynamic>{'type': 'error', 'code': 'turn_failed'},
      <String, dynamic>{
        'type': 'error',
        'code': 'agents.turn_pending',
        'message': 'secret provider information'
      },
      <String, dynamic>{'type': 'error', 'code': null},
      <String, dynamic>{'type': 'error', 'code': 404},
    ]) {
      final error = streamedAgentTurnError(event, outputReceived: false);
      expect(error.code, 'AGENT_TURN_OUTCOME_UNKNOWN');
      expect(error.message, isNot(contains('secret provider')));
      expect(isRecoverableAgentSessionError(error), isFalse);
    }
  });

  test('401 in an empty streamed turn requires sign-in but never blind replay', () {
    final denied = streamedAgentTurnError(
      {'type': 'error', 'code': 'auth_required'},
      outputReceived: false,
    );
    expect(denied.statusCode, 401);
    expect(denied.code, 'AUTH_REQUIRED');
    expect(isRecoverableAgentSessionError(denied), isFalse);
    final ambiguous = streamedAgentTurnError(
      {'type': 'error', 'code': 'auth_required'},
      outputReceived: true,
    );
    expect(ambiguous.code, 'AGENT_TURN_OUTCOME_UNKNOWN');
    expect(isRecoverableAgentSessionError(ambiguous), isFalse);
  });

}

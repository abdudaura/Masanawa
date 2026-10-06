import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_feedback.dart';
import 'package:masanawa/src/core/network/api_client.dart';

void main() {
  test('stream auth failure asks the user to sign in', () {
    final feedback = AgentFeedback.fromError(
      ApiException('Agent streaming turn failed', code: 'AUTH_REQUIRED'),
      conversation: true,
    );

    expect(feedback.message, 'Please sign in again to continue.');
    expect(feedback.actionLabel, 'Sign in');
  });

  test('stream unknown-agent failure says the agent is unavailable', () {
    final feedback = AgentFeedback.fromError(
      ApiException('Agent streaming turn failed', code: 'AGENT_UNAVAILABLE'),
      conversation: true,
    );

    expect(feedback.message, 'This agent isn’t available right now.');
    expect(feedback.actionLabel, 'Try again');
  });

  test('unknown stream failure keeps the generic retry copy', () {
    final feedback = AgentFeedback.fromError(
      ApiException('Agent streaming turn failed'),
      conversation: true,
    );

    expect(feedback.message, 'I couldn’t respond just now. Please try again.');
    expect(feedback.actionLabel, 'Try again');
  });
}

import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';

import 'agent_recovery_test.dart' show RecoveringTransport;

class _EmojiTransport extends RecoveringTransport {
  final delivered = <String>[];

  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String delta)? onTextDelta,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    delivered.add(text);
    onTextDelta?.call('Received');
    return const AgentTurnResult(text: 'Received', agentRunId: 'run-emoji');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('emoji-only and combined Unicode reach transport without alteration', () async {
    final transport = _EmojiTransport();
    final container = ProviderContainer(overrides: [
      agentTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    final chat = container.read(aiChatProvider.notifier);
    const family = '👩🏽‍👩🏻‍👧🏾‍👦🏿';
    const sequence = '🇳🇬 🧑🏿‍💻 ❤️‍🔥 🏳️‍🌈 🫶🏽';
    await chat.sendText('character-emoji', family);
    await chat.sendText('character-emoji', sequence);
    expect(transport.delivered, [family, sequence]);
    expect(
      chat.threadOf('character-emoji').messages.where((m) => m.isUser)
        .map((m) => m.text).toList(),
      [family, sequence],
    );
    expect(chat.threadOf('character-emoji').messages.where((m) => !m.isUser),
      hasLength(2));
  });

  test('blank Unicode whitespace does not send a phantom message', () async {
    final transport = _EmojiTransport();
    final container = ProviderContainer(overrides: [
      agentTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    await container.read(aiChatProvider.notifier).sendText(
      'character-empty', '  \u2003  ',
    );
    expect(transport.delivered, isEmpty);
  });
}

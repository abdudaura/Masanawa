import 'dart:typed_data';

import '../chat/message_parts.dart';

/// Thin-client boundary for one Character conversation.
///
/// The phone never owns Character identity, memory, Skills, Tools or Workflows.
/// It holds only server references needed to render and resume a conversation.
class AgentSessionBinding {
  const AgentSessionBinding({
    required this.characterId,
    required this.characterSessionId,
    this.agentRunId,
  });

  final String characterId;
  final String characterSessionId;
  final String? agentRunId;

  Map<String, dynamic> toJson() => {
        'characterId': characterId,
        'characterSessionId': characterSessionId,
        if (agentRunId != null) 'agentRunId': agentRunId,
      };

  factory AgentSessionBinding.fromJson(Map<String, dynamic> json) =>
      AgentSessionBinding(
        characterId: json['characterId'] as String? ?? '',
        characterSessionId: json['characterSessionId'] as String? ?? '',
        agentRunId: json['agentRunId'] as String?,
      );
}

/// One assistant turn. Text/audio narration and structured work results may
/// coexist. Structured parts carry durable references, never local authority.
class AgentTurnResult {
  const AgentTurnResult({
    required this.text,
    this.parts = const [],
    this.agentRunId,
  });

  final String text;
  final List<AgentMessagePart> parts;
  final String? agentRunId;
}

abstract class AgentTransport {
  Future<AgentSessionBinding> openSession(String characterId);

  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  });

  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
  });

  Future<void> closeSession(AgentSessionBinding binding);
}

/// Compatibility transport used only when the canonical runtime is not wired.
/// It can converse, but cannot invent an agent roster or durable work results.
class PreviewAgentTransport implements AgentTransport {
  PreviewAgentTransport({required this.sendPreview});

  final Future<String> Function(String message, String characterId) sendPreview;

  @override
  Future<AgentSessionBinding> openSession(String characterId) async =>
      AgentSessionBinding(
        characterId: characterId,
        characterSessionId: 'preview-$characterId',
      );

  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
  }) async =>
      AgentTurnResult(
        text: await sendPreview(text, binding.characterId),
      );

  @override
  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
  }) async {
    throw UnsupportedError(
      'Preview transport cannot inspect attachment bytes',
    );
  }

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {}
}

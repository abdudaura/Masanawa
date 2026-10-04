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
class AgentMediaInput {
  const AgentMediaInput({
    required this.bytes,
    required this.mimeType,
    this.name,
  });

  final Uint8List bytes;
  final String mimeType;
  final String? name;
}

class AgentTurnResult {
  const AgentTurnResult({
    required this.text,
    this.parts = const [],
    this.agentRunId,
    this.audioBytes,
    this.audioMimeType,
    this.audioDurationMs,
  });

  final String text;
  final List<AgentMessagePart> parts;
  final String? agentRunId;
  final Uint8List? audioBytes;
  final String? audioMimeType;
  final int? audioDurationMs;
}

abstract class AgentTransport {
  Future<AgentSessionBinding> openSession(String characterId);

  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String delta)? onTextDelta,
  });

  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
  });

  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
  });

  void cancelTurn(String characterId);

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
    void Function(String delta)? onTextDelta,
  }) async {
    final reply = await sendPreview(text, binding.characterId);
    onTextDelta?.call(reply);
    return AgentTurnResult(text: reply);
  }

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
  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
  }) async {
    final total = media.fold<int>(0, (sum, item) => sum + item.bytes.length);
    onUploadProgress?.call(total, total);
    final reply = await sendPreview(
      caption.isEmpty ? 'Review these ${media.length} attachments.' : caption,
      binding.characterId,
    );
    return AgentTurnResult(text: reply);
  }

  @override
  void cancelTurn(String characterId) {}

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {}
}

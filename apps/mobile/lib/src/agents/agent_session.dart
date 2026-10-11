import 'dart:typed_data';
import 'package:flutter/foundation.dart';

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

/// Server acknowledgment of canonical command custody, never human delivery/read.
@immutable
class AgentTurnReceipt {
  const AgentTurnReceipt({required this.requestId, required this.state});
  final String requestId;
  final String state;

  static AgentTurnReceipt? fromEvent(
    Map<String, dynamic> event,
    String expectedRequestId,
  ) {
    final requestId = event['requestId'];
    final state = event['state'];
    if (requestId is! String ||
        requestId != expectedRequestId ||
        !RegExp(
          r'^request_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ).hasMatch(requestId) ||
        !const {'pending', 'completed', 'failed'}.contains(state))
      return null;
    return AgentTurnReceipt(requestId: requestId, state: state as String);
  }
}

abstract class AgentTransport {
  Future<AgentSessionBinding> openSession(String characterId);

  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String delta)? onTextDelta,
    void Function(AgentTurnReceipt)? onAccepted,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  });

  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
    String? requestId,
  });

  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
    String? requestId,
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
    void Function(AgentTurnReceipt)? onAccepted,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
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
    void Function(int sent, int total)? onUploadProgress,
    String? requestId,
  }) async {
    onUploadProgress?.call(bytes.length, bytes.length);
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
    String? requestId,
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

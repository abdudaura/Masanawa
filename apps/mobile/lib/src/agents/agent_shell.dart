import 'dart:async';

import '../chat/shell_action_coordinator.dart';
import '../chat/shell_document.dart';

const String kMasanawaShellVersion = '1.0.0';

class AgentShellConfig {
  const AgentShellConfig({
    required this.shellVersion,
    required this.minimumAppVersion,
    required this.recommendedAppVersion,
    required this.features,
  });
  final int shellVersion;
  final String minimumAppVersion;
  final String recommendedAppVersion;
  final Map<String, bool> features;

  bool feature(String key, {bool fallback = false}) =>
      features[key] ?? fallback;

  bool requiresUpdate([String current = kMasanawaShellVersion]) =>
      _compareVersions(current, minimumAppVersion) < 0;

  static int _compareVersions(String left, String right) {
    List<int> parts(String value) => value
        .split(RegExp(r'[.+-]'))
        .take(3)
        .map((part) => int.tryParse(part) ?? 0)
        .toList();
    final a = parts(left);
    final b = parts(right);
    for (var i = 0; i < 3; i++) {
      final av = i < a.length ? a[i] : 0;
      final bv = i < b.length ? b[i] : 0;
      if (av != bv) return av.compareTo(bv);
    }
    return 0;
  }

  factory AgentShellConfig.fromJson(Map<String, dynamic> json) => AgentShellConfig(
        shellVersion: json['shellVersion'] as int? ?? 0,
        minimumAppVersion: json['minimumAppVersion'] as String? ?? '0.0.0',
        recommendedAppVersion:
            json['recommendedAppVersion'] as String? ?? '0.0.0',
        features: {
          for (final entry
              in (json['features'] as Map? ?? const {}).entries)
            if (entry.key is String && entry.value is bool)
              entry.key as String: entry.value as bool,
        },
      );
}

class AgentHistoryMessage {
  const AgentHistoryMessage({
    required this.key,
    required this.direction,
    required this.requestId,
    required this.text,
    required this.parts,
    required this.createdAt,
    this.agentRunId,
    this.replyToKey,
  });
  final String key;
  final String direction;
  final String requestId;
  final String text;
  final List<Map<String, dynamic>> parts;
  final DateTime createdAt;
  final String? agentRunId;

  /// Canonical server history key of this assistant reply's initiating message.
  final String? replyToKey;

  factory AgentHistoryMessage.fromJson(Map<String, dynamic> json) =>
      AgentHistoryMessage(
        key: json['key'] as String? ?? '',
        direction: json['direction'] as String? ?? '',
        requestId: json['requestId'] as String? ?? '',
        text: json['text'] as String? ?? '',
        parts: [
          for (final raw in (json['parts'] as List? ?? const []))
            if (raw is Map) raw.cast<String, dynamic>(),
        ],
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0),
        agentRunId: json['agentRunId'] as String?,
        replyToKey: json['replyToKey'] as String?,
      );
}

class AgentTurnStatus {
  const AgentTurnStatus({
    required this.state,
    this.reply,
    this.parts = const [],
    this.agentRunId,
    this.failureCode,
  });
  final String state;
  final String? reply;
  final List<Map<String, dynamic>> parts;
  final String? agentRunId;
  final String? failureCode;
}

class AgentShellEvent {
  const AgentShellEvent({
    required this.cursor,
    required this.type,
    required this.payload,
    required this.createdAt,
  });
  final String cursor;
  final String type;
  final Map<String, dynamic> payload;
  final DateTime createdAt;

  factory AgentShellEvent.fromJson(Map<String, dynamic> json) => AgentShellEvent(
        cursor: json['cursor']?.toString() ?? '',
        type: json['type'] as String? ?? '',
        payload: (json['payload'] as Map? ?? const {}).cast<String, dynamic>(),
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0),
      );
}

class AgentLiveVoiceGrant {
  const AgentLiveVoiceGrant({
    required this.token,
    required this.websocketUrl,
    required this.model,
    required this.voiceName,
    required this.expiresAt,
  });
  final String token;
  final String websocketUrl;
  final String model;
  final String voiceName;
  final DateTime expiresAt;
}

abstract class AgentShellTransport {
  Future<AgentShellConfig> loadShellConfig(String characterId);
  Future<List<AgentHistoryMessage>> loadHistory(
    String characterId, {
    int limit = 100,
    String? before,
  });
  Future<AgentTurnStatus> turnStatus(String characterId, String requestId);
  Stream<AgentShellEvent> events(
    String characterId, {
    String? after,
  });
  Future<void> dispatchAction({
    required String characterId,
    required String characterSessionId,
    required ShellAction action,
  });
  Future<bool> actionAccepted({
    required String characterId,
    required ShellAction action,
  });
  Future<AgentLiveVoiceGrant> mintLiveVoiceGrant(
    String characterId, {
    String? admissionId,
    String purpose = 'conversation',
  });
  Future<void> setPresence({
    required String characterId,
    required String state,
    int durationMs = 60000,
  });
  Future<void> registerPush({
    required String characterId,
    required String installationId,
    required String platform,
    required String token,
  });
  Future<void> unregisterPush({
    required String characterId,
    required String installationId,
  });
}

class TransportShellActionDispatcher implements ShellActionDispatcher {
  TransportShellActionDispatcher({
    required this.transport,
    required this.characterId,
    required this.characterSessionId,
  });
  final AgentShellTransport transport;
  final String characterId;
  final String characterSessionId;

  @override
  Future<void> dispatch(ShellAction action) => transport.dispatchAction(
        characterId: characterId,
        characterSessionId: characterSessionId,
        action: action,
      );

  @override
  Future<bool> accepted(ShellAction action) => transport.actionAccepted(
        characterId: characterId,
        action: action,
      );
}

enum TalkLiveRole { host, speaker, listener }

enum TalkLiveLifecycle { live, reconnecting, ended }

class TalkLiveSessionView {
  const TalkLiveSessionView({
    required this.sessionId,
    required this.talkId,
    required this.role,
    required this.state,
    required this.canPublishAudio,
    required this.canHearAudio,
    required this.aiGenerationAllowed,
    this.reconnectGraceEndsAt,
  });

  final String sessionId;
  final String talkId;
  final TalkLiveRole role;
  final TalkLiveLifecycle state;
  final bool canPublishAudio;
  final bool canHearAudio;
  final bool aiGenerationAllowed;
  final DateTime? reconnectGraceEndsAt;

  factory TalkLiveSessionView.fromJson(Map<String, dynamic> json) {
    return TalkLiveSessionView(
      sessionId: json['sessionId'] as String? ?? '',
      talkId: json['talkId'] as String? ?? '',
      role: switch (json['role']) {
        'host' => TalkLiveRole.host,
        'speaker' => TalkLiveRole.speaker,
        _ => TalkLiveRole.listener,
      },
      state: _lifecycle(json['state']),
      canPublishAudio: json['canPublishAudio'] == true,
      canHearAudio: json['canHearAudio'] != false,
      aiGenerationAllowed: json['aiGenerationAllowed'] == true,
      reconnectGraceEndsAt: _date(json['reconnectGraceEndsAt']),
    );
  }
}

class TalkLiveStateView {
  const TalkLiveStateView({
    required this.talkId,
    required this.state,
    required this.hostConnected,
    required this.listenerCount,
    required this.aiGenerationAllowed,
    this.reconnectGraceEndsAt,
  });

  final String talkId;
  final TalkLiveLifecycle state;
  final bool hostConnected;
  final int listenerCount;
  final bool aiGenerationAllowed;
  final DateTime? reconnectGraceEndsAt;

  factory TalkLiveStateView.fromJson(Map<String, dynamic> json) {
    return TalkLiveStateView(
      talkId: json['talkId'] as String? ?? '',
      state: _lifecycle(json['state']),
      hostConnected: json['hostConnected'] == true,
      listenerCount: (json['listenerCount'] as num?)?.toInt() ?? 0,
      aiGenerationAllowed: json['aiGenerationAllowed'] == true,
      reconnectGraceEndsAt: _date(json['reconnectGraceEndsAt']),
    );
  }
}

class TalkLiveMediaCredentials {
  const TalkLiveMediaCredentials({
    required this.serverUrl,
    required this.participantToken,
    required this.roomName,
    required this.participantIdentity,
    required this.expiresAt,
  });

  final String serverUrl;
  final String participantToken;
  final String roomName;
  final String participantIdentity;
  final DateTime expiresAt;

  factory TalkLiveMediaCredentials.fromJson(Map<String, dynamic> json) {
    return TalkLiveMediaCredentials(
      serverUrl: json['server_url'] as String? ?? '',
      participantToken: json['participant_token'] as String? ?? '',
      roomName: json['room_name'] as String? ?? '',
      participantIdentity: json['participant_identity'] as String? ?? '',
      expiresAt:
          DateTime.tryParse(json['expires_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

abstract interface class TalkLiveTransport {
  Future<TalkLiveSessionView> connect(String talkId);

  Future<TalkLiveSessionView> heartbeat({
    required String talkId,
    required String sessionId,
  });

  Future<TalkLiveStateView> disconnect({
    required String talkId,
    required String sessionId,
  });

  Future<TalkLiveMediaCredentials> mediaToken({
    required String talkId,
    required String sessionId,
  });

  Future<TalkLiveStateView> state(String talkId);
}

TalkLiveLifecycle _lifecycle(Object? raw) => switch (raw) {
  'reconnecting' => TalkLiveLifecycle.reconnecting,
  'ended' => TalkLiveLifecycle.ended,
  _ => TalkLiveLifecycle.live,
};

DateTime? _date(Object? raw) {
  if (raw is! String || raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}

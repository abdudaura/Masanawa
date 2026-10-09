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
    // A partial or stale response must never upgrade a listener into a
    // microphone publisher. The server owns the grant; this client can only
    // narrow it while verifying that the response is a usable session.
    final sessionId = json['sessionId'] is String
        ? (json['sessionId'] as String).trim()
        : '';
    final talkId = json['talkId'] is String
        ? (json['talkId'] as String).trim()
        : '';
    final role = switch (json['role']) {
      'host' => TalkLiveRole.host,
      'speaker' => TalkLiveRole.speaker,
      _ => TalkLiveRole.listener,
    };
    final state = _lifecycle(json['state']);
    final validSession = sessionId.startsWith('talk-live_') &&
        sessionId.length > 'talk-live_'.length &&
        talkId.isNotEmpty;
    final canHearAudio =
        validSession && state != TalkLiveLifecycle.ended &&
        json['canHearAudio'] == true;
    final canPublishAudio =
        canHearAudio && state == TalkLiveLifecycle.live &&
        role != TalkLiveRole.listener && json['canPublishAudio'] == true;

    return TalkLiveSessionView(
      sessionId: sessionId,
      talkId: talkId,
      role: role,
      state: state,
      canPublishAudio: canPublishAudio,
      canHearAudio: canHearAudio,
      aiGenerationAllowed:
          canHearAudio && state == TalkLiveLifecycle.live &&
          role == TalkLiveRole.host && json['aiGenerationAllowed'] == true,
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
    final talkId = json['talkId'] is String
        ? (json['talkId'] as String).trim()
        : '';
    final state = _lifecycle(json['state']);
    final live = state == TalkLiveLifecycle.live && talkId.isNotEmpty;
    final count = json['listenerCount'];
    return TalkLiveStateView(
      talkId: talkId,
      state: state,
      hostConnected: live && json['hostConnected'] == true,
      listenerCount: count is int && count >= 0 ? count : 0,
      aiGenerationAllowed: live &&
          json['hostConnected'] == true &&
          json['aiGenerationAllowed'] == true,
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
  // Unknown/missing states must never be promoted to a live audio grant.
  _ => TalkLiveLifecycle.ended,
};

DateTime? _date(Object? raw) {
  if (raw is! String || raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}

import 'package:livekit_client/livekit_client.dart';

import 'talk_live.dart';

abstract interface class TalkLiveRoom {
  Future<void> connect({
    required TalkLiveMediaCredentials credentials,
    required bool publishMicrophone,
  });

  Future<void> setMicrophoneEnabled(bool enabled);

  Future<void> close();
}

class LiveKitTalkLiveRoom implements TalkLiveRoom {
  Room? _room;
  bool _mayPublishMicrophone = false;

  static Future<void>? _initializing;

  static Future<void> _initializeLiveKit() {
    final active = _initializing;
    if (active != null) return active;
    final future = LiveKitClient.initialize();
    _initializing = future;
    return future;
  }

  @override
  Future<void> connect({
    required TalkLiveMediaCredentials credentials,
    required bool publishMicrophone,
  }) async {
    if (_room != null) return;
    if (credentials.serverUrl.isEmpty ||
        credentials.participantToken.isEmpty) {
      throw StateError('Live audio credentials are unavailable.');
    }

    await _initializeLiveKit();

    final room = Room();
    try {
      await room.connect(
        credentials.serverUrl,
        credentials.participantToken,
        connectOptions: const ConnectOptions(autoSubscribe: true),
      );
      if (AudioManager.instance.canSwitchSpeakerphone) {
        await AudioManager.instance.setSpeakerOutputPreferred(true);
      }
      _mayPublishMicrophone = publishMicrophone;
      if (publishMicrophone) {
        final participant = room.localParticipant;
        if (participant == null) {
          throw StateError('Live audio participant is unavailable.');
        }
        await participant.setMicrophoneEnabled(true);
      }
      _room = room;
    } catch (_) {
      _room = null;
      _mayPublishMicrophone = false;
      await room.dispose();
      rethrow;
    }
  }

  @override
  Future<void> setMicrophoneEnabled(bool enabled) async {
    final room = _room;
    if (room == null) return;
    if (!_mayPublishMicrophone && enabled) {
      throw StateError('This listener cannot publish microphone audio.');
    }
    final participant = room.localParticipant;
    if (participant == null) return;
    await participant.setMicrophoneEnabled(
      enabled && _mayPublishMicrophone,
    );
  }

  @override
  Future<void> close() async {
    final room = _room;
    _room = null;
    if (room == null) return;
    try {
      final participant = room.localParticipant;
      if (_mayPublishMicrophone && participant != null) {
        await participant.setMicrophoneEnabled(false);
      }
    } catch (_) {
      // The room may already be disconnected.
    }
    try {
      await room.disconnect();
    } catch (_) {
      // Best-effort media disconnect.
    }
    await room.dispose();
    if (AudioManager.instance.canSwitchSpeakerphone) {
      try {
        await AudioManager.instance.setSpeakerOutputPreferred(false);
      } catch (_) {
        // Audio routing may already have returned to the system default.
      }
    }
    _mayPublishMicrophone = false;
  }
}

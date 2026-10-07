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
      _room = room;
      _mayPublishMicrophone = publishMicrophone;
      if (publishMicrophone) {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
    } catch (_) {
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
    await room.localParticipant.setMicrophoneEnabled(
      enabled && _mayPublishMicrophone,
    );
  }

  @override
  Future<void> close() async {
    final room = _room;
    _room = null;
    if (room == null) return;
    try {
      if (_mayPublishMicrophone) {
        await room.localParticipant.setMicrophoneEnabled(false);
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
    _mayPublishMicrophone = false;
  }
}

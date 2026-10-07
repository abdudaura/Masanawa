import 'dart:async';

import 'talk_live.dart';
import 'talk_live_room.dart';

enum TalkLiveAudioStatus {
  idle,
  connecting,
  listening,
  publishing,
  reconnecting,
  ended,
  failed,
}

abstract interface class TalkLiveAudioController {
  TalkLiveAudioStatus get status;
  TalkLiveRole? get role;
  bool get muted;
  String? get errorMessage;
  Stream<TalkLiveAudioStatus> get states;

  Future<void> start();
  Future<void> setMuted(bool muted);
  Future<void> close();
}

class TalkLiveAudioSession implements TalkLiveAudioController {
  TalkLiveAudioSession({
    required this.talkId,
    required this.transport,
    required this.room,
    this.heartbeatInterval = const Duration(seconds: 10),
  });

  final String talkId;
  final TalkLiveTransport transport;
  final TalkLiveRoom room;
  final Duration heartbeatInterval;

  final _states = StreamController<TalkLiveAudioStatus>.broadcast(sync: true);
  Timer? _heartbeatTimer;
  Future<void>? _starting;
  Future<void>? _closing;
  String? _sessionId;
  TalkLiveRole? _role;
  TalkLiveAudioStatus _status = TalkLiveAudioStatus.idle;
  bool _muted = false;
  bool _closed = false;
  String? _errorMessage;

  @override
  TalkLiveAudioStatus get status => _status;

  @override
  TalkLiveRole? get role => _role;

  @override
  bool get muted => _muted;

  @override
  String? get errorMessage => _errorMessage;

  @override
  Stream<TalkLiveAudioStatus> get states => _states.stream;

  @override
  Future<void> start() async {
    final active = _starting;
    if (active != null) return active;
    if (_closed || _sessionId != null) return;

    final future = _start();
    _starting = future;
    try {
      await future;
    } finally {
      if (identical(_starting, future)) _starting = null;
    }
  }

  Future<void> _start() async {
    _setStatus(TalkLiveAudioStatus.connecting);
    try {
      final session = await transport.connect(talkId);
      if (_closed) return;

      _sessionId = session.sessionId;
      _role = session.role;

      if (session.state == TalkLiveLifecycle.ended ||
          !session.canHearAudio) {
        _setStatus(TalkLiveAudioStatus.ended);
        return;
      }

      final credentials = await transport.mediaToken(
        talkId: talkId,
        sessionId: session.sessionId,
      );
      if (_closed) return;

      final mayPublish = session.role == TalkLiveRole.host &&
          session.canPublishAudio &&
          session.state == TalkLiveLifecycle.live;
      await room.connect(
        credentials: credentials,
        publishMicrophone: mayPublish,
      );
      if (_closed) return;

      _muted = false;
      _setStatus(
        session.state == TalkLiveLifecycle.reconnecting
            ? TalkLiveAudioStatus.reconnecting
            : mayPublish
                ? TalkLiveAudioStatus.publishing
                : TalkLiveAudioStatus.listening,
      );

      _heartbeatTimer = Timer.periodic(
        heartbeatInterval,
        (_) => unawaited(_heartbeat()),
      );
    } catch (_) {
      _fail('Live audio is unavailable right now.');
      await _closeMediaOnly();
    }
  }

  Future<void> _heartbeat() async {
    final sessionId = _sessionId;
    if (_closed || sessionId == null) return;
    try {
      final session = await transport.heartbeat(
        talkId: talkId,
        sessionId: sessionId,
      );
      if (_closed) return;

      _role = session.role;
      if (session.state == TalkLiveLifecycle.ended ||
          !session.canHearAudio) {
        _setStatus(TalkLiveAudioStatus.ended);
        _heartbeatTimer?.cancel();
        await _closeMediaOnly();
        return;
      }

      if (session.state == TalkLiveLifecycle.reconnecting) {
        if (session.role == TalkLiveRole.host) {
          try {
            await room.setMicrophoneEnabled(false);
          } catch (_) {
            // Reconnection state is still authoritative even if local media
            // is already torn down.
          }
        }
        _setStatus(TalkLiveAudioStatus.reconnecting);
        return;
      }

      final mayPublish =
          session.role == TalkLiveRole.host && session.canPublishAudio;
      if (mayPublish) {
        await room.setMicrophoneEnabled(!_muted);
        _setStatus(TalkLiveAudioStatus.publishing);
      } else {
        _setStatus(TalkLiveAudioStatus.listening);
      }
    } catch (_) {
      if (_closed) return;
      _setStatus(TalkLiveAudioStatus.reconnecting);
    }
  }

  @override
  Future<void> setMuted(bool muted) async {
    if (_closed || _role != TalkLiveRole.host) return;
    try {
      await room.setMicrophoneEnabled(!muted);
      _muted = muted;
      if (_status != TalkLiveAudioStatus.reconnecting) {
        _setStatus(TalkLiveAudioStatus.publishing);
      }
    } catch (_) {
      _fail('Couldn’t update the microphone.');
    }
  }

  void _setStatus(TalkLiveAudioStatus status) {
    if (_closed && status != TalkLiveAudioStatus.ended) return;
    _status = status;
    if (!_states.isClosed) _states.add(status);
  }

  void _fail(String message) {
    _errorMessage = message;
    _setStatus(TalkLiveAudioStatus.failed);
  }

  Future<void> _closeMediaOnly() async {
    try {
      await room.close();
    } catch (_) {
      // Best-effort media cleanup.
    }
  }

  @override
  Future<void> close() async {
    final active = _closing;
    if (active != null) return active;
    final future = _close();
    _closing = future;
    return future;
  }

  Future<void> _close() async {
    if (_closed) return;
    _closed = true;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;

    final sessionId = _sessionId;
    _sessionId = null;
    await _closeMediaOnly();

    if (sessionId != null) {
      try {
        await transport.disconnect(
          talkId: talkId,
          sessionId: sessionId,
        );
      } catch (_) {
        // App teardown is best effort. Server heartbeat expiry remains the
        // authority if this final packet cannot be delivered.
      }
    }

    _status = TalkLiveAudioStatus.ended;
    if (!_states.isClosed) {
      _states.add(TalkLiveAudioStatus.ended);
      await _states.close();
    }
  }
}

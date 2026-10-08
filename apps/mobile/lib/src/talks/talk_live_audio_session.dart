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
  Future<void>? _heartbeatInFlight;
  String? _sessionId;
  TalkLiveRole? _role;
  TalkLiveAudioStatus _status = TalkLiveAudioStatus.idle;
  bool _muted = false;
  bool _canPublishAudio = false;
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
    _errorMessage = null;
    _setStatus(TalkLiveAudioStatus.connecting);
    try {
      final session = await transport.connect(talkId);
      if (_closed) {
        // close() may have completed while the initial connect was pending.
        // Its teardown could not see this newly issued server session.
        try {
          await transport.disconnect(talkId: talkId, sessionId: session.sessionId);
        } catch (_) {
          // The server expires abandoned sessions via its heartbeat lease.
        }
        return;
      }

      _sessionId = session.sessionId;
      _role = session.role;

      if (session.state == TalkLiveLifecycle.ended || !session.canHearAudio) {
        // A server-side ended/ineligible session never obtains media; release
        // its lease rather than keeping an unreachable session ID locally.
        _sessionId = null;
        _role = null;
        try {
          await transport.disconnect(talkId: talkId, sessionId: session.sessionId);
        } catch (_) {
          // Heartbeat expiry is the server-side fallback.
        }
        if (!_closed) _setStatus(TalkLiveAudioStatus.ended);
        return;
      }

      final credentials = await transport.mediaToken(
        talkId: talkId,
        sessionId: session.sessionId,
      );
      if (_closed) return;
      final endpoint = Uri.tryParse(credentials.serverUrl);
      if (credentials.participantToken.trim().isEmpty ||
          endpoint == null ||
          (endpoint.scheme != 'wss' && endpoint.scheme != 'ws') ||
          endpoint.host.isEmpty ||
          !credentials.expiresAt.isAfter(DateTime.now())) {
        throw const FormatException('Talk live media credentials are invalid or expired');
      }

      final mayPublish =
          session.role != TalkLiveRole.listener &&
          session.canPublishAudio &&
          session.state == TalkLiveLifecycle.live;
      _canPublishAudio = mayPublish;
      await room.connect(
        credentials: credentials,
        publishMicrophone: mayPublish,
      );
      if (_closed) {
        // A late room.connect can finish after close() already disposed the
        // previous media state. Close it again to avoid orphaned microphone audio.
        await _closeMediaOnly();
        return;
      }

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
        (_) => _scheduleHeartbeat(),
      );
    } catch (_) {
      // A failed media token or LiveKit connection must not permanently pin
      // _sessionId: start() uses it to avoid opening duplicate live sessions.
      // Release the server session before allowing an explicit retry.
      _heartbeatTimer?.cancel();
      _heartbeatTimer = null;
      await _closeMediaOnly();
      final failedSessionId = _sessionId;
      _sessionId = null;
      _role = null;
      _canPublishAudio = false;
      _muted = false;
      if (failedSessionId != null) {
        try {
          await transport.disconnect(
            talkId: talkId,
            sessionId: failedSessionId,
          );
        } catch (_) {
          // The backend heartbeat lease expires if disconnect is unavailable.
        }
      }
      if (!_closed) _fail('Live audio is unavailable right now. Please try again.');
    }
  }

  void _scheduleHeartbeat() {
    if (_closed || _heartbeatInFlight != null) return;
    final future = _heartbeat();
    _heartbeatInFlight = future;
    unawaited(
      future.whenComplete(() {
        if (identical(_heartbeatInFlight, future)) {
          _heartbeatInFlight = null;
        }
      }),
    );
  }

  Future<void> _heartbeat() async {
    final sessionId = _sessionId;
    if (_closed || sessionId == null) return;
    try {
      final session = await transport.heartbeat(
        talkId: talkId,
        sessionId: sessionId,
      );
      // A late heartbeat must never restore microphone authority after the
      // session was disconnected by a concurrent failed mute/cleanup.
      if (_closed || _sessionId != sessionId) return;

      _role = session.role;
      if (session.state == TalkLiveLifecycle.ended || !session.canHearAudio) {
        _canPublishAudio = false;
        _heartbeatTimer?.cancel();
        _heartbeatTimer = null;
        _setStatus(TalkLiveAudioStatus.ended);
        await _closeMediaOnly();
        // The heartbeat has confirmed the session is no longer usable. Avoid
        // keeping stale publish rights or attempting an unnecessary reconnect.
        return;
      }

      if (session.state == TalkLiveLifecycle.reconnecting) {
        _canPublishAudio = false;
        if (session.role != TalkLiveRole.listener) {
          try {
            await room.setMicrophoneEnabled(false);
          } catch (_) {
            // The local microphone might still be publishing. Disconnecting
            // the room is safer than claiming we muted successfully.
            await _revokeUnsafeMicrophone();
            return;
          }
        }
        if (_closed || _sessionId != sessionId) return;
        _setStatus(TalkLiveAudioStatus.reconnecting);
        return;
      }

      final mayPublish =
          session.role != TalkLiveRole.listener && session.canPublishAudio;
      _canPublishAudio = mayPublish;
      if (mayPublish) {
        await room.setMicrophoneEnabled(!_muted);
        if (_closed || _sessionId != sessionId) {
          await _closeMediaOnly();
          return;
        }
        _setStatus(TalkLiveAudioStatus.publishing);
      } else {
        await room.setMicrophoneEnabled(false);
        if (_closed || _sessionId != sessionId) return;
        _setStatus(TalkLiveAudioStatus.listening);
      }
    } catch (_) {
      if (_closed || _sessionId != sessionId) return;
      // Failed heartbeats revoke published audio. If local mute fails,
      // tear down both the media room and server lease.
      _canPublishAudio = false;
      try {
        await room.setMicrophoneEnabled(false);
      } catch (_) {
        await _revokeUnsafeMicrophone();
        return;
      }
      if (!_closed && _sessionId == sessionId) {
        _setStatus(TalkLiveAudioStatus.reconnecting);
      }
    }
  }

  @override
  Future<void> setMuted(bool muted) async {
    if (_closed || _role == null || _role == TalkLiveRole.listener) return;
    _muted = muted;
    if (!_canPublishAudio) return;
    try {
      await room.setMicrophoneEnabled(!muted);
      _muted = muted;
      if (_status != TalkLiveAudioStatus.reconnecting) {
        _setStatus(TalkLiveAudioStatus.publishing);
      }
    } catch (_) {
      await _revokeUnsafeMicrophone();
    }
  }

  /// A failed mute is a privacy failure, not just a cosmetic button error.
  /// Drop stale publish grants and the server lease before allowing rejoin.
  Future<void> _revokeUnsafeMicrophone() async {
    _canPublishAudio = false;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _muted = true;
    _role = null;
    final revokedSessionId = _sessionId;
    _sessionId = null;
    await _closeMediaOnly();
    if (revokedSessionId != null) {
      try {
        await transport.disconnect(talkId: talkId, sessionId: revokedSessionId);
      } catch (_) {
        // A missed disconnect is constrained by the server lease.
      }
    }
    if (!_closed) _fail('Could not safely control the microphone. Rejoin the Talk.');
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
    _canPublishAudio = false;
    try {
      await _heartbeatInFlight;
    } catch (_) {
      // A failed in-flight heartbeat must not block teardown.
    }
    _heartbeatInFlight = null;

    final sessionId = _sessionId;
    _sessionId = null;
    await _closeMediaOnly();

    if (sessionId != null) {
      try {
        await transport.disconnect(talkId: talkId, sessionId: sessionId);
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


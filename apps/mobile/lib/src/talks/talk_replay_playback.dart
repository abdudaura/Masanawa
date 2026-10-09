import 'dart:async';

class TalkReplayPlaybackCredentials {
  const TalkReplayPlaybackCredentials({
    required this.url,
    required this.expiresAt,
    required this.contentType,
  });

  final String url;
  final DateTime expiresAt;
  final String contentType;

  // A signed S3 GET can expire while the app is paused. Never reuse the
  // embedded URL on a new request once it is near expiry.
  bool isFresh(DateTime at) =>
      expiresAt.isAfter(at.toUtc().add(const Duration(seconds: 15)));

  factory TalkReplayPlaybackCredentials.fromJson(Map<String, dynamic> json) {
    final url = json['url'] as String? ?? '';
    final expiresAt = DateTime.tryParse(json['expiresAt'] as String? ?? '');
    final contentType = json['contentType'] as String? ?? '';
    final uri = Uri.tryParse(url);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasFragment ||
        expiresAt == null ||
        contentType != 'audio/ogg') {
      throw const FormatException('Invalid replay playback response');
    }
    return TalkReplayPlaybackCredentials(
      url: url,
      expiresAt: expiresAt,
      contentType: contentType,
    );
  }
}

abstract interface class TalkReplayPlaybackTransport {
  Future<TalkReplayPlaybackCredentials> load(String talkId);
}

enum TalkReplayPlaybackStatus {
  idle,
  loading,
  playing,
  paused,
  completed,
  failed,
}

class TalkReplayPlaybackSnapshot {
  const TalkReplayPlaybackSnapshot({
    this.status = TalkReplayPlaybackStatus.idle,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.errorMessage,
  });

  final TalkReplayPlaybackStatus status;
  final Duration position;
  final Duration duration;
  final String? errorMessage;

  double get progress {
    if (duration.inMilliseconds <= 0) return 0;
    return (position.inMilliseconds / duration.inMilliseconds)
        .clamp(0.0, 1.0)
        .toDouble();
  }

  TalkReplayPlaybackSnapshot copyWith({
    TalkReplayPlaybackStatus? status,
    Duration? position,
    Duration? duration,
    String? errorMessage,
    bool clearError = false,
  }) {
    return TalkReplayPlaybackSnapshot(
      status: status ?? this.status,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
    );
  }
}

enum TalkReplayPlayerState { paused, playing, completed }

abstract interface class TalkReplayAudioPlayer {
  Stream<Duration> get positions;
  Stream<Duration?> get durations;
  Stream<TalkReplayPlayerState> get states;
  Stream<Object> get errors;

  Future<Duration?> load(String url);
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);
  Future<void> close();
}

abstract interface class TalkReplayPlaybackController {
  TalkReplayPlaybackSnapshot get snapshot;
  Stream<TalkReplayPlaybackSnapshot> get snapshots;

  Future<void> toggle();
  Future<void> seekTo(double fraction);
  Future<void> retry();
  Future<void> close();
}

class TalkReplayPlaybackSession implements TalkReplayPlaybackController {
  TalkReplayPlaybackSession({
    required this.talkId,
    required this.transport,
    required this.player,
    DateTime Function()? now,
    required bool Function() canAccess,
  }) : _canAccess = canAccess,
       _now = now ?? DateTime.now {
    _subscriptions.add(player.positions.listen(_positionChanged));
    _subscriptions.add(player.durations.listen(_durationChanged));
    _subscriptions.add(player.states.listen(_playerStateChanged));
    _subscriptions.add(player.errors.listen((_) => _fail()));
  }

  final String talkId;
  final TalkReplayPlaybackTransport transport;
  final TalkReplayAudioPlayer player;
  final DateTime Function() _now;
  final bool Function() _canAccess;

  bool _authorized() {
    try {
      return _canAccess();
    } catch (_) {
      return false;
    }
  }

  void _deny() {
    // Fail first: pause may synchronously emit another native player event.
    // Clear private credentials before the callback can observe any state.
    _fail();
    unawaited(player.pause().catchError((Object _) {}));
  }

  final _snapshots = StreamController<TalkReplayPlaybackSnapshot>.broadcast(
    sync: true,
  );
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  TalkReplayPlaybackSnapshot _snapshot = const TalkReplayPlaybackSnapshot();
  Future<void>? _operation;
  bool _closed = false;
  bool _loaded = false;
  TalkReplayPlaybackCredentials? _credentials;
  int _playGeneration = 0;

  @override
  TalkReplayPlaybackSnapshot get snapshot => _snapshot;

  @override
  Stream<TalkReplayPlaybackSnapshot> get snapshots => _snapshots.stream;

  void _emit(TalkReplayPlaybackSnapshot snapshot) {
    if (_closed) return;
    _snapshot = snapshot;
    if (!_snapshots.isClosed) _snapshots.add(snapshot);
  }

  // Native position/duration events may arrive after logout or while a
  // signed URL expires. Never let callbacks keep stale private replay alive.
  bool _allowActivePlayerEvent() {
    if (_closed ||
        _snapshot.status == TalkReplayPlaybackStatus.failed ||
        _snapshot.status == TalkReplayPlaybackStatus.loading ||
        _snapshot.status == TalkReplayPlaybackStatus.idle) {
      return false;
    }
    if (!_authorized() || !(_credentials?.isFresh(_now()) ?? false)) {
      _deny();
      return false;
    }
    return true;
  }

  void _positionChanged(Duration position) {
    if (!_allowActivePlayerEvent()) return;
    _emit(_snapshot.copyWith(position: position));
  }

  void _durationChanged(Duration? duration) {
    if (duration == null || !_allowActivePlayerEvent()) return;
    _emit(_snapshot.copyWith(duration: duration));
  }

  void _playerStateChanged(TalkReplayPlayerState state) {
    if (!_allowActivePlayerEvent()) return;
    switch (state) {
      case TalkReplayPlayerState.playing:
        _emit(
          _snapshot.copyWith(
            status: TalkReplayPlaybackStatus.playing,
            clearError: true,
          ),
        );
        return;
      case TalkReplayPlayerState.paused:
        if (_snapshot.status != TalkReplayPlaybackStatus.loading &&
            _snapshot.status != TalkReplayPlaybackStatus.idle) {
          _emit(_snapshot.copyWith(status: TalkReplayPlaybackStatus.paused));
        }
        return;
      case TalkReplayPlayerState.completed:
        _emit(
          _snapshot.copyWith(
            status: TalkReplayPlaybackStatus.completed,
            position: _snapshot.duration,
          ),
        );
        return;
    }
  }

  void _fail() {
    if (_closed) return;
    _loaded = false;
    _credentials = null;
    _playGeneration += 1;
    _emit(
      _snapshot.copyWith(
        status: TalkReplayPlaybackStatus.failed,
        errorMessage: 'Replay audio is unavailable right now.',
      ),
    );
  }

  Future<void> _serialize(Future<void> Function() action) async {
    final active = _operation;
    if (active != null) return active;
    final future = action();
    _operation = future;
    try {
      await future;
    } finally {
      if (identical(_operation, future)) _operation = null;
    }
  }

  // just_audio's play() future may remain pending for the entire recording.
  // Do not hold the operation mutex while audio is playing, or Pause/Seek
  // cannot execute until the audio completes.
  void _beginPlaying() {
    if (_closed) return;
    if (!_authorized()) {
      _deny();
      return;
    }
    final generation = ++_playGeneration;
    try {
      unawaited(player.play().catchError((Object _) {
        if (!_closed && _playGeneration == generation) _fail();
      }));
    } catch (_) {
      _fail();
    }
  }

  Future<void> _loadFresh({
    required bool autoPlay,
    Duration resumePosition = Duration.zero,
  }) async {
    if (_closed) return;
    if (!_authorized()) {
      _deny();
      return;
    }
    final previouslyLoaded = _loaded;
    _loaded = false;
    _credentials = null;
    ++_playGeneration;
    _emit(
      _snapshot.copyWith(
        status: TalkReplayPlaybackStatus.loading,
        clearError: true,
      ),
    );
    try {
      // Stop the old stream before awaiting an authorization check. In
      // particular, an expired seek must not keep playing cached private audio.
      if (previouslyLoaded) {
        await player.pause();
        if (_closed) return;
        if (!_authorized()) {
          _deny();
          return;
        }
      }
      // Every refresh goes through the authenticated, tenant-scoped Gateway.
      // A revoked/unpublished replay must fail even when an old URL exists.
      final credentials = await transport.load(talkId);
      if (_closed) return;
      if (!_authorized()) {
        _deny();
        return;
      }
      if (!credentials.isFresh(_now())) {
        throw const FormatException('Replay playback authorization expired');
      }
      final duration = await player.load(credentials.url);
      if (_closed) return;
      if (!_authorized()) {
        _deny();
        return;
      }
      if (!credentials.isFresh(_now())) {
        throw const FormatException('Replay playback authorization expired');
      }
      final boundedResume = duration == null
          ? resumePosition
          : (resumePosition > duration ? duration : resumePosition);
      if (boundedResume > Duration.zero) {
        await player.seek(boundedResume);
        if (_closed) return;
        // A slow seek is another asynchronous authorization boundary.
        // Never publish or play a refreshed private link after the account
        // changes, a replay is revoked locally, or its signature expires.
        if (!_authorized()) {
          _deny();
          return;
        }
        if (!credentials.isFresh(_now())) {
          throw const FormatException('Replay playback authorization expired');
        }
      }
      _loaded = true;
      _credentials = credentials;
      _emit(
        TalkReplayPlaybackSnapshot(
          status: TalkReplayPlaybackStatus.paused,
          position: boundedResume,
          duration: duration ?? Duration.zero,
        ),
      );
      if (autoPlay) _beginPlaying();
    } catch (_) {
      _fail();
    }
  }

  @override
  Future<void> toggle() => _serialize(() async {
    if (_closed) return;
    if (!_authorized()) {
      _deny();
      return;
    }
    switch (_snapshot.status) {
      case TalkReplayPlaybackStatus.playing:
        ++_playGeneration;
        try {
          await player.pause();
        } catch (_) {
          _fail();
        }
        return;
      case TalkReplayPlaybackStatus.paused:
        if (!_loaded || !(_credentials?.isFresh(_now()) ?? false)) {
          await _loadFresh(
            autoPlay: true,
            resumePosition: _snapshot.position,
          );
          return;
        }
        _beginPlaying();
        return;
      case TalkReplayPlaybackStatus.idle:
      case TalkReplayPlaybackStatus.completed:
      case TalkReplayPlaybackStatus.failed:
        await _loadFresh(autoPlay: true);
        return;
      case TalkReplayPlaybackStatus.loading:
        return;
    }
  });

  @override
  Future<void> retry() => _serialize(
    () => _loadFresh(autoPlay: true, resumePosition: _snapshot.position),
  );

  @override
  Future<void> seekTo(double fraction) => _serialize(() async {
    if (_closed) return;
    if (!_authorized()) {
      _deny();
      return;
    }
    if (!_loaded || _snapshot.duration <= Duration.zero) return;
    final value = fraction.clamp(0.0, 1.0);
    final milliseconds = (_snapshot.duration.inMilliseconds * value).round();
    final position = Duration(milliseconds: milliseconds);
    if (!(_credentials?.isFresh(_now()) ?? false)) {
      await _loadFresh(
        autoPlay: _snapshot.status == TalkReplayPlaybackStatus.playing,
        resumePosition: position,
      );
      return;
    }
    try {
      await player.seek(position);
      if (_closed) return;
      // Cached-link seeks are asynchronous too. Permission or signature
      // freshness can change while a native player seek is pending.
      if (!_authorized() || !(_credentials?.isFresh(_now()) ?? false)) {
        _deny();
        return;
      }
    } catch (_) {
      _fail();
    }
  });

  @override
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    ++_playGeneration;
    _credentials = null;
    _loaded = false;
    try {
      await _operation;
    } catch (_) {
      // Best-effort shutdown after a failed load/play operation.
    }
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    await player.close();
    await _snapshots.close();
  }
}

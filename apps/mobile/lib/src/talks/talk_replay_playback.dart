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

  factory TalkReplayPlaybackCredentials.fromJson(Map<String, dynamic> json) {
    final url = json['url'] as String? ?? '';
    final expiresAt = DateTime.tryParse(json['expiresAt'] as String? ?? '');
    final contentType = json['contentType'] as String? ?? '';
    if (url.isEmpty || expiresAt == null || contentType != 'audio/ogg') {
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
  }) {
    _subscriptions.add(player.positions.listen(_positionChanged));
    _subscriptions.add(player.durations.listen(_durationChanged));
    _subscriptions.add(player.states.listen(_playerStateChanged));
    _subscriptions.add(player.errors.listen((_) => _fail()));
  }

  final String talkId;
  final TalkReplayPlaybackTransport transport;
  final TalkReplayAudioPlayer player;

  final _snapshots = StreamController<TalkReplayPlaybackSnapshot>.broadcast(
    sync: true,
  );
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  TalkReplayPlaybackSnapshot _snapshot = const TalkReplayPlaybackSnapshot();
  Future<void>? _operation;
  bool _closed = false;
  bool _loaded = false;

  @override
  TalkReplayPlaybackSnapshot get snapshot => _snapshot;

  @override
  Stream<TalkReplayPlaybackSnapshot> get snapshots => _snapshots.stream;

  void _emit(TalkReplayPlaybackSnapshot snapshot) {
    if (_closed) return;
    _snapshot = snapshot;
    if (!_snapshots.isClosed) _snapshots.add(snapshot);
  }

  void _positionChanged(Duration position) {
    _emit(_snapshot.copyWith(position: position));
  }

  void _durationChanged(Duration? duration) {
    if (duration == null) return;
    _emit(_snapshot.copyWith(duration: duration));
  }

  void _playerStateChanged(TalkReplayPlayerState state) {
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
    _loaded = false;
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

  Future<void> _loadFreshAndPlay() async {
    if (_closed) return;
    _loaded = false;
    _emit(
      const TalkReplayPlaybackSnapshot(
        status: TalkReplayPlaybackStatus.loading,
      ),
    );
    try {
      final credentials = await transport.load(talkId);
      if (_closed) return;
      final duration = await player.load(credentials.url);
      if (_closed) return;
      _loaded = true;
      _emit(
        TalkReplayPlaybackSnapshot(
          status: TalkReplayPlaybackStatus.paused,
          duration: duration ?? Duration.zero,
        ),
      );
      await player.play();
    } catch (_) {
      _fail();
    }
  }

  @override
  Future<void> toggle() => _serialize(() async {
    if (_closed) return;
    switch (_snapshot.status) {
      case TalkReplayPlaybackStatus.playing:
        try {
          await player.pause();
        } catch (_) {
          _fail();
        }
        return;
      case TalkReplayPlaybackStatus.paused:
        if (!_loaded) {
          await _loadFreshAndPlay();
          return;
        }
        try {
          await player.play();
        } catch (_) {
          _fail();
        }
        return;
      case TalkReplayPlaybackStatus.idle:
      case TalkReplayPlaybackStatus.completed:
      case TalkReplayPlaybackStatus.failed:
        await _loadFreshAndPlay();
        return;
      case TalkReplayPlaybackStatus.loading:
        return;
    }
  });

  @override
  Future<void> retry() => _serialize(_loadFreshAndPlay);

  @override
  Future<void> seekTo(double fraction) => _serialize(() async {
    if (_closed || !_loaded || _snapshot.duration <= Duration.zero) return;
    final value = fraction.clamp(0.0, 1.0);
    final milliseconds = (_snapshot.duration.inMilliseconds * value).round();
    try {
      await player.seek(Duration(milliseconds: milliseconds));
    } catch (_) {
      _fail();
    }
  });

  @override
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
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

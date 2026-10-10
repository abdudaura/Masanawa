import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../core/network/api_client.dart';
import 'audio_post_transport.dart';

/// AF09's media ticket is issued only after AF08 authenticates the viewer,
/// the post is published and AF15 rechecks private-media permission.
class PublishedTalkTicket {
  const PublishedTalkTicket({required this.url, required this.expiresAtMs, this.listenSessionId});
  final Uri url;
  final int expiresAtMs;
  final String? listenSessionId;

  static PublishedTalkTicket parse(Object? response, {
    required String expectedHost,
    required int nowMs,
  }) {
    if (response is! Map) throw const FormatException('Invalid audio ticket');
    final data = response.cast<String, dynamic>();
    final rawUrl = data['url'];
    final expiry = data['expiresAtMs'];
    final listenId = data['listenSessionId'];
    if (listenId != null && (listenId is! String ||
        !RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
    final host = expectedHost.trim().toLowerCase();
    if (rawUrl is! String || expiry is! int ||
        host.isEmpty || !RegExp(r'^[a-z0-9.-]+$').hasMatch(host)) {
      throw const FormatException('Invalid audio ticket');
    }
    final uri = Uri.tryParse(rawUrl);
    if (uri == null || uri.scheme != 'https' ||
        uri.host.toLowerCase() != host || uri.userInfo.isNotEmpty ||
        uri.hasFragment || uri.port != 443 || uri.path.isEmpty ||
        expiry <= nowMs + 5000 || expiry > nowMs + 60000) {
      throw const FormatException('Untrusted or expired audio ticket');
    }
    return PublishedTalkTicket(url: uri, expiresAtMs: expiry,
      listenSessionId: listenId as String?);
  }
}

/// Output is injectable so tests never play audio or require a native plugin.
/// AF05 integrates this with the app's single media-focus lifecycle.
abstract interface class PublishedTalkAudioOutput {
  Future<void> start(Uri signedUrl);
  Future<void> stop();
  Future<void> dispose();
}

/// Native output reports actual position while the authorized media is playing.
/// Older fake/player implementations need not support telemetry.
abstract interface class PublishedTalkProgressOutput {
  ValueChanged<Duration>? get onPosition;
  set onPosition(ValueChanged<Duration>? value);
}

/// One player per active feed, never one player per Talk/card.
/// Android/media focus must be coordinated with private calls by AF05.
class JustAudioTalkOutput implements PublishedTalkAudioOutput, PublishedTalkProgressOutput {
  JustAudioTalkOutput({AudioPlayer? player}) : _player = player ?? AudioPlayer() {
    _positionSubscription = _player.positionStream.listen((position) {
      if (!_disposed && _player.playing) onPosition?.call(position);
    });
    _stateSubscription = _player.playerStateStream.listen((state) {
      if (!_disposed && state.processingState == ProcessingState.completed) {
        onCompleted?.call();
      }
    });
  }

  final AudioPlayer _player;
  late final StreamSubscription<PlayerState> _stateSubscription;
  late final StreamSubscription<Duration> _positionSubscription;
  @override
  ValueChanged<Duration>? onPosition;
  VoidCallback? onCompleted;
  VoidCallback? onUnavailable;
  bool _disposed = false;

  @override
  Future<void> start(Uri signedUrl) async {
    if (_disposed) throw StateError('Playback disposed');
    await _player.stop();
    final session = await AudioSession.instance();
    if (!await session.setActive(true)) {
      throw StateError('Audio focus unavailable');
    }
    try {
      await _player.setUrl(signedUrl.toString());
      // play() resolves on completion, not once playback begins. Attach the
      // failure continuation without keeping the Listen button busy for minutes.
      unawaited(_player.play().then<void>(
        (_) {},
        onError: (Object error, StackTrace trace) {
          // No private media URLs or server error bodies in logs.
          onUnavailable?.call();
          unawaited(_player.stop());
        },
      ));
    } catch (_) {
      await session.setActive(false);
      rethrow;
    }
  }

  @override
  Future<void> stop() async {
    if (_disposed) return;
    await _player.stop();
    final session = await AudioSession.instance();
    await session.setActive(false);
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    await stop();
    _disposed = true;
    await _stateSubscription.cancel();
    await _positionSubscription.cancel();
    await _player.dispose();
  }
}

/// Authenticated ticket -> trusted host -> single-player startup.
/// No signed URL is persisted, cached, exposed to widgets or used after
/// account changes. AF00 owns registration of the server playback route.
class AudioPostPlaybackController extends ChangeNotifier {
  AudioPostPlaybackController({
    required this.api,
    required this.accountId,
    required this.isCurrentAccount,
    required this.expectedMediaHost,
    PublishedTalkAudioOutput? output,
    Future<Object?> Function(String)? ticketRequest,
    int Function()? nowMs,
    Future<Object?> Function(String postId, String listenSessionId, int playedMs)? listenRequest,
  }) : _output = output ?? JustAudioTalkOutput(),
       _ticketRequest = ticketRequest,
       _nowMs = nowMs ?? _systemNow,
       _listenRequest = listenRequest {
    if (_output is PublishedTalkProgressOutput) {
      (_output as PublishedTalkProgressOutput).onPosition = _onPosition;
    }
    if (_output is JustAudioTalkOutput) {
      final native = _output as JustAudioTalkOutput;
      native.onCompleted = _finishPlayback;
      native.onUnavailable = _failPlayback;
    }
  }

  final ApiClient api;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final String expectedMediaHost;
  final PublishedTalkAudioOutput _output;
  final Future<Object?> Function(String)? _ticketRequest;
  final int Function() _nowMs;
  final Future<Object?> Function(String,String,int)? _listenRequest;
  static int _systemNow() => DateTime.now().millisecondsSinceEpoch;

  int _generation = 0;
  bool _closed = false;
  String? _activePostId;
  String? _error;
  bool _loading = false;
  bool _playing = false;
  String? _listenSessionId;
  String? _listenAuthToken;
  int _lastPositionMs = 0, _lastPositionAtMs = 0, _listenedMs = 0;
  int _listenTargetMs = 3000;
  bool _listenCounted = false, _listenReporting = false;
  int _listenAttemptAtMs = -100000;
  final Map<String,int> _countedListens = {};
  int? listenCountFor(String postId) => isAuthorized ? _countedListens[postId] : null;

  // Native audio start/stop are asynchronous. Serializing them prevents a late
  // start for Talk A from racing with a stop or start for Talk B. Each queued
  // start also checks the latest session and generation before touching media.
  Future<void> _mediaTail = Future<void>.value();
  Future<void> _runMedia(Future<void> Function() work) {
    final operation = _mediaTail.then((_) => work());
    _mediaTail = operation.then<void>(
      (_) {}, onError: (Object _, StackTrace __) {},
    );
    return operation;
  }

  String? get activePostId => _activePostId;
  String? get error => _error;
  bool get loading => _loading;
  bool get playing => _playing;
  bool get isAuthorized =>
      accountId.trim().isNotEmpty && isCurrentAccount(accountId) && !_closed;

  void _notify() { if (!_closed) notifyListeners(); }

  void _clearListen() {
    _listenSessionId = null;
    _listenAuthToken = null;
    _lastPositionMs = 0;
    _lastPositionAtMs = 0;
    _listenedMs = 0;
    _listenTargetMs = 3000;
    _listenCounted = false;
    _listenReporting = false;
    _listenAttemptAtMs = -100000;
  }

  void _onPosition(Duration position) {
    final id = _listenSessionId;
    final postId = _activePostId;
    final now = _nowMs();
    if (!_playing || !isAuthorized || id == null || postId == null ||
        api.accessToken != _listenAuthToken) return;
    final next = position.inMilliseconds;
    if (_lastPositionAtMs > 0) {
      final delta = next - _lastPositionMs;
      final elapsed = now - _lastPositionAtMs;
      // Ignore jumps/seek/speed changes; only continuous native played time.
      if (delta > 0 && elapsed > 0 && delta <= 2000) {
        _listenedMs += delta.clamp(0, elapsed + 250).toInt();
      }
    }
    _lastPositionMs = next;
    _lastPositionAtMs = now;
    if (_listenedMs >= _listenTargetMs && !_listenCounted && !_listenReporting &&
        now - _listenAttemptAtMs >= 5000) {
      _listenAttemptAtMs = now;
      _listenReporting = true;
      final generation = _generation;
      final progress = _listenedMs;
      unawaited(_submitListen(postId,id,progress,generation));
    }
  }

  Future<void> _submitListen(String postId,String sessionId,int playedMs,int generation) async {
    try {
      final response = _listenRequest != null
          ? await _listenRequest(postId,sessionId,playedMs)
          : (await api.dio.post<dynamic>(
              '/audio-posts/' + Uri.encodeComponent(postId) + '/listen',
              data: {'listenSessionId':sessionId,'playedMs':playedMs},
            )).data;
      if (!isAuthorized || generation != _generation ||
          _listenSessionId != sessionId || _activePostId != postId ||
          api.accessToken != _listenAuthToken) return;
      if (response is! Map || response['counted'] is! bool ||
          response['listenCount'] is! int || (response['listenCount'] as int) < 0) {
        throw const FormatException('Invalid listen receipt');
      }
      _listenCounted = true; // Accepted duplicate daily listens are also final.
      _countedListens[postId] = response['listenCount'] as int;
      _notify();
    } catch (_) {
      // Unknown outcome is not a new playback. A retry reuses this session ID.
      // Never interrupt listening or leak media URL/provider details.
    } finally {
      if (generation == _generation && _listenSessionId == sessionId) {
        _listenReporting = false;
      }
    }
  }

  void _finishPlayback() {
    if (_closed || !_playing) return;
    _playing = false;
    _activePostId = null;
    _clearListen();
    _notify();
    unawaited(_runMedia(_output.stop).catchError((Object _) {}));
  }

  void _failPlayback() {
    if (_closed || !_playing) return;
    _playing = false;
    _clearListen();
    _error = 'Audio stopped. Retry to listen.';
    _notify();
    unawaited(_runMedia(_output.stop).catchError((Object _) {}));
  }

  Future<void> _retireStaleRequest(int requestGeneration) async {
    // A new request already owns media and the visible player state.
    if (requestGeneration != _generation) return;
    try { await _runMedia(_output.stop); }
    catch (_) { /* do not leak native or private-media details */ }
    if (_closed || requestGeneration != _generation) return;
    _loading = false;
    _playing = false;
    _activePostId = null;
    _clearListen();
    _error = null;
    _notify();
  }

  Future<void> play(AudioPost post) async {
    if (!isAuthorized || post.status != 'published' ||
        !RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(post.postId)) {
      return;
    }
    if (_activePostId == post.postId && (_playing || _loading)) {
      await stop();
      return;
    }
    final requestGeneration = ++_generation;
    _clearListen();
    // Drop a media ticket if the auth session rotates while it is in flight,
    // even when the new session belongs to the same account.
    final authorizationAtStart = api.accessToken;
    _activePostId = post.postId;
    _loading = true;
    _playing = false;
    _error = null;
    _notify();
    try {
      await _runMedia(_output.stop);
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      final payload = _ticketRequest != null
          ? await _ticketRequest(post.postId)
          : (await api.dio.get<dynamic>(
              '/audio-posts/' + Uri.encodeComponent(post.postId) + '/playback',
            )).data;
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      final ticket = PublishedTalkTicket.parse(
        payload, expectedHost: expectedMediaHost, nowMs: _nowMs());
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      await _runMedia(() async {
        // A newer stop/play can be queued while waiting on the media ticket.
        if (!isAuthorized || requestGeneration != _generation ||
            api.accessToken != authorizationAtStart) return;
        // A previous native start can hold the media queue long enough for
        // this short-lived AF15 ticket to expire after initial validation.
        if (_nowMs() + 5000 >= ticket.expiresAtMs) {
          throw const FormatException('Expired audio ticket');
        }
        await _output.start(ticket.url);
      });
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        // A newer play/stop owns its own queued cleanup. Never stop that
        // newer playback from an earlier request's stale continuation.
        await _retireStaleRequest(requestGeneration);
        return;
      }
      _loading = false;
      _listenSessionId = ticket.listenSessionId;
      _listenTargetMs = (post.durationMs * 0.75).ceil().clamp(0, 3000);
      _listenAuthToken = authorizationAtStart;
      _lastPositionAtMs = _nowMs();
      _playing = true;
      _notify();
    } catch (_) {
      // Never surface signed URLs, request headers or native exception bodies.
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      _loading = false;
      _playing = false;
      _clearListen();
      _error = 'Audio unavailable. Reconnect or retry.';
      _notify();
      try { await _runMedia(_output.stop); }
      catch (_) { /* keep sanitized UI */ }
    }
  }

  Future<void> stop() async {
    ++_generation;
    _clearListen();
    _loading = false;
    _playing = false;
    _activePostId = null;
    _error = null;
    _notify();
    await _runMedia(_output.stop);
  }

  @override
  void dispose() {
    if (_closed) return;
    ++_generation;
    _closed = true;
    _clearListen();
    _countedListens.clear();
    unawaited(_runMedia(_output.dispose).catchError((Object _) {}));
    super.dispose();
  }
}
, caseSensitive: false).hasMatch(listenId))) {
      throw const FormatException('Invalid listen ticket');
    }
    final host = expectedHost.trim().toLowerCase();
    if (rawUrl is! String || expiry is! int ||
        host.isEmpty || !RegExp(r'^[a-z0-9.-]+$').hasMatch(host)) {
      throw const FormatException('Invalid audio ticket');
    }
    final uri = Uri.tryParse(rawUrl);
    if (uri == null || uri.scheme != 'https' ||
        uri.host.toLowerCase() != host || uri.userInfo.isNotEmpty ||
        uri.hasFragment || uri.port != 443 || uri.path.isEmpty ||
        expiry <= nowMs + 5000 || expiry > nowMs + 60000) {
      throw const FormatException('Untrusted or expired audio ticket');
    }
    return PublishedTalkTicket(url: uri, expiresAtMs: expiry);
  }
}

/// Output is injectable so tests never play audio or require a native plugin.
/// AF05 integrates this with the app's single media-focus lifecycle.
abstract interface class PublishedTalkAudioOutput {
  Future<void> start(Uri signedUrl);
  Future<void> stop();
  Future<void> dispose();
}

/// One player per active feed, never one player per Talk/card.
/// Android/media focus must be coordinated with private calls by AF05.
class JustAudioTalkOutput implements PublishedTalkAudioOutput {
  JustAudioTalkOutput({AudioPlayer? player}) : _player = player ?? AudioPlayer() {
    _stateSubscription = _player.playerStateStream.listen((state) {
      if (!_disposed && state.processingState == ProcessingState.completed) {
        onCompleted?.call();
      }
    });
  }

  final AudioPlayer _player;
  late final StreamSubscription<PlayerState> _stateSubscription;
  VoidCallback? onCompleted;
  VoidCallback? onUnavailable;
  bool _disposed = false;

  @override
  Future<void> start(Uri signedUrl) async {
    if (_disposed) throw StateError('Playback disposed');
    await _player.stop();
    final session = await AudioSession.instance();
    if (!await session.setActive(true)) {
      throw StateError('Audio focus unavailable');
    }
    try {
      await _player.setUrl(signedUrl.toString());
      // play() resolves on completion, not once playback begins. Attach the
      // failure continuation without keeping the Listen button busy for minutes.
      unawaited(_player.play().then<void>(
        (_) {},
        onError: (Object error, StackTrace trace) {
          // No private media URLs or server error bodies in logs.
          onUnavailable?.call();
          unawaited(_player.stop());
        },
      ));
    } catch (_) {
      await session.setActive(false);
      rethrow;
    }
  }

  @override
  Future<void> stop() async {
    if (_disposed) return;
    await _player.stop();
    final session = await AudioSession.instance();
    await session.setActive(false);
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    await stop();
    _disposed = true;
    await _stateSubscription.cancel();
    await _player.dispose();
  }
}

/// Authenticated ticket -> trusted host -> single-player startup.
/// No signed URL is persisted, cached, exposed to widgets or used after
/// account changes. AF00 owns registration of the server playback route.
class AudioPostPlaybackController extends ChangeNotifier {
  AudioPostPlaybackController({
    required this.api,
    required this.accountId,
    required this.isCurrentAccount,
    required this.expectedMediaHost,
    PublishedTalkAudioOutput? output,
    Future<Object?> Function(String)? ticketRequest,
    int Function()? nowMs,
  }) : _output = output ?? JustAudioTalkOutput(),
       _ticketRequest = ticketRequest,
       _nowMs = nowMs ?? _systemNow {
    if (_output is JustAudioTalkOutput) {
      final native = _output as JustAudioTalkOutput;
      native.onCompleted = _finishPlayback;
      native.onUnavailable = _failPlayback;
    }
  }

  final ApiClient api;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final String expectedMediaHost;
  final PublishedTalkAudioOutput _output;
  final Future<Object?> Function(String)? _ticketRequest;
  final int Function() _nowMs;
  static int _systemNow() => DateTime.now().millisecondsSinceEpoch;

  int _generation = 0;
  bool _closed = false;
  String? _activePostId;
  String? _error;
  bool _loading = false;
  bool _playing = false;

  // Native audio start/stop are asynchronous. Serializing them prevents a late
  // start for Talk A from racing with a stop or start for Talk B. Each queued
  // start also checks the latest session and generation before touching media.
  Future<void> _mediaTail = Future<void>.value();
  Future<void> _runMedia(Future<void> Function() work) {
    final operation = _mediaTail.then((_) => work());
    _mediaTail = operation.then<void>(
      (_) {}, onError: (Object _, StackTrace __) {},
    );
    return operation;
  }

  String? get activePostId => _activePostId;
  String? get error => _error;
  bool get loading => _loading;
  bool get playing => _playing;
  bool get isAuthorized =>
      accountId.trim().isNotEmpty && isCurrentAccount(accountId) && !_closed;

  void _notify() { if (!_closed) notifyListeners(); }

  void _finishPlayback() {
    if (_closed || !_playing) return;
    _playing = false;
    _activePostId = null;
    _notify();
    unawaited(_runMedia(_output.stop).catchError((Object _) {}));
  }

  void _failPlayback() {
    if (_closed || !_playing) return;
    _playing = false;
    _error = 'Audio stopped. Retry to listen.';
    _notify();
    unawaited(_runMedia(_output.stop).catchError((Object _) {}));
  }

  Future<void> _retireStaleRequest(int requestGeneration) async {
    // A new request already owns media and the visible player state.
    if (requestGeneration != _generation) return;
    try { await _runMedia(_output.stop); }
    catch (_) { /* do not leak native or private-media details */ }
    if (_closed || requestGeneration != _generation) return;
    _loading = false;
    _playing = false;
    _activePostId = null;
    _error = null;
    _notify();
  }

  Future<void> play(AudioPost post) async {
    if (!isAuthorized || post.status != 'published' ||
        !RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(post.postId)) {
      return;
    }
    if (_activePostId == post.postId && (_playing || _loading)) {
      await stop();
      return;
    }
    final requestGeneration = ++_generation;
    // Drop a media ticket if the auth session rotates while it is in flight,
    // even when the new session belongs to the same account.
    final authorizationAtStart = api.accessToken;
    _activePostId = post.postId;
    _loading = true;
    _playing = false;
    _error = null;
    _notify();
    try {
      await _runMedia(_output.stop);
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      final payload = _ticketRequest != null
          ? await _ticketRequest(post.postId)
          : (await api.dio.get<dynamic>(
              '/audio-posts/' + Uri.encodeComponent(post.postId) + '/playback',
            )).data;
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      final ticket = PublishedTalkTicket.parse(
        payload, expectedHost: expectedMediaHost, nowMs: _nowMs());
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      await _runMedia(() async {
        // A newer stop/play can be queued while waiting on the media ticket.
        if (!isAuthorized || requestGeneration != _generation ||
            api.accessToken != authorizationAtStart) return;
        // A previous native start can hold the media queue long enough for
        // this short-lived AF15 ticket to expire after initial validation.
        if (_nowMs() + 5000 >= ticket.expiresAtMs) {
          throw const FormatException('Expired audio ticket');
        }
        await _output.start(ticket.url);
      });
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        // A newer play/stop owns its own queued cleanup. Never stop that
        // newer playback from an earlier request's stale continuation.
        await _retireStaleRequest(requestGeneration);
        return;
      }
      _loading = false;
      _playing = true;
      _notify();
    } catch (_) {
      // Never surface signed URLs, request headers or native exception bodies.
      if (!isAuthorized || requestGeneration != _generation ||
          api.accessToken != authorizationAtStart) {
        await _retireStaleRequest(requestGeneration);
        return;
      }
      _loading = false;
      _playing = false;
      _error = 'Audio unavailable. Reconnect or retry.';
      _notify();
      try { await _runMedia(_output.stop); }
      catch (_) { /* keep sanitized UI */ }
    }
  }

  Future<void> stop() async {
    ++_generation;
    _loading = false;
    _playing = false;
    _activePostId = null;
    _error = null;
    _notify();
    await _runMedia(_output.stop);
  }

  @override
  void dispose() {
    if (_closed) return;
    ++_generation;
    _closed = true;
    unawaited(_runMedia(_output.dispose).catchError((Object _) {}));
    super.dispose();
  }
}

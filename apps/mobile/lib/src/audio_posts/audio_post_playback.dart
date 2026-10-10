import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../core/network/api_client.dart';
import 'audio_post_transport.dart';

/// AF09's media ticket is issued only after AF08 authenticates the viewer,
/// the post is published and AF15 rechecks private-media permission.
class PublishedTalkTicket {
  const PublishedTalkTicket({required this.url, required this.expiresAtMs});
  final Uri url;
  final int expiresAtMs;

  static PublishedTalkTicket parse(Object? response, {
    required String expectedHost,
    required int nowMs,
  }) {
    if (response is! Map) throw const FormatException('Invalid audio ticket');
    final data = response.cast<String, dynamic>();
    final rawUrl = data['url'];
    final expiry = data['expiresAtMs'];
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
    unawaited(_output.stop());
  }

  void _failPlayback() {
    if (_closed || !_playing) return;
    _playing = false;
    _error = 'Audio stopped. Retry to listen.';
    _notify();
    unawaited(_output.stop());
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
    _activePostId = post.postId;
    _loading = true;
    _playing = false;
    _error = null;
    _notify();
    try {
      await _output.stop();
      if (!isAuthorized || requestGeneration != _generation) return;
      final payload = _ticketRequest != null
          ? await _ticketRequest(post.postId)
          : (await api.dio.get<dynamic>(
              '/audio-posts/' + Uri.encodeComponent(post.postId) + '/playback',
            )).data;
      if (!isAuthorized || requestGeneration != _generation) return;
      final ticket = PublishedTalkTicket.parse(
        payload, expectedHost: expectedMediaHost, nowMs: _nowMs());
      if (!isAuthorized || requestGeneration != _generation) return;
      await _output.start(ticket.url);
      if (!isAuthorized || requestGeneration != _generation) {
        await _output.stop();
        return;
      }
      _loading = false;
      _playing = true;
      _notify();
    } catch (_) {
      // Never surface signed URLs, request headers or native exception bodies.
      if (!isAuthorized || requestGeneration != _generation) return;
      _loading = false;
      _playing = false;
      _error = 'Audio unavailable. Reconnect or retry.';
      _notify();
      try { await _output.stop(); } catch (_) { /* keep sanitized UI */ }
    }
  }

  Future<void> stop() async {
    ++_generation;
    _loading = false;
    _playing = false;
    _activePostId = null;
    _error = null;
    _notify();
    await _output.stop();
  }

  @override
  void dispose() {
    if (_closed) return;
    ++_generation;
    _closed = true;
    unawaited(_output.dispose());
    super.dispose();
  }
}

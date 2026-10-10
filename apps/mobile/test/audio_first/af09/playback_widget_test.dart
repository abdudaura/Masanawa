import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_playback.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

AudioPost fixture({String status = 'published', String postId = 'talk-01'}) => AudioPost(
  postId: postId, authorId: 'member-a', authorKind: 'human',
  title: 'A published story', durationMs: 34000, status: status,
  revision: 1, createdAt: DateTime.utc(2026, 10, 10),
);

class OnePostTransport extends GatewayAudioPostTransport {
  OnePostTransport(super.api);
  @override
  Future<AudioPostPage> discover({String? cursor}) async =>
      AudioPostPage(items: [fixture()], nextCursor: null);
}

class RecordingOutput implements PublishedTalkAudioOutput {
  int starts = 0, stops = 0, disposals = 0;
  Uri? lastUrl;
  Completer<void>? pendingStart;
  @override
  Future<void> start(Uri signedUrl) async {
    starts++;
    lastUrl = signedUrl;
    if (pendingStart != null) await pendingStart!.future;
  }
  @override
  Future<void> stop() async { stops++; }
  @override
  Future<void> dispose() async { disposals++; }
}

/// A pending native media start used to prove stop/start never overlap.
class DelayedStartOutput implements PublishedTalkAudioOutput {
  final Completer<void> firstEntered = Completer<void>();
  final Completer<void> releaseFirst = Completer<void>();
  final List<String> events = [];
  int starts = 0, concurrentStarts = 0, peakConcurrentStarts = 0;
  int stopsDuringStart = 0;

  @override
  Future<void> start(Uri signedUrl) async {
    final number = ++starts;
    events.add('start-$number');
    ++concurrentStarts;
    if (concurrentStarts > peakConcurrentStarts) {
      peakConcurrentStarts = concurrentStarts;
    }
    try {
      if (number == 1) {
        firstEntered.complete();
        await releaseFirst.future;
      }
    } finally {
      --concurrentStarts;
      events.add('end-$number');
    }
  }

  @override
  Future<void> stop() async {
    if (concurrentStarts > 0) ++stopsDuringStart;
    events.add('stop');
  }

  @override
  Future<void> dispose() async { events.add('dispose'); }
}

ApiClient client() => ApiClient(dio: Dio(BaseOptions(baseUrl: 'https://api.example.test')));

Object ticket({String url = 'https://media.example.test/private/asset?sig=a',
    int expiry = 31000}) =>
    <String, Object>{'url': url, 'expiresAtMs': expiry};

void main() {
  test('rejects foreign hosts, insecure URLs, user info, fragments and expiry', () {
    final valid = PublishedTalkTicket.parse(ticket(),
        expectedHost: 'media.example.test', nowMs: 1000);
    expect(valid.url.host, 'media.example.test');
    for (final bad in <Object>[
      ticket(url: 'http://media.example.test/private/asset'),
      ticket(url: 'https://bad.example.test/private/asset'),
      ticket(url: 'https://user:password@media.example.test/private/asset'),
      ticket(url: 'https://media.example.test/private/asset#fragment'),
      ticket(url: 'https://media.example.test:8443/private/asset'),
      ticket(expiry: 5000), ticket(expiry: 62000),
    ]) {
      expect(() => PublishedTalkTicket.parse(bad,
          expectedHost: 'media.example.test', nowMs: 1000),
          throwsFormatException);
    }
    expect(() => PublishedTalkTicket.parse(<String, Object>{'url': 'https://media.example.test/asset'},
        expectedHost: 'media.example.test', nowMs: 1000), throwsFormatException);
  });

  testWidgets('published Talk fetches one authorized ticket and can stop playback',
      (tester) async {
    final api = client();
    final output = RecordingOutput();
    var requests = 0;
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'account-a', isCurrentAccount: (id) => id == 'account-a',
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (id) async { requests++; expect(id, 'talk-01'); return ticket(); },
    );
    addTearDown(playback.dispose);
    await tester.pumpWidget(MaterialApp(home: AudioPostFeedScreen(
      transport: OnePostTransport(api), accountId: 'account-a',
      isCurrentAccount: (_) => true, playback: playback,
    )));
    await tester.pumpAndSettle();
    final button = find.byKey(const ValueKey('talk-listen-talk-01'));
    expect(button, findsOneWidget);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(requests, 1);
    expect(output.starts, 1);
    expect(output.lastUrl!.host, 'media.example.test');
    expect(find.text('Stop'), findsOneWidget);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(output.stops, greaterThanOrEqualTo(2));
    expect(find.text('Listen'), findsOneWidget);
  });

  testWidgets('switching account invalidates in-flight ticket before media starts',
      (tester) async {
    final api = client();
    final output = RecordingOutput();
    final waiting = Completer<Object?>();
    String active = 'account-a';
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'account-a',
      isCurrentAccount: (id) => id == active,
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) => waiting.future,
    );
    addTearDown(playback.dispose);
    final posts = OnePostTransport(api);
    Widget screen(String id) => MaterialApp(home: AudioPostFeedScreen(
      transport: posts, accountId: id,
      isCurrentAccount: (value) => value == active, playback: playback,
    ));
    await tester.pumpWidget(screen('account-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-listen-talk-01')));
    await tester.pump();
    active = 'account-b';
    await tester.pumpWidget(screen('account-b'));
    await tester.pump();
    waiting.complete(ticket());
    await tester.pumpAndSettle();
    expect(output.starts, 0);
    expect(playback.playing, false);
  });

  testWidgets('same-account session rotation also invalidates pending media tickets',
      (tester) async {
    final api = client()..accessToken = 'old-session';
    final output = RecordingOutput();
    final waiting = Completer<Object?>();
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'account-a',
      isCurrentAccount: (id) => id == 'account-a',
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) => waiting.future,
    );
    addTearDown(playback.dispose);
    await tester.pumpWidget(MaterialApp(home: AudioPostFeedScreen(
      transport: OnePostTransport(api), accountId: 'account-a',
      isCurrentAccount: (_) => true, playback: playback,
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-listen-talk-01')));
    await tester.pump();
    api.accessToken = 'new-session';
    waiting.complete(ticket());
    await tester.pumpAndSettle();
    expect(output.starts, 0);
    expect(playback.playing, false);
  });

  testWidgets('unavailable or untrusted tickets never start media and permit retry',
      (tester) async {
    final api = client();
    final output = RecordingOutput();
    var attempts = 0;
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'a', isCurrentAccount: (_) => true,
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) async {
        attempts++;
        if (attempts == 1) throw StateError('private auth details');
        if (attempts == 2) return ticket(url: 'https://evil.invalid/asset');
        return ticket();
      },
    );
    addTearDown(playback.dispose);
    await tester.pumpWidget(MaterialApp(home: AudioPostFeedScreen(
      transport: OnePostTransport(api), accountId: 'a',
      isCurrentAccount: (_) => true, playback: playback,
    )));
    await tester.pumpAndSettle();
    final button = find.byKey(const ValueKey('talk-listen-talk-01'));
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('Audio unavailable. Reconnect or retry.'), findsOneWidget);
    expect(find.textContaining('private auth details'), findsNothing);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(output.starts, 0);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(output.starts, 1);
    expect(playback.playing, true);
  });

  test('rapid Talk switch serializes native starts and stops', () async {
    final api = client()..accessToken = 'session-a';
    final output = DelayedStartOutput();
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'a', isCurrentAccount: (_) => true,
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) async => ticket(),
    );
    final first = playback.play(fixture(postId: 'talk-01'));
    await output.firstEntered.future;
    final second = playback.play(fixture(postId: 'talk-02'));
    await Future<void>.delayed(Duration.zero);
    expect(output.starts, 1);
    expect(output.stopsDuringStart, 0);
    output.releaseFirst.complete();
    await Future.wait([first, second]);
    expect(output.starts, 2);
    expect(output.peakConcurrentStarts, 1);
    expect(output.stopsDuringStart, 0);
    expect(output.events.indexOf('end-1'),
        lessThan(output.events.indexOf('start-2')));
    expect(playback.activePostId, 'talk-02');
    expect(playback.playing, isTrue);
    playback.dispose();
  });

  test('stop queued during pending media start cannot resurrect audio', () async {
    final output = DelayedStartOutput();
    final playback = AudioPostPlaybackController(
      api: client(), accountId: 'a', isCurrentAccount: (_) => true,
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) async => ticket(),
    );
    final playing = playback.play(fixture());
    await output.firstEntered.future;
    final stopping = playback.stop();
    expect(playback.activePostId, isNull);
    expect(playback.playing, isFalse);
    expect(output.stopsDuringStart, 0);
    output.releaseFirst.complete();
    await Future.wait([playing, stopping]);
    expect(output.starts, 1);
    expect(output.stopsDuringStart, 0);
    expect(output.events.last, 'stop');
    expect(playback.playing, isFalse);
    playback.dispose();
  });

  test('rotated session while native start is pending stops stale audio', () async {
    final api = client()..accessToken = 'session-a';
    final output = DelayedStartOutput();
    final playback = AudioPostPlaybackController(
      api: api, accountId: 'a', isCurrentAccount: (_) => true,
      expectedMediaHost: 'media.example.test', output: output, nowMs: () => 1000,
      ticketRequest: (_) async => ticket(),
    );
    final playing = playback.play(fixture());
    await output.firstEntered.future;
    api.accessToken = 'session-b';
    output.releaseFirst.complete();
    await playing;
    expect(output.starts, 1);
    expect(output.stopsDuringStart, 0);
    expect(output.events.last, 'stop');
    expect(playback.playing, isFalse);
    playback.dispose();
  });

  test('short-lived ticket expires while native media is queued; retry remains safe', () async {
    final output = DelayedStartOutput();
    var clockMs = 1000;
    final playback = AudioPostPlaybackController(
      api: client(), accountId: 'a', isCurrentAccount: (_) => true,
      expectedMediaHost: 'media.example.test', output: output,
      nowMs: () => clockMs, ticketRequest: (_) async => ticket(),
    );
    final first = playback.play(fixture(postId: 'talk-01'));
    await output.firstEntered.future;
    final second = playback.play(fixture(postId: 'talk-02'));
    await Future<void>.delayed(Duration.zero);
    // Both media tickets were valid when requested, but the second cannot
    // reuse its ticket after waiting behind a long-running first start.
    clockMs = 30000;
    output.releaseFirst.complete();
    await Future.wait([first, second]);
    expect(output.starts, 1);
    expect(output.stopsDuringStart, 0);
    expect(playback.playing, isFalse);
    expect(playback.error, 'Audio unavailable. Reconnect or retry.');
    playback.dispose();
  });

  test('non-published posts and absent account never issue tickets', () async {
    final output = RecordingOutput();
    var requests = 0;
    final controller = AudioPostPlaybackController(
      api: client(), accountId: 'a', isCurrentAccount: (_) => false,
      expectedMediaHost: 'media.example.test', output: output,
      ticketRequest: (_) async { requests++; return ticket(); },
    );
    await controller.play(fixture());
    await controller.play(fixture(status: 'processing'));
    expect(requests, 0);
    expect(output.starts, 0);
    controller.dispose();
  });
}

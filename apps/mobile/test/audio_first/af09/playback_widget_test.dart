import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_playback.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

AudioPost fixture({String status = 'published'}) => AudioPost(
  postId: 'talk-01', authorId: 'member-a', authorKind: 'human',
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

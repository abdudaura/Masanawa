import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_detail_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_playback.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

const _clock = 2000000000000;
final _post = AudioPost(
  postId: 'post1', authorId: 'author1', authorKind: 'human',
  title: 'A public Talk', durationMs: 11000, status: 'published',
  revision: 1, createdAt: DateTime.utc(2026, 10, 10),
);

class _Output implements PublishedTalkAudioOutput {
  int starts = 0;
  int stops = 0;
  @override
  Future<void> start(Uri url) async {
    expect(url.host, 'storage.example.com');
    starts++;
  }
  @override
  Future<void> stop() async { stops++; }
  @override
  Future<void> dispose() async {}
}

void main() {
  testWidgets('creator detail controls authorized playback and stops on pop',
      (tester) async {
    final output = _Output();
    final api = ApiClient(dio: Dio());
    final controller = AudioPostPlaybackController(
      api: api, accountId: 'alice',
      isCurrentAccount: (id) => id == 'alice',
      expectedMediaHost: 'storage.example.com',
      output: output, nowMs: () => _clock,
      ticketRequest: (_) async => {
        'url': 'https://storage.example.com/audio/post1?sig=x',
        'expiresAtMs': _clock + 30000,
      },
    );
    addTearDown(controller.dispose);
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute<void>(builder: (_) => AudioPostDetailScreen(
              post: _post, playback: controller, accountId: 'alice',
              isCurrentAccount: (id) => id == 'alice',
            )),
          ),
          child: const Text('Open'),
        ),
      )),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('A public Talk'), findsOneWidget);
    expect(output.starts, 0); // Navigation never auto-plays private audio.
    await tester.tap(find.byKey(const ValueKey('creator-talk-listen')));
    await tester.pumpAndSettle();
    expect(output.starts, 1);
    expect(controller.playing, isTrue);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(controller.playing, isFalse);
    expect(output.stops, greaterThanOrEqualTo(2));
  });

  testWidgets('unauthorized account cannot request a playback ticket',
      (tester) async {
    final output = _Output();
    final controller = AudioPostPlaybackController(
      api: ApiClient(dio: Dio()), accountId: 'alice',
      isCurrentAccount: (_) => false,
      expectedMediaHost: 'storage.example.com',
      output: output, nowMs: () => _clock,
      ticketRequest: (_) async => throw StateError('must not issue'),
    );
    addTearDown(controller.dispose);
    await tester.pumpWidget(MaterialApp(
      home: AudioPostDetailScreen(
        post: _post, playback: controller, accountId: 'alice',
        isCurrentAccount: (_) => false,
      ),
    ));
    expect(find.text('Sign in to listen to this Talk.'), findsOneWidget);
    expect(find.byKey(const ValueKey('creator-talk-listen')), findsNothing);
    expect(output.starts, 0);
  });
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';

AudioPost post(String id) => AudioPost(
  postId: id, authorId: 'author-a', authorKind: 'human',
  title: 'Published audio ' + id, durationMs: 22000,
  status: 'published', revision: 1, createdAt: DateTime.utc(2026, 10, 10),
);
class FakePosts implements AudioPostTransport {
  Future<AudioPostPage> Function(String?)? discoverHandler;
  int requests = 0, likes = 0, saves = 0;
  @override
  Future<AudioPostPage> discover({String? cursor}) {
    requests++;
    return discoverHandler?.call(cursor) ??
      Future.value(AudioPostPage(items: [post('one')], nextCursor: null));
  }
  @override
  Future<List<AudioPost>> mine() async => [];
  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async => post('new');
  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async { if (kind == 'save') saves++; else likes++; }
}
Widget screen(FakePosts source, String account, {bool Function(String)? current}) =>
  MaterialApp(home: AudioPostFeedScreen(
    transport: source, accountId: account,
    isCurrentAccount: current ?? (id) => id == account,
  ));

void main() {
  testWidgets('published feed loads authenticated posts, no fake playback',
      (tester) async {
    final source = FakePosts();
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    expect(find.text('Published audio one'), findsOneWidget);
    expect(find.text('Audio playback is not configured in this build.'), findsOneWidget);
    final play = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'Listen'));
    expect(play.onPressed, isNull);
    await tester.tap(find.text('Like'));
    await tester.pumpAndSettle();
    expect(source.likes, 1);
  });

  testWidgets('offline errors provide explicit retry with current session',
      (tester) async {
    final source = FakePosts()..discoverHandler = (_) =>
      Future.error(StateError('offline'));
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load audio Talks'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(source.requests, 2);
  });

  testWidgets('late previous-account page is not shown after account switch',
      (tester) async {
    final old = Completer<AudioPostPage>();
    final source = FakePosts()..discoverHandler = (_) {
      if (sourceAccount == 'old') return old.future;
      return Future.value(AudioPostPage(items: [post('new')], nextCursor: null));
    };
    sourceAccount = 'old';
    await tester.pumpWidget(screen(source, 'old'));
    await tester.pump();
    sourceAccount = 'new';
    await tester.pumpWidget(screen(source, 'new'));
    await tester.pumpAndSettle();
    old.complete(AudioPostPage(items: [post('leaked')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Published audio new'), findsOneWidget);
    expect(find.text('Published audio leaked'), findsNothing);
  });
}
String sourceAccount = 'old';

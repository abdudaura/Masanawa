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
  int requests = 0, likes = 0, saves = 0, removals = 0, commentWrites = 0;
  final List<AudioPostComment> storedComments = [];
  Future<List<AudioPostComment>> Function(String)? commentsHandler;
  Future<List<AudioPost>> Function()? mineHandler;
  Future<List<AudioPost>> Function()? savedHandler;
  bool? lastReactionEnabled;
  Future<AudioPost> Function(String)? removeHandler;
  @override
  Future<AudioPostPage> discover({String? cursor}) {
    requests++;
    return discoverHandler?.call(cursor) ??
      Future.value(AudioPostPage(items: [post('one')], nextCursor: null));
  }
  @override
  Future<List<AudioPost>> mine() => mineHandler?.call() ?? Future.value([]);
  @override
  Future<List<AudioPost>> saved() => savedHandler?.call() ?? Future.value([]);
  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async => post('new');
  @override
  Future<AudioPost> removeMine({required String postId}) async {
    removals++;
    if (removeHandler != null) return removeHandler!(postId);
    return AudioPost(postId: postId, authorId: 'author-a', authorKind: 'human',
      title: 'Published audio ' + postId, durationMs: 22000,
      status: 'removed', revision: 2, createdAt: DateTime.utc(2026, 10, 10));
  }
  @override
  Future<List<AudioPostComment>> comments({required String postId}) =>
    commentsHandler?.call(postId) ??
      Future.value(storedComments.where((c) => c.postId == postId).toList());

  @override
  Future<AudioPostComment> comment({
    required String postId, required String requestId, required String body,
  }) async {
    commentWrites++;
    final record = AudioPostComment(
      postId: postId, commentId: 'comment-$commentWrites',
      authorAccountId: 'user-a', body: body,
      createdAt: DateTime.utc(2026, 10, 10), removed: false);
    storedComments.insert(0, record);
    return record;
  }

  @override
  Future<void> removeComment({
    required String postId, required String commentId,
  }) async {
    storedComments.removeWhere((c) => c.postId == postId && c.commentId == commentId);
  }

  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async {
    lastReactionEnabled = enabled;
    if (kind == 'save') saves++; else likes++;
  }
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

  testWidgets('saved library reads account data and unsaves without false success', (tester) async {
    final source = FakePosts()..savedHandler = () async => [post('saved')];
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saved').first);
    await tester.pumpAndSettle();
    expect(find.text('Published audio saved'), findsOneWidget);
    await tester.tap(find.text('Unsave'));
    await tester.pumpAndSettle();
    expect(source.lastReactionEnabled, false);
    expect(find.text('Published audio saved'), findsNothing);
  });

  testWidgets('My Talks removal requires confirmation and retains server status', (tester) async {
    final source = FakePosts()..mineHandler = () async => [post('mine')];
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    expect(find.text('Published audio mine'), findsOneWidget);
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    expect(find.text('Remove this Talk?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(source.removals, 0);
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(source.removals, 1);
    expect(find.text('Status: removed'), findsOneWidget);
    expect(find.text('Remove Talk'), findsNothing);
  });

  testWidgets('failed deletion stays available to retry', (tester) async {
    final source = FakePosts()
      ..mineHandler = (() async => [post('mine')])
      ..removeHandler = ((_) async => throw StateError('offline'));
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(source.removals, 1);
    expect(find.text('Remove Talk'), findsOneWidget);
    expect(find.textContaining('Could not remove Talk'), findsOneWidget);
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
  testWidgets('comments load, publish, read back and author removal updates UI',
      (tester) async {
    final source = FakePosts();
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.text('No comments yet. Start the conversation.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Hello from my Talk');
    await tester.tap(find.text('Send comment'));
    await tester.pumpAndSettle();
    expect(source.commentWrites, 1);
    expect(find.text('Hello from my Talk'), findsOneWidget);
    await tester.tap(find.byTooltip('Remove your comment'));
    await tester.pumpAndSettle();
    expect(find.text('Hello from my Talk'), findsNothing);
    expect(source.storedComments, isEmpty);
  });

  testWidgets('comment read errors expose retry without invented content',
      (tester) async {
    final source = FakePosts()
      ..commentsHandler = (_) async => throw StateError('offline');
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load comments'), findsOneWidget);
    source.commentsHandler = (_) async => [];
    await tester.tap(find.text('Refresh'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load comments'), findsNothing);
  });
}
String sourceAccount = 'old';

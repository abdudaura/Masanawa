import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_comments_sheet.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';

AudioPostComment makeComment(String id, {String postId = 'post1', bool mine = false}) =>
    AudioPostComment(
      postId: postId, commentId: id, body: 'Body ' + id,
      isMine: mine, createdAt: DateTime.utc(2026, 10, 10), removed: false,
    );

class FakeComments implements AudioPostTransport, AudioPostCommentPager {
  final cursors = <String?>[];
  final requests = <String>[];
  int failures = 0;
  Completer<AudioPostCommentPage>? pendingFirstPage;

  @override
  Future<AudioPostCommentPage> commentsPage({
    required String postId, String? cursor,
  }) async {
    cursors.add(cursor);
    if (pendingFirstPage != null && cursor == null) {
      return pendingFirstPage!.future;
    }
    if (cursor == null) {
      return AudioPostCommentPage(items: [
        makeComment('c1', mine: true), makeComment('c2'),
      ], nextCursor: 'c2');
    }
    if (cursor == 'c2') {
      return AudioPostCommentPage(items: [
        makeComment('c2'), makeComment('c3'),
      ], nextCursor: null);
    }
    throw StateError('Unexpected cursor');
  }

  @override
  Future<AudioPostComment> comment({
    required String postId, required String requestId, required String body,
  }) async {
    requests.add(requestId);
    if (failures-- > 0) throw StateError('Request timed out after server commit');
    return AudioPostComment(
      postId: postId, commentId: 'written', body: body, isMine: true,
      createdAt: DateTime.utc(2026, 10, 10), removed: false,
    );
  }
  @override
  Future<void> removeComment({
    required String postId, required String commentId,
  }) async {}
  @override
  Future<List<AudioPostComment>> comments({required String postId}) async => [];
  @override
  Future<AudioPostPage> discover({String? cursor}) async =>
      const AudioPostPage(items: [], nextCursor: null);
  @override
  Future<List<AudioPost>> mine() async => [];
  @override
  Future<List<AudioPost>> saved() async => [];
  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async => throw UnimplementedError();
  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async {}
  @override
  Future<AudioPost> removeMine({required String postId}) async =>
      throw UnimplementedError();
}

Widget sheet(FakeComments transport, {
  String accountId = 'alice', bool Function(String)? current,
  String Function()? requestId,
}) => MaterialApp(
  home: Scaffold(
    body: PublishedTalkCommentsSheet(
      postId: 'post1', accountId: accountId,
      isCurrentAccount: current ?? (id) => id == accountId,
      transport: transport,
      newRequestId: requestId,
    ),
  ),
);

void main() {
  testWidgets('loads older pages with no duplicate comments', (tester) async {
    final transport = FakeComments();
    await tester.pumpWidget(sheet(transport));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-comment-c1')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-comment-c2')), findsOneWidget);
    expect(transport.cursors, [null]);
    await tester.tap(find.byKey(const ValueKey('talk-comments-more')));
    await tester.pumpAndSettle();
    expect(transport.cursors, [null, 'c2']);
    expect(find.byKey(const ValueKey('talk-comment-c2')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-comment-c3')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-comments-more')), findsNothing);
  });

  testWidgets('uncertain comment retry retains exact idempotency key and text',
      (tester) async {
    final transport = FakeComments()..failures = 1;
    await tester.pumpWidget(sheet(transport, requestId: () => 'request-123'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('talk-comment-input')), 'An audio comment');
    await tester.tap(find.byKey(const ValueKey('talk-comment-send')));
    await tester.pumpAndSettle();
    expect(find.textContaining('unconfirmed'), findsOneWidget);
    expect(find.text('An audio comment'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-comment-send')));
    await tester.pumpAndSettle();
    expect(transport.requests, ['request-123', 'request-123']);
    expect(find.byKey(const ValueKey('talk-comment-written')), findsOneWidget);
    expect(find.text('An audio comment'), findsOneWidget);
    expect(find.textContaining('unconfirmed'), findsNothing);
  });

  testWidgets('account switch hides old comments and drops late responses',
      (tester) async {
    final transport = FakeComments()
      ..pendingFirstPage = Completer<AudioPostCommentPage>();
    bool authorized = true;
    await tester.pumpWidget(sheet(transport,
      current: (id) => authorized && id == 'alice'));
    await tester.pump();
    authorized = false;
    await tester.pumpWidget(sheet(transport, accountId: 'bob',
      current: (_) => false));
    transport.pendingFirstPage!.complete(AudioPostCommentPage(
      items: [makeComment('secret')], nextCursor: null,
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to read and write Talk comments.'), findsOneWidget);
    expect(find.text('Body secret'), findsNothing);
    expect(find.byKey(const ValueKey('talk-comment-send')), findsNothing);
  });

  testWidgets('only own comments expose delete; cancellation preserves data',
      (tester) async {
    final transport = FakeComments();
    await tester.pumpWidget(sheet(transport));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Remove your comment'), findsOneWidget);
    await tester.tap(find.byTooltip('Remove your comment'));
    await tester.pumpAndSettle();
    expect(find.text('Remove your comment?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-comment-c1')), findsOneWidget);
  });
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/audio_posts/following_transport.dart';
import 'package:masanawa/src/audio_posts/audio_post_report_action.dart';

AudioPost post(String id, {int likes = 0, int comments = 0}) => AudioPost(
  postId: id, authorId: 'author-a', authorKind: 'human',
  title: 'Published audio ' + id, durationMs: 22000,
  status: 'published', revision: 1, createdAt: DateTime.utc(2026, 10, 10),
  likeCount: likes, commentCount: comments,
);
class FakePosts implements AudioPostTransport, AudioPostCommentPager {
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
  Future<AudioPostCommentPage> commentsPage({
    required String postId, String? cursor,
  }) async => AudioPostCommentPage(
    items: await comments(postId: postId), nextCursor: null,
  );

  @override
  Future<AudioPostComment> comment({
    required String postId, required String requestId, required String body,
  }) async {
    commentWrites++;
    final record = AudioPostComment(
      postId: postId, commentId: 'comment-$commentWrites',
      isMine: true, body: body,
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
class FakeCreatorFollowing implements CreatorFollowingTransport {
  bool followed = false;
  int statusReads = 0, followWrites = 0, feedReads = 0;
  List<AudioPost> posts = [];
  Future<AudioPostPage> Function(String?)? followingHandler;
  @override
  Future<CreatorFollowReceipt> status({required String postId}) async {
    statusReads++;
    return CreatorFollowReceipt(
      authorId: 'author-a', authorKind: 'human', following: followed);
  }
  @override
  Future<CreatorFollowReceipt> set({
    required String postId, required bool enabled,
  }) async {
    followWrites++;
    followed = enabled;
    return CreatorFollowReceipt(
      authorId: 'author-a', authorKind: 'human', following: enabled);
  }
  @override
  Future<AudioPostPage> following({String? cursor}) {
    feedReads++;
    return followingHandler?.call(cursor) ??
        Future.value(AudioPostPage(items: posts, nextCursor: null));
  }
}
class FakeReportSubmissions implements PublishedAudioReportTransport {
  final requests = <String>[];
  @override
  Future<String> submit({
    required String postId,
    required String reason,
    required String clientRequestId,
    String? detail,
  }) async {
    requests.add(postId);
    return 'report-accepted';
  }
}

Widget screen(FakePosts source, String account, {
  bool Function(String)? current,
  CreatorFollowingTransport? following,
  PublishedAudioReportTransport? reporting,
}) =>
  MaterialApp(home: AudioPostFeedScreen(
    transport: source, followingTransport: following, accountId: account,
    isCurrentAccount: current ?? (id) => id == account,
    reportTransport: reporting,
  ));

void main() {
  testWidgets('published cards offer canonical report only when reporting is connected',
      (tester) async {
    final posts = FakePosts()..mineHandler = () async => [post('mine')];
    final reports = FakeReportSubmissions();
    await tester.pumpWidget(screen(posts, 'user-a'));
    await tester.pumpAndSettle();
    expect(find.text('Report Talk'), findsNothing);

    await tester.pumpWidget(screen(posts, 'user-a', reporting: reports));
    await tester.pumpAndSettle();
    expect(find.text('Report Talk'), findsOneWidget);
    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();
    expect(reports.requests, isEmpty);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(reports.requests, isEmpty);

    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(reports.requests, ['one']);
    expect(find.text('Report received for review.'), findsOneWidget);

    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    expect(find.text('Report Talk'), findsNothing);
  });

  testWidgets('report dialog cannot submit after active account changes',
      (tester) async {
    final posts = FakePosts();
    final reports = FakeReportSubmissions();
    var active = 'user-a';
    await tester.pumpWidget(screen(posts, 'user-a',
      current: (account) => account == active, reporting: reports));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();

    active = 'user-b';
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(reports.requests, isEmpty);
    expect(find.textContaining('Account changed.'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
  });

  testWidgets('Following uses existing authenticated feed and per-post follow receipts',
      (tester) async {
    final source = FakePosts();
    final following = FakeCreatorFollowing()..posts = [post('followed')];
    await tester.pumpWidget(screen(source, 'user-a', following: following));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
    await tester.tap(find.text('Follow'));
    await tester.pumpAndSettle();
    expect(following.followWrites, 1);
    expect(following.followed, true);
    await tester.tap(find.text('Following').first);
    await tester.pumpAndSettle();
    expect(find.text('Published audio followed'), findsOneWidget);
    expect(find.text('Comments'), findsOneWidget);
    expect(following.feedReads, 1);
    await tester.tap(find.text('Discover'));
    await tester.pumpAndSettle();
    expect(find.text('Published audio one'), findsOneWidget);
  });

  testWidgets('late Following results cannot cross an account switch',
      (tester) async {
    final previous = Completer<AudioPostPage>();
    String active = 'old';
    final source = FakePosts();
    final following = FakeCreatorFollowing()
      ..followingHandler = (_) => active == 'old'
        ? previous.future
        : Future.value(AudioPostPage(items: [post('new-followed')], nextCursor: null));
    await tester.pumpWidget(screen(source, 'old', following: following));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Following').first);
    await tester.pump();
    active = 'new';
    await tester.pumpWidget(screen(source, 'new', following: following));
    await tester.pumpAndSettle();
    previous.complete(AudioPostPage(items: [post('old-private')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Published audio new-followed'), findsOneWidget);
    expect(find.text('Published audio old-private'), findsNothing);
  });

  testWidgets('Following is not advertised when its authenticated API is unavailable',
      (tester) async {
    await tester.pumpWidget(screen(FakePosts(), 'user-a'));
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsNothing);
  });

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

  testWidgets('lost deletion acknowledgment reads removed receipt without false failure',
      (tester) async {
    var reads = 0;
    final source = FakePosts()
      ..removeHandler = (_) async => throw StateError('response lost')
      ..mineHandler = (() async {
        reads++;
        return [reads == 1 ? post('mine') : AudioPost(
          postId: 'mine', authorId: 'author-a', authorKind: 'human',
          title: 'Published audio mine', durationMs: 22000,
          status: 'removed', revision: 2, createdAt: DateTime.utc(2026, 10, 10),
        )];
      });
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(source.removals, 1);
    expect(reads, 2);
    expect(find.text('Status: removed'), findsOneWidget);
    expect(find.textContaining('Could not remove Talk'), findsNothing);
    expect(find.text('Remove Talk'), findsNothing);
  });

  testWidgets('unverified deletion blocks repeated writes until explicit readback',
      (tester) async {
    var reads = 0;
    final source = FakePosts()
      ..removeHandler = (_) async => throw StateError('network timeout')
      ..mineHandler = (() async {
        reads++;
        if (reads == 1) return [post('mine')];
        if (reads == 2) throw StateError('offline');
        return [AudioPost(
          postId: 'mine', authorId: 'author-a', authorKind: 'human',
          title: 'Published audio mine', durationMs: 22000,
          status: 'removed', revision: 2, createdAt: DateTime.utc(2026, 10, 10),
        )];
      });
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(source.removals, 1);
    expect(find.text('Check removal status'), findsOneWidget);
    expect(find.text('Remove Talk'), findsNothing);
    await tester.tap(find.text('Check removal status'));
    await tester.pumpAndSettle();
    expect(reads, 3);
    expect(source.removals, 1);
    expect(find.text('Status: removed'), findsOneWidget);
  });

  testWidgets('old account late deletion readback cannot change replacement account',
      (tester) async {
    final oldReadback = Completer<List<AudioPost>>();
    var reads = 0;
    final source = FakePosts()
      ..removeHandler = (_) async => throw StateError('timeout')
      ..mineHandler = (() {
        reads++;
        return reads == 1 ? Future.value([post('mine')]) : oldReadback.future;
      });
    await tester.pumpWidget(screen(source, 'old'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('My Talks'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pump();
    await tester.pumpWidget(screen(FakePosts(), 'new'));
    await tester.pumpAndSettle();
    oldReadback.complete([AudioPost(
      postId: 'mine', authorId: 'author-a', authorKind: 'human',
      title: 'Published audio mine', durationMs: 22000,
      status: 'removed', revision: 2, createdAt: DateTime.utc(2026, 10, 10),
    )]);
    await tester.pumpAndSettle();
    expect(find.text('Status: removed'), findsNothing);
    expect(find.text('Published audio mine'), findsNothing);
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
  testWidgets('paginated comments sheet sends and confirms own removal',
      (tester) async {
    final source = FakePosts();
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-comments-list')), findsOneWidget);
    expect(find.text('No comments yet.'), findsOneWidget);
    await tester.enterText(
        find.byKey(const ValueKey('talk-comment-input')), 'Hello from my Talk');
    await tester.tap(find.byKey(const ValueKey('talk-comment-send')));
    await tester.pumpAndSettle();
    expect(source.commentWrites, 1);
    expect(find.text('Hello from my Talk'), findsOneWidget);
    await tester.tap(find.byTooltip('Remove your comment'));
    await tester.pumpAndSettle();
    expect(find.text('Remove your comment?'), findsOneWidget);
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(find.text('Hello from my Talk'), findsNothing);
    expect(source.storedComments, isEmpty);
  });

  testWidgets('mounted comments sheet revokes old account and ignores late rows',
      (tester) async {
    final previous = Completer<List<AudioPostComment>>();
    final source = FakePosts()..commentsHandler = (_) => previous.future;
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pump();
    await tester.pumpWidget(screen(source, 'user-b'));
    await tester.pump();
    previous.complete([
      AudioPostComment(postId: 'one', commentId: 'private-1',
        isMine: false, body: 'Private prior-account content',
        createdAt: DateTime.utc(2026, 10, 10), removed: false),
    ]);
    await tester.pumpAndSettle();
    expect(find.text('Private prior-account content'), findsNothing);
    expect(find.text('Sign in to read and write Talk comments.'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    source.commentsHandler = (_) async => [];
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.text('Private prior-account content'), findsNothing);
    expect(find.text('No comments yet.'), findsOneWidget);
  });

  testWidgets('comment page offline error has a safe refresh action',
      (tester) async {
    final source = FakePosts()
      ..commentsHandler = (_) async => throw StateError('offline');
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comments'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load comments'), findsOneWidget);
    source.commentsHandler = (_) async => [];
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load comments'), findsNothing);
    expect(find.text('No comments yet.'), findsOneWidget);
  });

  testWidgets('persisted server engagement counts are visible to listeners', (tester) async {
    final source = FakePosts()
      ..discoverHandler = (_) async => AudioPostPage(
        items: [post('counted', likes: 3, comments: 2)],
        nextCursor: null);
    await tester.pumpWidget(screen(source, 'user-a'));
    await tester.pumpAndSettle();
    expect(find.text('3 likes · 2 comments'), findsOneWidget);
    expect(find.text('Published audio counted'), findsOneWidget);
  });

  test('audio-post wire parser refuses forged negative engagement totals', () {
    final wire = {
      'postId': 'p1', 'authorId': 'a1', 'authorKind': 'human',
      'title': 'Title', 'durationMs': 2000, 'status': 'published',
      'revision': 1, 'createdAt': '2026-10-10T00:00:00Z',
      'likeCount': -1, 'commentCount': 0,
    };
    expect(() => AudioPost.fromJson(wire), throwsFormatException);
    wire['likeCount'] = 2;
    wire['commentCount'] = 3;
    final parsed = AudioPost.fromJson(wire);
    expect(parsed.likeCount, 2);
    expect(parsed.commentCount, 3);
  });
}
String sourceAccount = 'old';

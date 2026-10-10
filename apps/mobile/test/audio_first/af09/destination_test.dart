import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_composer_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_destination.dart';
import 'package:masanawa/src/audio_posts/audio_post_draft_store.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/audio_posts/creator_profile_transport.dart';

final _post = AudioPost(
  postId: 'post1', authorId: 'creator1', authorKind: 'human',
  title: 'A public recording', durationMs: 12000, status: 'published',
  revision: 2, createdAt: DateTime.utc(2026, 10, 10),
);

class _AudioPosts implements AudioPostTransport {
  int discoverCalls = 0;
  int publishCalls = 0;

  @override
  Future<AudioPostPage> discover({String? cursor}) async {
    discoverCalls++;
    return AudioPostPage(items: [_post], nextCursor: null);
  }

  @override
  Future<List<AudioPost>> mine() async => [_post];
  @override
  Future<List<AudioPost>> saved() async => [];
  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async {
    publishCalls++;
    return AudioPost(
      postId: 'new1', authorId: 'creator1', authorKind: 'human',
      title: title, durationMs: 10000, status: 'processing',
      revision: 1, createdAt: DateTime.utc(2026, 10, 10),
    );
  }
  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async {}
  @override
  Future<List<AudioPostComment>> comments({required String postId}) async => [];
  @override
  Future<AudioPostComment> comment({
    required String postId, required String requestId, required String body,
  }) => throw UnimplementedError();
  @override
  Future<void> removeComment({
    required String postId, required String commentId,
  }) async {}
  @override
  Future<AudioPost> removeMine({required String postId}) async => _post;
}

class _Creators implements CreatorProfileTransport {
  int calls = 0;
  @override
  Future<AudioPostPage> posts({
    required String authorId, required String authorKind, String? cursor,
  }) async {
    calls++;
    expect(authorId, 'creator1');
    expect(authorKind, 'human');
    return AudioPostPage(items: [_post], nextCursor: null);
  }
}

class _MemoryAttemptStore implements TalkPublishAttemptStore {
  PendingTalkPublish? attempt;
  @override
  Future<PendingTalkPublish?> read(String accountId) async =>
      attempt?.accountId == accountId ? attempt : null;
  @override
  Future<void> write(PendingTalkPublish value) async {
    attempt = value;
  }
  @override
  Future<void> clear(String accountId, String requestId) async {
    if (attempt?.accountId == accountId && attempt?.requestId == requestId) {
      attempt = null;
    }
  }
}

void main() {
  testWidgets('published creator opens canonical profile without replacing feed',
      (tester) async {
    final posts = _AudioPosts();
    final creators = _Creators();
    await tester.pumpWidget(MaterialApp(
      home: PublishedTalksDestination(
        accountId: 'alice', isCurrentAccount: (id) => id == 'alice',
        transport: posts, creatorTransport: creators,
        attemptStore: _MemoryAttemptStore(),
      ),
    ));
    await tester.pumpAndSettle();
    final creator = find.byKey(const ValueKey('talk-creator-post1'));
    await tester.ensureVisible(creator);
    await tester.tap(creator);
    await tester.pumpAndSettle();
    expect(creators.calls, 1);
    expect(find.byKey(const ValueKey('creator-profile-list')), findsOneWidget);
    expect(find.byKey(const ValueKey('creator-post-post1')), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('audio-post-discover')), findsOneWidget);
    expect(posts.discoverCalls, 1); // Route return does not blank/reload feed.
  });

  testWidgets('unconfigured creator route never displays a fake link',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: PublishedTalksDestination(
        accountId: 'alice', isCurrentAccount: (id) => id == 'alice',
        transport: _AudioPosts(), attemptStore: _MemoryAttemptStore(),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-creator-post1')), findsNothing);
    expect(find.text('creator1'), findsOneWidget);
  });

  testWidgets('publisher receipt refreshes feed without resetting navigation',
      (tester) async {
    final posts = _AudioPosts();
    final store = _MemoryAttemptStore();
    await tester.pumpWidget(MaterialApp(
      home: PublishedTalksDestination(
        accountId: 'alice', isCurrentAccount: (id) => id == 'alice',
        transport: posts, attemptStore: store,
        acquireVerifiedAudio: () async =>
            const VerifiedPostAudio(assetId: 'verified1', durationMs: 10000),
      ),
    ));
    await tester.pumpAndSettle();
    expect(posts.discoverCalls, 1);
    await tester.tap(find.byTooltip('Record an audio Talk'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-publish')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'My Talk');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.publishCalls, 1);
    expect(find.byKey(const ValueKey('talk-receipt')), findsOneWidget);
    expect(posts.discoverCalls, 2);
    expect(store.attempt, isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('audio-post-discover')), findsOneWidget);
    expect(posts.discoverCalls, 2);
  });
}

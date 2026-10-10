import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_composer_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_destination.dart';
import 'package:masanawa/src/audio_posts/audio_post_playback.dart';
import 'package:masanawa/src/core/network/api_client.dart';
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

class _FakeAudioOutput implements PublishedTalkAudioOutput {
  int starts = 0;
  @override
  Future<void> start(Uri signedUrl) async { starts++; }
  @override
  Future<void> stop() async {}
  @override
  Future<void> dispose() async {}
}

void main() {
  testWidgets('Talks destination wires real capture when server-verified uploader exists',
      (tester) async {
    final posts = _AudioPosts();
    var uploaded = 0;
    await tester.pumpWidget(MaterialApp(
      home: PublishedTalksDestination(
        accountId: 'alice', isCurrentAccount: (id) => id == 'alice',
        transport: posts, attemptStore: _MemoryAttemptStore(),
        uploadVerifiedAudio: ({
          required localPath,
          required uploadRequestId,
          required startMs,
          required endMs,
        }) async {
          uploaded++;
          return VerifiedPostAudio(
            assetId: 'server-owned-audio',
            durationMs: endMs - startMs,
          );
        },
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Record an audio Talk'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-record')), findsOneWidget);
    final button = tester.widget<OutlinedButton>(
      find.byKey(const ValueKey('talk-record')));
    expect(button.onPressed, isNotNull);
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    expect(find.text('Record a Talk'), findsOneWidget);
    expect(find.text('Discard and close'), findsOneWidget);
    expect(posts.publishCalls, 0);
    await tester.tap(find.text('Discard and close'));
    await tester.pumpAndSettle();
    expect(find.text('Record a Talk'), findsNothing);
    expect(uploaded, 0);
    expect(posts.publishCalls, 0);
  });

  testWidgets('account replacement closes an older creator route',
      (tester) async {
    final posts = _AudioPosts();
    final creators = _Creators();
    Widget root(String account) => MaterialApp(
      home: PublishedTalksDestination(
        accountId: account, isCurrentAccount: (id) => id == account,
        transport: posts, creatorTransport: creators,
        attemptStore: _MemoryAttemptStore(),
      ),
    );
    await tester.pumpWidget(root('alice'));
    await tester.pumpAndSettle();
    final creator = find.byKey(const ValueKey('talk-creator-post1'));
    await tester.ensureVisible(creator);
    await tester.tap(creator);
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('creator-profile-list')), findsOneWidget);
    await tester.pumpWidget(root('bob'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('creator-profile-list')), findsNothing);
    expect(find.byKey(const ValueKey('audio-post-discover')), findsOneWidget);
  });

  testWidgets('creator Talk opens controllable playback with same AF09 ticket',
      (tester) async {
    final output = _FakeAudioOutput();
    final playback = AudioPostPlaybackController(
      api: ApiClient(dio: Dio()), accountId: 'alice',
      isCurrentAccount: (id) => id == 'alice',
      expectedMediaHost: 'storage.example.com',
      output: output, nowMs: () => 2000000000000,
      ticketRequest: (id) async => {
        'url': 'https://storage.example.com/audio/$id?sig=ok',
        'expiresAtMs': 2000000030000,
      },
    );
    addTearDown(playback.dispose);
    await tester.pumpWidget(MaterialApp(
      home: PublishedTalksDestination(
        accountId: 'alice', isCurrentAccount: (id) => id == 'alice',
        transport: _AudioPosts(), creatorTransport: _Creators(),
        playback: playback, attemptStore: _MemoryAttemptStore(),
      ),
    ));
    await tester.pumpAndSettle();
    final creator = find.byKey(const ValueKey('talk-creator-post1'));
    await tester.ensureVisible(creator);
    await tester.tap(creator);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('creator-post-post1')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('creator-talk-listen')), findsOneWidget);
    expect(output.starts, 0);
    await tester.tap(find.byKey(const ValueKey('creator-talk-listen')));
    await tester.pumpAndSettle();
    expect(output.starts, 1);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(playback.playing, isFalse);
  });

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

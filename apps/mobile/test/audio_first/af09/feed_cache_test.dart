import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_cache.dart';
import 'package:masanawa/src/audio_posts/audio_post_feed_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';

AudioPost item(String id) => AudioPost(
  postId: id,
  authorId: 'creator',
  authorKind: 'human',
  title: 'Talk $id',
  durationMs: 24000,
  status: 'published',
  revision: 1,
  createdAt: DateTime.utc(2026, 10, 10),
);

class MemoryFeedCache implements PublishedTalkFeedCache {
  final Map<String, List<AudioPost>> data = {};
  final List<String> cleared = [];
  @override
  Future<List<AudioPost>?> read(String accountId) async => data[accountId];
  @override
  Future<void> write(String accountId, List<AudioPost> posts) async {
    data[accountId] = List.unmodifiable(posts);
  }
  @override
  Future<void> clear(String accountId) async {
    data.remove(accountId);
    cleared.add(accountId);
  }
}


class _DelayedAccountCache extends MemoryFeedCache {
  _DelayedAccountCache(this.oldRead);
  final Completer<List<AudioPost>?> oldRead;
  @override
  Future<List<AudioPost>?> read(String accountId) =>
      accountId == 'alice' ? oldRead.future : super.read(accountId);
}

class FakeFeedTransport implements AudioPostTransport {
  Future<AudioPostPage> Function(String?)? onDiscover;
  int discoverCount = 0;
  @override
  Future<AudioPostPage> discover({String? cursor}) {
    discoverCount++;
    return onDiscover?.call(cursor) ??
        Future.value(AudioPostPage(items: [item('live')], nextCursor: null));
  }
  @override
  Future<List<AudioPost>> mine() async => [];
  @override
  Future<List<AudioPost>> saved() async => [];
  @override
  Future<AudioPost> publish({
    required String requestId,
    required String assetId,
    required String title,
  }) async => item('new');
  @override
  Future<AudioPost> removeMine({required String postId}) async => item(postId);
  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async {}
  @override
  Future<List<AudioPostComment>> comments({required String postId}) async => [];
  @override
  Future<AudioPostComment> comment({
    required String postId,
    required String requestId,
    required String body,
  }) => Future.error(UnimplementedError());
  @override
  Future<void> removeComment({
    required String postId, required String commentId,
  }) async {}
}

Widget feed(FakeFeedTransport transport, MemoryFeedCache cache, String account) {
  return MaterialApp(home: AudioPostFeedScreen(
    transport: transport, cache: cache,
    accountId: account, isCurrentAccount: (id) => id == account,
  ));
}

void main() {
  testWidgets('cached Discover renders while live request is still pending',
      (tester) async {
    final waiting = Completer<AudioPostPage>();
    final cache = MemoryFeedCache()..data['alice'] = [item('cached')];
    final source = FakeFeedTransport()..onDiscover = (_) => waiting.future;
    await tester.pumpWidget(feed(source, cache, 'alice'));
    await tester.pump();
    expect(find.text('Talk cached'), findsOneWidget);
    expect(find.byKey(const ValueKey('talks-offline-snapshot')), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    waiting.complete(AudioPostPage(items: [item('fresh')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Talk fresh'), findsOneWidget);
    expect(find.text('Talk cached'), findsNothing);
    expect(cache.data['alice']!.single.postId, 'fresh');
    expect(find.byKey(const ValueKey('talks-offline-snapshot')), findsNothing);
  });

  testWidgets('refresh retains prior content rather than replacing it with a spinner',
      (tester) async {
    final source = FakeFeedTransport();
    final cache = MemoryFeedCache();
    await tester.pumpWidget(feed(source, cache, 'alice'));
    await tester.pumpAndSettle();
    expect(find.text('Talk live'), findsOneWidget);

    final waiting = Completer<AudioPostPage>();
    source.onDiscover = (_) => waiting.future;
    await tester.tap(find.byTooltip('Refresh audio posts'));
    await tester.pump();
    expect(find.text('Talk live'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    waiting.complete(AudioPostPage(items: [item('new')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Talk new'), findsOneWidget);
    expect(find.text('Talk live'), findsNothing);
  });

  testWidgets('offline failure preserves stale feed and offers accurate retry',
      (tester) async {
    final cache = MemoryFeedCache()..data['alice'] = [item('cached')];
    final source = FakeFeedTransport()
      ..onDiscover = (_) => Future.error(StateError('offline'));
    await tester.pumpWidget(feed(source, cache, 'alice'));
    await tester.pumpAndSettle();
    expect(find.text('Talk cached'), findsOneWidget);
    expect(find.textContaining('Could not load audio Talks'), findsOneWidget);
    source.onDiscover = (_) async =>
        AudioPostPage(items: [item('recovered')], nextCursor: null);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Talk recovered'), findsOneWidget);
    expect(find.text('Talk cached'), findsNothing);
  });

  testWidgets('account change clears prior projection and drops stale network result',
      (tester) async {
    final oldNetwork = Completer<AudioPostPage>();
    final cache = MemoryFeedCache()
      ..data['alice'] = [item('alice-only')]
      ..data['bob'] = [item('bob-only')];
    final source = FakeFeedTransport();
    source.onDiscover = (_) => oldNetwork.future;
    await tester.pumpWidget(feed(source, cache, 'alice'));
    await tester.pump();
    expect(find.text('Talk alice-only'), findsOneWidget);

    source.onDiscover = (_) async =>
        AudioPostPage(items: [item('bob-new')], nextCursor: null);
    await tester.pumpWidget(feed(source, cache, 'bob'));
    await tester.pumpAndSettle();
    expect(find.text('Talk alice-only'), findsNothing);
    expect(find.text('Talk bob-new'), findsOneWidget);
    oldNetwork.complete(AudioPostPage(items: [item('alice-late')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Talk alice-late'), findsNothing);
    expect(cache.cleared, contains('alice'));
    expect(cache.data.containsKey('alice'), isFalse);
  });

  testWidgets('late secure-cache read cannot overwrite a switched account',
      (tester) async {
    final diskRead = Completer<List<AudioPost>?>();
    final cache = _DelayedAccountCache(diskRead);
    final network = Completer<AudioPostPage>();
    final source = FakeFeedTransport()..onDiscover = (_) => network.future;
    await tester.pumpWidget(feed(source, cache, 'alice'));
    await tester.pump();
    expect(find.text('Talk alice-private'), findsNothing);
    source.onDiscover = (_) async =>
        AudioPostPage(items: [item('bob-authoritative')], nextCursor: null);
    await tester.pumpWidget(feed(source, cache, 'bob'));
    await tester.pumpAndSettle();
    diskRead.complete([item('alice-private')]);
    network.complete(AudioPostPage(items: [item('alice-from-network')], nextCursor: null));
    await tester.pumpAndSettle();
    expect(find.text('Talk alice-private'), findsNothing);
    expect(find.text('Talk alice-from-network'), findsNothing);
    expect(find.text('Talk bob-authoritative'), findsOneWidget);
  });
}

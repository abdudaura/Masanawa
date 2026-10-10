import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/audio_posts/creator_profile_transport.dart';
import 'package:masanawa/src/audio_posts/creator_profile_screen.dart';

class FakeCreatorProfile implements CreatorProfileTransport {
  AudioPostPage? result;
  Object? failure;
  int calls = 0;

  @override
  Future<AudioPostPage> posts({
    required String authorId, required String authorKind, String? cursor,
  }) async {
    calls++;
    if (failure != null) throw failure!;
    return result ?? const AudioPostPage(items: [], nextCursor: null);
  }
}

AudioPost post({String authorId = 'alice'}) => AudioPost(
  postId: 'post1', authorId: authorId, authorKind: 'human',
  title: 'A real Talk', durationMs: 12000, status: 'published',
  revision: 1, createdAt: DateTime.utc(2026, 10, 10),
  likeCount: 2, commentCount: 1, listenCount: 4,
);

void main() {
  testWidgets('published creator posts open through injected action', (tester) async {
    final client = FakeCreatorProfile()
      ..result = AudioPostPage(items: [post()], nextCursor: null);
    String? opened;
    await tester.pumpWidget(MaterialApp(home: CreatorProfileScreen(
      transport: client, accountId: 'bob', isCurrentAccount: (id) => id == 'bob',
      authorId: 'alice', authorKind: 'human', displayName: 'Alice',
      onOpenPost: (item) => opened = item.postId,
    )));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsOneWidget);
    expect(find.text('2 likes · 1 comments · 4 listens'), findsOneWidget);
    await tester.tap(find.text('A real Talk'));
    expect(opened, 'post1');
  });

  testWidgets('failed network read keeps usable retry', (tester) async {
    final client = FakeCreatorProfile()..failure = StateError('offline');
    await tester.pumpWidget(MaterialApp(home: CreatorProfileScreen(
      transport: client, accountId: 'bob', isCurrentAccount: (_) => true,
      authorId: 'alice', authorKind: 'human',
    )));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('creator-profile-error')), findsOneWidget);
    client.failure = null;
    client.result = AudioPostPage(items: [post()], nextCursor: null);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsOneWidget);
  });

  testWidgets('refresh failure preserves previously loaded creator posts', (tester) async {
    final client = FakeCreatorProfile()
      ..result = AudioPostPage(items: [post()], nextCursor: null);
    await tester.pumpWidget(MaterialApp(home: CreatorProfileScreen(
      transport: client, accountId: 'bob', isCurrentAccount: (_) => true,
      authorId: 'alice', authorKind: 'human',
    )));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsOneWidget);
    client.failure = StateError('offline');
    await tester.drag(find.byKey(const ValueKey('creator-profile-list')),
      const Offset(0, 350));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsOneWidget);
    expect(find.byKey(const ValueKey('creator-profile-error')), findsOneWidget);
  });

  testWidgets('account switch clears previous visible data', (tester) async {
    final client = FakeCreatorProfile()
      ..result = AudioPostPage(items: [post()], nextCursor: null);
    Widget screen(String account) => MaterialApp(home: CreatorProfileScreen(
      transport: client, accountId: account,
      isCurrentAccount: (id) => id == 'bob',
      authorId: 'alice', authorKind: 'human',
    ));
    await tester.pumpWidget(screen('bob'));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsOneWidget);
    await tester.pumpWidget(screen('charlie'));
    await tester.pumpAndSettle();
    expect(find.text('A real Talk'), findsNothing);
    expect(find.text('Sign in to view creators.'), findsOneWidget);
  });
}

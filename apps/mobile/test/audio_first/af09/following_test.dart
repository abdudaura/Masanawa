import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../../lib/src/audio_posts/audio_post_transport.dart';
import '../../../lib/src/audio_posts/follow_button.dart';
import '../../../lib/src/audio_posts/following_transport.dart';

class FakeFollowing implements CreatorFollowingTransport {
  bool current = false;
  bool failStatus = false;
  String? failure;
  int reads = 0;
  int writes = 0;
  final List<AudioPost> posts = [];
  @override
  Future<CreatorFollowReceipt> status({required String postId}) async {
    reads++;
    if (failStatus) throw Exception('offline');
    return CreatorFollowReceipt(
      authorId: 'author1', authorKind: 'human', following: current,
    );
  }
  @override
  Future<CreatorFollowReceipt> set({
    required String postId, required bool enabled,
  }) async {
    writes++;
    if (failure != null) throw Exception(failure);
    current = enabled;
    return CreatorFollowReceipt(
      authorId: 'author1', authorKind: 'human', following: enabled,
    );
  }
  @override
  Future<AudioPostPage> following({String? cursor}) async {
    if (failure != null) throw Exception(failure);
    return AudioPostPage(items: posts, nextCursor: null);
  }
}
Widget button(FakeFollowing transport, String account) => MaterialApp(
  home: Scaffold(body: CreatorFollowButton(
    transport: transport,
    postId: 'talk1', authorId: 'author1', authorKind: 'human',
    accountId: account, isCurrentAccount: (id) => id == account,
  )),
);

void main() {
  testWidgets('follow and unfollow persist through verified server receipts', (tester) async {
    final transport = FakeFollowing();
    await tester.pumpWidget(button(transport, 'alice'));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
    await tester.tap(find.text('Follow'));
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsOneWidget);
    expect(transport.writes, 1);
    await tester.tap(find.text('Following'));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
    expect(transport.writes, 2);
  });

  testWidgets('offline status is retryable and does not claim a follow state', (tester) async {
    final transport = FakeFollowing()..failStatus = true;
    await tester.pumpWidget(button(transport, 'alice'));
    await tester.pumpAndSettle();
    expect(find.text('Retry follow status'), findsOneWidget);
    transport.failStatus = false;
    await tester.tap(find.text('Retry follow status'));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
  });

  testWidgets('account switch clears prior follow state and reads new account', (tester) async {
    final transport = FakeFollowing()..current = true;
    await tester.pumpWidget(button(transport, 'alice'));
    await tester.pumpAndSettle();
    expect(find.text('Following'), findsOneWidget);
    transport.current = false;
    await tester.pumpWidget(button(transport, 'bob'));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
    expect(transport.reads, 2);
  });

  testWidgets('failed mutation never produces a fake success state', (tester) async {
    final transport = FakeFollowing()..failure = 'provider unavailable';
    await tester.pumpWidget(button(transport, 'alice'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Follow'));
    await tester.pumpAndSettle();
    expect(find.text('Follow'), findsOneWidget);
    expect(find.textContaining('Could not update follow'), findsOneWidget);
  });

  testWidgets('Following list handles empty state and retryable load failure', (tester) async {
    final transport = FakeFollowing();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: AudioFollowingList(
      transport: transport,
      accountId: 'alice',
      isCurrentAccount: (id) => id == 'alice',
      onOpenPost: (_) {},
    ))));
    await tester.pumpAndSettle();
    expect(find.textContaining('No Talks from followed creators'), findsOneWidget);
    transport.failure = 'offline';
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: AudioFollowingList(
      transport: transport,
      accountId: 'alice',
      isCurrentAccount: (id) => id == 'alice',
      onOpenPost: (_) {},
    ))));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not load followed Talks'), findsOneWidget);
  });
}

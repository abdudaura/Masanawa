import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_composer_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';

class PostsFake implements AudioPostTransport {
  int sends = 0;
  String? requestId, assetId, title;
  Future<AudioPost> Function()? onSend;
  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async {
    sends++;
    this.requestId = requestId;
    this.assetId = assetId;
    this.title = title;
    if (onSend != null) return onSend!();
    return AudioPost(
      postId: 'post-one', authorId: 'owner', authorKind: 'human',
      title: title, durationMs: 30000, status: 'processing', revision: 0,
      createdAt: DateTime.utc(2026, 10, 10),
    );
  }
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Widget composer(PostsFake posts, String account, {
  AcquireVerifiedPostAudio? record,
  void Function(AudioPost)? published,
}) => MaterialApp(home: AudioPostComposerScreen(
  transport: posts, accountId: account, isCurrentAccount: (id) => id == account,
  acquireVerifiedAudio: record, onPublished: published,
  newRequestId: () => 'stable-attempt-1',
));

void main() {
  testWidgets('does not permit publication when verified recording is unavailable', (tester) async {
    final posts = PostsFake();
    await tester.pumpWidget(composer(posts, 'user-a'));
    final record = tester.widget<OutlinedButton>(find.byKey(const ValueKey('talk-record')));
    final publish = tester.widget<FilledButton>(find.byKey(const ValueKey('talk-publish')));
    expect(record.onPressed, isNull);
    expect(publish.onPressed, isNull);
    expect(find.textContaining('not configured in this build'), findsOneWidget);
    expect(posts.sends, 0);
  });

  testWidgets('record, title and publish through actual transport returning processing receipt', (tester) async {
    final posts = PostsFake();
    AudioPost? result;
    await tester.pumpWidget(composer(posts, 'user-a',
      record: () async => const VerifiedPostAudio(assetId: 'owned-ready-1', durationMs: 30000),
      published: (value) => result = value));
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'A local story');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 1);
    expect(posts.requestId, 'stable-attempt-1');
    expect(posts.assetId, 'owned-ready-1');
    expect(posts.title, 'A local story');
    expect(result?.postId, 'post-one');
    expect(find.textContaining('processing and is not public'), findsOneWidget);
    expect(tester.widget<FilledButton>(
      find.byKey(const ValueKey('talk-publish'))).onPressed, isNull);
  });

  testWidgets('uncertain offline retry retains exact request and prevents editing', (tester) async {
    final posts = PostsFake();
    posts.onSend = () async => throw StateError('outcome unknown');
    await tester.pumpWidget(composer(posts, 'user-a',
      record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 6000)));
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Retry the same post');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(find.textContaining('unconfirmed'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const ValueKey('talk-title'))).readOnly, isTrue);
    expect(posts.requestId, 'stable-attempt-1');
    posts.onSend = null;
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 2);
    expect(posts.requestId, 'stable-attempt-1');
    expect(find.byKey(const ValueKey('talk-receipt')), findsOneWidget);
  });

  testWidgets('account switch fences late recording callback and clears title', (tester) async {
    final pending = Completer<VerifiedPostAudio?>();
    final posts = PostsFake();
    await tester.pumpWidget(composer(posts, 'old', record: () => pending.future));
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Private from old');
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pump();
    await tester.pumpWidget(composer(posts, 'new',
      record: () async => const VerifiedPostAudio(assetId: 'new', durationMs: 10000)));
    pending.complete(const VerifiedPostAudio(assetId: 'old', durationMs: 20000));
    await tester.pumpAndSettle();
    expect(find.text('Private from old'), findsNothing);
    expect(find.textContaining('Verified audio:'), findsNothing);
    expect(posts.sends, 0);
  });

  testWidgets('invalid recording and capture permission denial remain retryable', (tester) async {
    final posts = PostsFake();
    var attempts = 0;
    await tester.pumpWidget(composer(posts, 'user-a', record: () async {
      attempts++;
      if (attempts == 1) {
        throw const AudioCaptureException(AudioCaptureFailure.permission);
      }
      return const VerifiedPostAudio(assetId: 'invalid?', durationMs: 250000);
    }));
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    expect(find.textContaining('microphone permission'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    expect(find.textContaining('between 1 second and 3 minutes'), findsOneWidget);
    expect(tester.widget<FilledButton>(
      find.byKey(const ValueKey('talk-publish'))).onPressed, isNull);
    expect(posts.sends, 0);
  });

  testWidgets('repeated publish taps do not issue parallel requests', (tester) async {
    final completed = Completer<AudioPost>();
    final posts = PostsFake()..onSend = () => completed.future;
    await tester.pumpWidget(composer(posts, 'user-a',
      record: () async => const VerifiedPostAudio(assetId: 'ready', durationMs: 20000)));
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Single submission');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pump();
    expect(tester.widget<FilledButton>(
      find.byKey(const ValueKey('talk-publish'))).onPressed, isNull);
    expect(posts.sends, 1);
    completed.complete(AudioPost(
      postId: 'post-one', authorId: 'owner', authorKind: 'human',
      title: 'Single submission', durationMs: 20000, status: 'processing',
      revision: 0, createdAt: DateTime.utc(2026, 10, 10),
    ));
    await tester.pumpAndSettle();
    expect(posts.sends, 1);
  });
  testWidgets('failed moderation is a terminal confirmed outcome, not uncertain retry', (tester) async {
    final posts = PostsFake();
    var navigations = 0;
    posts.onSend = () async => AudioPost(
      postId: 'denied', authorId: 'owner', authorKind: 'human',
      title: 'Blocked content', durationMs: 20000, status: 'failed',
      revision: 1, createdAt: DateTime.utc(2026, 10, 10),
    );
    await tester.pumpWidget(composer(posts, 'user-a',
      record: () async => const VerifiedPostAudio(assetId: 'owned', durationMs: 20000),
      published: (_) => navigations++));
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Blocked content');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(find.textContaining('not approved'), findsOneWidget);
    expect(find.textContaining('unconfirmed'), findsNothing);
    expect(posts.sends, 1);
    expect(navigations, 0);
    expect(tester.widget<FilledButton>(
      find.byKey(const ValueKey('talk-publish'))).onPressed, isNull);
  });

}

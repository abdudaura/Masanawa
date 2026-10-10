import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_composer_screen.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/audio_posts/audio_post_draft_store.dart';

class FakeAttempts implements TalkPublishAttemptStore {
  PendingTalkPublish? pending;
  bool failRead = false, failWrite = false, failClear = false;
  int writes = 0;
  @override
  Future<PendingTalkPublish?> read(String accountId) async {
    if (failRead) throw StateError('secure storage offline');
    return pending?.accountId == accountId ? pending : null;
  }
  @override
  Future<void> write(PendingTalkPublish next) async {
    if (failWrite) throw StateError('cannot encrypt');
    writes++;
    pending = next;
  }
  @override
  Future<void> clear(String accountId, String requestId) async {
    if (failClear) throw StateError('cannot clear');
    if (pending?.accountId == accountId && pending?.requestId == requestId) {
      pending = null;
    }
  }
}

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
  TalkPublishAttemptStore? store,
}) => MaterialApp(home: AudioPostComposerScreen(
  transport: posts, accountId: account, isCurrentAccount: (id) => id == account,
  acquireVerifiedAudio: record, onPublished: published,
  newRequestId: () => 'stable-attempt-1',
  attemptStore: store ?? FakeAttempts(),
));

/// Supports the same optional receipt contract as the production Gateway
/// transport without changing legacy fake transports in these widget tests.
class ReceiptPostsFake extends PostsFake implements AudioPostReceiptLookup {
  int lookups = 0;
  AudioPost? serverReceipt;
  bool lookupOffline = false;
  Future<AudioPost?> Function()? onLookup;
  @override
  Future<AudioPost?> receiptByRequest({required String requestId}) async {
    lookups++;
    if (lookupOffline) throw StateError('receipt lookup offline');
    if (requestId != 'stable-attempt-1') throw StateError('unexpected key');
    if (onLookup != null) return onLookup!();
    return serverReceipt;
  }
}

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

  testWidgets('unknown network result survives restart and keeps request key', (tester) async {
    final store = FakeAttempts();
    final posts = PostsFake()..onSend = () async => throw StateError('timeout');
    await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 6000)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'A durable story');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 1);
    expect(store.pending?.requestId, 'stable-attempt-1');
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    await tester.pumpWidget(composer(posts, 'user-a', store: store));
    await tester.pumpAndSettle();
    expect(find.text('A durable story'), findsOneWidget);
    expect(find.textContaining('earlier publish attempt is unconfirmed'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const ValueKey('talk-title'))).readOnly, isTrue);
    posts.onSend = null;
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 2);
    expect(posts.requestId, 'stable-attempt-1');
    expect(store.pending, isNull);
    expect(find.byKey(const ValueKey('talk-receipt')), findsOneWidget);
  });

  testWidgets('secure write failure never sends or loses editable draft', (tester) async {
    final store = FakeAttempts()..failWrite = true;
    final posts = PostsFake();
    await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'ready', durationMs: 2000)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('talk-record')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Safe title');
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 0);
    expect(find.textContaining('No request was sent'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const ValueKey('talk-title'))).readOnly, isFalse);
    store.failWrite = false;
    await tester.tap(find.byKey(const ValueKey('talk-publish')));
    await tester.pumpAndSettle();
    expect(posts.sends, 1);
    expect(store.pending, isNull);
  });

  testWidgets('wrong account cannot access saved attempt and recovered attempt can be discarded', (tester) async {
    final store = FakeAttempts()..pending = const PendingTalkPublish(
      accountId: 'user-a', requestId: 'saved-key', assetId: 'saved-a',
      durationMs: 4000, title: 'Private saved draft');
    final posts = PostsFake();
    await tester.pumpWidget(composer(posts, 'user-b', store: store));
    await tester.pumpAndSettle();
    expect(find.text('Private saved draft'), findsNothing);
    expect(find.textContaining('earlier publish attempt'), findsNothing);
    expect(store.pending?.accountId, 'user-a');
    await tester.pumpWidget(composer(posts, 'user-a', store: store));
    await tester.pumpAndSettle();
    expect(find.text('Private saved draft'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-discard')));
    await tester.pumpAndSettle();
    expect(find.text('Discard publish attempt?'), findsOneWidget);
    await tester.tap(find.text('Discard').last);
    await tester.pumpAndSettle();
    expect(store.pending, isNull);
    expect(posts.sends, 0);
    expect(find.text('Private saved draft'), findsNothing);
  });

  testWidgets('unavailable secure recovery blocks new sends until read succeeds', (tester) async {
    final store = FakeAttempts()..failRead = true;
    final posts = PostsFake();
    await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'a', durationMs: 2000)));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-retry-recovery')), findsOneWidget);
    expect(tester.widget<OutlinedButton>(
      find.byKey(const ValueKey('talk-record'))).onPressed, isNull);
    expect(posts.sends, 0);
    store.failRead = false;
    await tester.tap(find.byKey(const ValueKey('talk-retry-recovery')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('talk-retry-recovery')), findsNothing);
    expect(tester.widget<OutlinedButton>(
      find.byKey(const ValueKey('talk-record'))).onPressed, isNotNull);
  });




testWidgets('uncertain publish retry reads server receipt without posting twice', (tester) async {
  final posts = ReceiptPostsFake()..onSend = () async => throw StateError('lost response');
  final store = FakeAttempts();
  var callbacks = 0;
  await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'asset-a', durationMs: 6000),
      published: (_) => callbacks++));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Recovered title');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  expect(posts.sends, 1);
  expect(store.pending?.requestId, 'stable-attempt-1');
  posts.serverReceipt = AudioPost(
    postId: 'already-committed', authorId: 'owner', authorKind: 'human',
    title: 'Recovered title', durationMs: 6000, status: 'processing',
    revision: 0, createdAt: DateTime.utc(2026, 10, 10));
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  expect(posts.lookups, 1);
  expect(posts.sends, 1);
  expect(store.pending, isNull);
  expect(callbacks, 1);
  expect(find.textContaining('Talk received'), findsOneWidget);
});

testWidgets('failed server receipt lookup cannot cause a blind repost', (tester) async {
  final posts = ReceiptPostsFake()..onSend = () async => throw StateError('lost response');
  final store = FakeAttempts();
  await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'asset-a', durationMs: 6000)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Still uncertain');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  posts.lookupOffline = true;
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  expect(posts.sends, 1);
  expect(posts.lookups, 1);
  expect(store.pending?.requestId, 'stable-attempt-1');
  expect(find.textContaining('unconfirmed'), findsOneWidget);
});

testWidgets('confirmed absence permits replay with the original request key', (tester) async {
  final posts = ReceiptPostsFake()..onSend = () async => throw StateError('timeout');
  final store = FakeAttempts();
  await tester.pumpWidget(composer(posts, 'user-a', store: store,
      record: () async => const VerifiedPostAudio(assetId: 'asset-a', durationMs: 6000)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Safe replay');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  posts.onSend = null;
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  expect(posts.lookups, 1);
  expect(posts.sends, 2);
  expect(posts.requestId, 'stable-attempt-1');
  expect(store.pending, isNull);
});


testWidgets('accepted processing Talk can become published by receipt lookup without repost', (tester) async {
  final posts = ReceiptPostsFake();
  final store = FakeAttempts();
  final statuses = <String>[];
  await tester.pumpWidget(composer(posts, 'user-a', store: store,
    record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 30000),
    published: (post) => statuses.add(post.status)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Story');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  expect(find.byKey(const ValueKey('talk-check-status')), findsOneWidget);
  expect(statuses, ['processing']);
  posts.serverReceipt = AudioPost(
    postId: 'post-one', authorId: 'owner', authorKind: 'human',
    title: 'Story', durationMs: 30000, status: 'published', revision: 1,
    createdAt: DateTime.utc(2026, 10, 10));
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pumpAndSettle();
  expect(posts.lookups, 1);
  expect(posts.sends, 1);
  expect(statuses, ['processing', 'published']);
  expect(find.text('Talk published.'), findsOneWidget);
  expect(find.byKey(const ValueKey('talk-check-status')), findsNothing);
  expect(store.pending, isNull);
});

testWidgets('checking a still-processing Talk does not duplicate the publish', (tester) async {
  final posts = ReceiptPostsFake();
  await tester.pumpWidget(composer(posts, 'user-a',
    record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 30000)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Story');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  final pending = Completer<AudioPost?>();
  posts.onLookup = () => pending.future;
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pump();
  expect(tester.widget<TextButton>(find.byKey(const ValueKey('talk-check-status'))).onPressed, isNull);
  pending.complete(AudioPost(
    postId: 'post-one', authorId: 'owner', authorKind: 'human',
    title: 'Story', durationMs: 30000, status: 'processing', revision: 0,
    createdAt: DateTime.utc(2026, 10, 10)));
  await tester.pumpAndSettle();
  expect(find.textContaining('Still processing'), findsOneWidget);
  expect(posts.sends, 1);
  expect(posts.lookups, 1);
});

testWidgets('offline, absent or mismatched status never overwrites accepted receipt', (tester) async {
  final posts = ReceiptPostsFake();
  await tester.pumpWidget(composer(posts, 'user-a',
    record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 30000)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Story');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  posts.lookupOffline = true;
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pumpAndSettle();
  expect(find.textContaining('without reposting'), findsOneWidget);
  expect(find.textContaining('Talk received; it is processing'), findsOneWidget);
  posts.lookupOffline = false;
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pumpAndSettle();
  expect(find.textContaining('without reposting'), findsOneWidget);
  posts.serverReceipt = AudioPost(
    postId: 'another-account', authorId: 'owner', authorKind: 'human',
    title: 'Story', durationMs: 30000, status: 'published', revision: 1,
    createdAt: DateTime.utc(2026, 10, 10));
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pumpAndSettle();
  expect(find.textContaining('Talk received; it is processing'), findsOneWidget);
  expect(posts.sends, 1);
  expect(posts.lookups, 3);
});

testWidgets('account switch during status lookup ignores prior-account result', (tester) async {
  final posts = ReceiptPostsFake();
  await tester.pumpWidget(composer(posts, 'user-a',
    record: () async => const VerifiedPostAudio(assetId: 'ready-a', durationMs: 30000)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-record')));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const ValueKey('talk-title')), 'Private A');
  await tester.tap(find.byKey(const ValueKey('talk-publish')));
  await tester.pumpAndSettle();
  final pending = Completer<AudioPost?>();
  posts.onLookup = () => pending.future;
  await tester.tap(find.byKey(const ValueKey('talk-check-status')));
  await tester.pump();
  await tester.pumpWidget(composer(posts, 'user-b'));
  pending.complete(AudioPost(
    postId: 'post-one', authorId: 'owner', authorKind: 'human',
    title: 'Private A', durationMs: 30000, status: 'published', revision: 1,
    createdAt: DateTime.utc(2026, 10, 10)));
  await tester.pumpAndSettle();
  expect(find.text('Private A'), findsNothing);
  expect(find.text('Talk published.'), findsNothing);
  expect(find.byKey(const ValueKey('talk-check-status')), findsNothing);
  expect(posts.sends, 1);
});


}

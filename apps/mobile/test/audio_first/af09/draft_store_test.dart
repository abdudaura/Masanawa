import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:masanawa/src/audio_posts/audio_post_draft_store.dart';

PendingTalkPublish attempt(String account, String request) =>
    PendingTalkPublish(
      accountId: account,
      requestId: request,
      assetId: 'verified-asset',
      durationMs: 45000,
      title: 'Recovered spoken story',
    );

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('two accounts retain independent uncertain attempts after restart', () async {
    final store = SecureTalkPublishAttemptStore();
    await store.write(attempt('account-a', 'request-a'));
    await store.write(attempt('account-b', 'request-b'));
    final reopened = SecureTalkPublishAttemptStore();
    expect((await reopened.read('account-a'))?.requestId, 'request-a');
    expect((await reopened.read('account-b'))?.requestId, 'request-b');
    await reopened.clear('account-b', 'request-b');
    expect(await reopened.read('account-b'), isNull);
    expect((await reopened.read('account-a'))?.requestId, 'request-a');
  });

  test('same request key in different accounts cannot clear another account', () async {
    final store = SecureTalkPublishAttemptStore();
    await store.write(attempt('account-a', 'same-key'));
    await store.write(attempt('account-b', 'same-key'));
    await store.clear('account-a', 'same-key');
    expect(await store.read('account-a'), isNull);
    expect((await store.read('account-b'))?.requestId, 'same-key');
  });

  test('migrates matching legacy attempt without losing another account draft', () async {
    FlutterSecureStorage.setMockInitialValues({
      'masanawa.talks.pending-publish.v1':
          jsonEncode(attempt('account-a', 'legacy-key').toJson()),
    });
    final store = SecureTalkPublishAttemptStore();
    expect(await store.read('account-b'), isNull);
    await store.write(attempt('account-b', 'new-key'));
    expect((await store.read('account-a'))?.requestId, 'legacy-key');
    expect((await store.read('account-b'))?.requestId, 'new-key');
    final reopened = SecureTalkPublishAttemptStore();
    expect((await reopened.read('account-a'))?.requestId, 'legacy-key');
    expect((await reopened.read('account-b'))?.requestId, 'new-key');
  });

  test('other account cannot clear a legacy attempt', () async {
    FlutterSecureStorage.setMockInitialValues({
      'masanawa.talks.pending-publish.v1':
          jsonEncode(attempt('account-a', 'legacy-key').toJson()),
    });
    final store = SecureTalkPublishAttemptStore();
    await store.clear('account-b', 'legacy-key');
    expect((await store.read('account-a'))?.requestId, 'legacy-key');
  });

  test('wrong request ID leaves the original uncertain attempt intact', () async {
    final store = SecureTalkPublishAttemptStore();
    await store.write(attempt('account-a', 'original-key'));
    await store.clear('account-a', 'different-key');
    expect((await store.read('account-a'))?.requestId, 'original-key');
  });

  test('tampered account scope rejects recovery rather than leaking data', () async {
    final scoped = base64Url.encode(utf8.encode('account-a'));
    FlutterSecureStorage.setMockInitialValues({
      'masanawa.talks.pending-publish.v2.$scoped':
          jsonEncode(attempt('account-b', 'bad-key').toJson()),
    });
    final store = SecureTalkPublishAttemptStore();
    await expectLater(store.read('account-a'), throwsFormatException);
    await expectLater(
      store.clear('account-a', 'bad-key'), throwsFormatException);
  });

  test('invalid or corrupt encrypted data fails closed', () async {
    FlutterSecureStorage.setMockInitialValues({
      'masanawa.talks.pending-publish.v1': '{broken json',
    });
    final store = SecureTalkPublishAttemptStore();
    await expectLater(store.read('account-a'), throwsFormatException);
    await expectLater(store.write(attempt('', 'key')), throwsFormatException);
  });
}

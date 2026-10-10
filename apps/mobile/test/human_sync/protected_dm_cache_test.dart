import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_sync/protected_dm_cache.dart';
import 'package:masanawa/src/human_sync/dm_sync_coordinator.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late ProtectedDmCache cache;
  late Database db;

  setUp(() async {
    db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    cache = await ProtectedDmCache.attachForTest(
      database: db, keyBytes: List<int>.generate(32, (i) => i),
      tenantId: 'tenant-a', ownerId: 'owner-a');
  });
  tearDown(() async {
    await cache.close();
  });

  Map<String, dynamic> item(int sequence, {String body = 'Private text'}) => {
    'messageId': 'msg-$sequence',
    'conversationId': 'thread-a',
    'sequence': sequence.toString(),
    'senderUserId': 'owner-a',
    'clientRequestId': 'request123456$sequence',
    'body': body,
    'createdAt': '2026-10-08T10:00:00.000Z',
    'editedAt': null, 'deletedAt': null,
  };

  test('real SQLite pages by server sequence and decrypts only requested rows', () async {
    await cache.putMessages('thread-a', List.generate(100, (i) => item(i + 1)));
    final first = await cache.messages('thread-a');
    expect(first.length, 40);
    expect(first.first['sequence'], '100');
    final older = await cache.messages('thread-a', before: first.last['sequence'] as String);
    expect(older.first['sequence'], '60');
    expect(older.any((m) => m['sequence'] == '100'), isFalse);
  });

  test('ciphertext hides body and contact identifiers from physical database', () async {
    await cache.putMessages('thread-a', [item(1, body: 'PRIVATE-NOT-PLAINTEXT')]);
    await cache.putInbox([{
      'conversationId': 'thread-a',
      'otherUserId': 'sensitive-contact-55',
      'updatedAt': '2026-10-08T10:00:00.000Z',
      'preview': 'PRIVATE-NOT-PLAINTEXT',
    }]);
    final rows = await db.query('dm_messages');
    final inbox = await db.query('dm_inbox');
    expect(rows.single.toString(), isNot(contains('PRIVATE-NOT-PLAINTEXT')));
    expect(inbox.single.toString(), isNot(contains('sensitive-contact-55')));
    expect((await cache.inbox()).single['otherUserId'], 'sensitive-contact-55');
  });

  test('upserts server edit/tombstone without resurrecting message body', () async {
    await cache.putMessages('thread-a', [item(8)]);
    await cache.putMessages('thread-a', [
      {...item(8), 'body': null, 'deletedAt': '2026-10-08T11:00:00Z'}
    ]);
    final got = await cache.messages('thread-a');
    expect(got.length, 1);
    expect(got.single['body'], isNull);
    expect(got.single['deletedAt'], isNotNull);
  });

  test('journal recovers exact request ID and detects idempotency misuse', () async {
    await cache.queue(conversationId: 'thread-a', requestId: 'request_unique_123456',
        text: 'Please retry after restart');
    final pending = await cache.pending();
    expect(pending.single.state, 'queued');
    expect(pending.single.requestId, 'request_unique_123456');
    await cache.queue(conversationId: 'thread-a', requestId: 'request_unique_123456',
        text: 'Please retry after restart');
    expect((await cache.pending()).length, 1);
    await expectLater(cache.queue(conversationId: 'thread-a',
        requestId: 'request_unique_123456', text: 'ANOTHER AMOUNT'),
        throwsStateError);
  });

  test('only correctly attributed server ACK clears pending', () async {
    await cache.queue(conversationId: 'thread-a', requestId: 'request_unique_123456',
        text: 'Hello');
    final wrong = {...item(1), 'clientRequestId': 'request_unique_123456',
        'senderUserId': 'other-user'};
    await expectLater(cache.acknowledge('request_unique_123456', wrong),
        throwsFormatException);
    expect((await cache.pending()).length, 1);
    await cache.acknowledge('request_unique_123456',
        {...wrong, 'senderUserId': 'owner-a'});
    expect(await cache.pending(), isEmpty);
    expect((await cache.messages('thread-a')).length, 1);
  });

  test('tampering and incorrect per-account key cannot reveal a private row', () async {
    await cache.putMessages('thread-a', [item(1)]);
    final encrypted = (await db.query('dm_messages')).single['payload'] as String;
    await db.update('dm_messages', {'payload': encrypted.substring(0, 6) + 'AAAA' +
        encrypted.substring(10)});
    await expectLater(cache.messages('thread-a'), throwsA(isA<Exception>()));
  });

  test('session switch fences cached refresh and outbox send', () async {
    String? owner = 'owner-a';
    final coordinator = DmSyncCoordinator(
        cache: cache, currentOwnerId: () => owner,
        currentTenantId: () => 'tenant-a', transport: _DeferredTransport());
    owner = 'owner-b';
    await expectLater(coordinator.enqueue(conversationId: 'thread-a',
        requestId: 'request_unique_123456', text: 'Not another user'),
        throwsStateError);
    expect(await cache.pending(), isEmpty);
    await coordinator.close();
  });


  test('authoritative revocation erases thread, inbox and all pending drafts', () async {
    await cache.putMessages('thread-a', [item(1)]);
    await cache.putInbox([{
      'conversationId': 'thread-a', 'otherUserId': 'other',
      'updatedAt': '2026-10-08T10:00:00Z',
    }]);
    await cache.queue(conversationId: 'thread-a', requestId: 'request_unique_123456',
        text: 'Draft');
    await cache.revokeConversation('thread-a');
    expect(await cache.messages('thread-a'), isEmpty);
    expect(await cache.inbox(), isEmpty);
    expect(await cache.pending(), isEmpty);
  });

  test('different tenant/user storage never shares the same key namespace', () async {
    final another = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    final other = await ProtectedDmCache.attachForTest(
        database: another, keyBytes: List<int>.generate(32, (i) => i + 10),
        tenantId: 'tenant-b', ownerId: 'owner-b');
    try {
      await cache.putMessages('thread-a', [item(1)]);
      expect(await other.messages('thread-a'), isEmpty);
    } finally {
      await other.close();
    }
  });
}

class _DeferredTransport implements DmSyncTransport {
  @override
  Future<List<Map<String, dynamic>>> inbox() async => throw UnimplementedError();
  @override
  Future<List<Map<String, dynamic>>> history(String id, {String? before}) async =>
      throw UnimplementedError();
  @override
  Future<Map<String, dynamic>> send(String id, String requestId, String body) async =>
      throw UnimplementedError();
}

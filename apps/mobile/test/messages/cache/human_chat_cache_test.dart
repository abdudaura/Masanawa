import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:masanawa/src/messages/cache/human_chat_cache.dart';
import 'package:masanawa/src/messages/cache/human_chat_models.dart';

class _MemorySecrets implements HumanChatSecrets {
  final Map<String, String> values = {};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String secret) async { values[key] = secret; }
  @override
  Future<void> delete(String key) async { values.remove(key); }
}

void main() {
  sqfliteFfiInit();
  late Directory directory;
  late HumanChatCache cache;
  late _MemorySecrets secrets;
  const tenant = 'tenant-1';
  const owner = 'person-a';
  const threadId = '6b9506ec-4a9d-4120-8175-2fe4f07cf197';

  Future<void> saveThread([String peer = 'person-b']) =>
      cache.saveThread(
        tenantId: tenant,
        userId: owner,
        thread: CachedHumanThread(
          conversationId: threadId,
          peerUserId: peer,
          updatedAtMs: 1720000000,
        ),
      );

  CachedHumanMessage message({
    int sequence = 1,
    String id = 'server-msg-1',
    String? requestId,
    bool deleted = false,
  }) =>
      CachedHumanMessage(
        messageId: id,
        conversationId: threadId,
        senderUserId: owner,
        sequence: sequence,
        createdAtMs: 1720000000 + sequence,
        clientRequestId: requestId,
        body: deleted ? null : 'Hello #$sequence',
        deleted: deleted,
      );

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('human_chat_cache_test_');
    secrets = _MemorySecrets();
    cache = HumanChatCache(
      secrets: secrets,
      supportDirectory: () async => directory,
      // FFI runs the SAME SQL tables/indexes and transactions on a real SQLite
      // engine. The production factory (not injected here) uses SQLCipher.
      dbOpener: (path, _) => databaseFactoryFfi.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: 1,
          onConfigure: (db) async => db.execute('PRAGMA foreign_keys = ON'),
          onCreate: createHumanChatCacheSchema,
        ),
      ),
    );
    await cache.openAccount(tenantId: tenant, userId: owner);
  });

  tearDown(() async {
    await cache.close();
    if (await directory.exists()) await directory.delete(recursive: true);
  });

  test('server history persists after restart and paginates descending', () async {
    await saveThread();
    for (var sequence = 1; sequence <= 85; sequence += 1) {
      await cache.applyServerPage(
        tenantId: tenant,
        userId: owner,
        conversationId: threadId,
        messages: [message(sequence: sequence, id: 'msg-$sequence')],
        nextSyncSequence: sequence,
      );
    }
    expect(await cache.syncCursor(tenantId: tenant, userId: owner,
        conversationId: threadId), 85);
    await cache.close();
    await cache.openAccount(tenantId: tenant, userId: owner);
    final recent = await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId, limit: 40,
    );
    expect(recent.length, 40);
    expect(recent.first.sequence, 85);
    final older = await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
      beforeSequence: recent.last.sequence, limit: 40,
    );
    expect(older.length, 40);
    expect(older.first.sequence, 45);
    expect(older.last.sequence, 6);
  });

  test('retry preserves stable request ID and rejects incompatible replay', () async {
    await saveThread();
    await cache.queueText(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: '9dce74ba-5fb2-475c-a87e-b48da39984a0',
      body: 'Hello', createdAtMs: 10,
    );
    await cache.queueText(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: '9dce74ba-5fb2-475c-a87e-b48da39984a0',
      body: 'Hello', createdAtMs: 20,
    );
    final pending = await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 20,
    );
    expect(pending.length, 1);
    expect(pending.single.status, HumanOutboxStatus.pending);
    await expectLater(
      cache.queueText(
        tenantId: tenant, userId: owner, conversationId: threadId,
        requestId: pending.single.requestId, body: 'different',
        createdAtMs: 30,
      ), throwsStateError,
    );
    await cache.markAttempt(
      tenantId: tenant, userId: owner, requestId: pending.single.requestId,
      status: HumanOutboxStatus.unknown, retryAfterMs: 500,
    );
    expect((await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 499,
    )).isEmpty, isTrue);
    expect((await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 500,
    )).single.attempts, 1);
  });

  test('only a matching confirmed receipt removes the durable outbox', () async {
    await saveThread();
    const requestId = 'e1835b36-64b9-4c93-ae0d-14c235a247d5';
    await cache.queueText(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: requestId, body: 'Hello', createdAtMs: 42,
    );
    expect(() => cache.acknowledge(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: requestId, serverMessage: message(requestId: 'wrong-id'),
    ), throwsStateError);
    expect((await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 50,
    )).length, 1);
    await cache.acknowledge(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: requestId, serverMessage: message(requestId: requestId),
    );
    expect((await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 50,
    )).isEmpty, isTrue);
    expect((await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
    )).single.messageId, 'server-msg-1');
  });

  test('duplicate sync and stale cursors are safe, tombstone drops body', () async {
    await saveThread();
    await cache.applyServerPage(
      tenantId: tenant, userId: owner, conversationId: threadId,
      messages: [message()], nextSyncSequence: 10,
    );
    await cache.applyServerPage(
      tenantId: tenant, userId: owner, conversationId: threadId,
      messages: [message(deleted: true)], nextSyncSequence: 5,
    );
    expect(await cache.syncCursor(
      tenantId: tenant, userId: owner, conversationId: threadId,
    ), 10);
    final view = (await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
    )).single;
    expect(view.deleted, isTrue);
    expect(view.body, isNull);
    // An older page may arrive after a deletion event; it must not
    // resurrect the plaintext after an app restart/reconnect.
    await cache.applyServerPage(
      tenantId: tenant, userId: owner, conversationId: threadId,
      messages: [message()], nextSyncSequence: 2,
    );
    final retained = (await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
    )).single;
    expect(retained.deleted, isTrue);
    expect(retained.body, isNull);
    await expectLater(
      cache.applyServerPage(
        tenantId: tenant, userId: owner, conversationId: threadId,
        messages: [message(sequence: 2)], nextSyncSequence: 11,
      ), throwsStateError,
    );
    expect(await cache.syncCursor(
      tenantId: tenant, userId: owner, conversationId: threadId,
    ), 10);
  });

  test('account switch never exposes another account cached content', () async {
    await saveThread();
    await cache.applyServerPage(
      tenantId: tenant, userId: owner, conversationId: threadId,
      messages: [message()], nextSyncSequence: 1,
    );
    await cache.openAccount(tenantId: tenant, userId: 'person-c');
    expect(await cache.recentThreads(
      tenantId: tenant, userId: 'person-c',
    ), isEmpty);
    await expectLater(cache.recentThreads(
      tenantId: tenant, userId: owner,
    ), throwsStateError);
    await cache.openAccount(tenantId: tenant, userId: owner);
    expect((await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
    )).length, 1);
    expect(secrets.values.length, 2);
    expect(secrets.values.values.every((value) => value.length > 32), isTrue);
  });

  test('wrong sequence conflicts roll back full page and cursor', () async {
    await saveThread();
    await cache.applyServerPage(
      tenantId: tenant, userId: owner, conversationId: threadId,
      messages: [message()], nextSyncSequence: 1,
    );
    await expectLater(
      cache.applyServerPage(
        tenantId: tenant, userId: owner, conversationId: threadId,
        messages: [
          message(sequence: 2, id: 'second'),
          message(sequence: 1, id: 'different-id'),
        ],
        nextSyncSequence: 3,
      ), throwsA(isA<Exception>()),
    );
    expect((await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
    )).length, 1);
    expect(await cache.syncCursor(
      tenantId: tenant, userId: owner, conversationId: threadId,
    ), 1);
  });

  test('bounded pruning never deletes unacknowledged offline messages', () async {
    await saveThread();
    for (var i = 1; i <= 75; i++) {
      await cache.applyServerPage(
        tenantId: tenant, userId: owner, conversationId: threadId,
        messages: [message(sequence: i, id: 'msg-$i')],
        nextSyncSequence: i,
      );
    }
    await cache.queueText(
      tenantId: tenant, userId: owner, conversationId: threadId,
      requestId: 'cf865924-b095-49c3-aa5c-ab273ca64775',
      body: 'offline', createdAtMs: 5,
    );
    await cache.pruneConversation(
      tenantId: tenant, userId: owner, conversationId: threadId, retain: 50,
    );
    expect((await cache.history(
      tenantId: tenant, userId: owner, conversationId: threadId,
      limit: 50,
    )).length, 50);
    expect((await cache.pending(
      tenantId: tenant, userId: owner, nowMs: 50,
    )).length, 1);
  });
}

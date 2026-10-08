import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:masanawa/src/messages/cache/human_chat_cache.dart';
import 'package:masanawa/src/messages/cache/human_chat_models.dart';
import 'package:masanawa/src/messages/cache/human_chat_sync.dart';

class _Secrets implements HumanChatSecrets {
  final Map<String, String> keys = {};
  @override
  Future<String?> read(String key) async => keys[key];
  @override
  Future<void> write(String key, String value) async { keys[key] = value; }
  @override
  Future<void> delete(String key) async { keys.remove(key); }
}

class _Remote implements HumanChatRemote {
  final List<String> sentIds = [];
  List<CachedHumanThread> inbox = [];
  HumanChatDelta delta = const HumanChatDelta(
    messages: [], nextSequence: 0, hasMore: false,
  );
  bool timeout = false;
  bool denied = false;
  bool revoked = false;
  Completer<HumanChatDelta>? gate;

  @override
  Future<List<CachedHumanThread>> fetchRecentThreads({int limit = 40}) async =>
      inbox;

  @override
  Future<HumanChatDelta> fetchDelta({
    required String conversationId,
    required int afterSequence,
    int limit = 50,
  }) async {
    if (revoked) throw const HumanChatRejected('ACCESS_REVOKED');
    return gate == null ? delta : gate!.future;
  }

  @override
  Future<CachedHumanMessage> sendText({
    required String conversationId,
    required String requestId,
    required String body,
  }) async {
    sentIds.add(requestId);
    if (timeout) throw TimeoutException('unsure whether sent');
    if (denied) throw const HumanChatRejected('BLOCKED');
    return CachedHumanMessage(
      messageId: 'server-${sentIds.length}',
      conversationId: conversationId,
      senderUserId: 'a',
      sequence: sentIds.length,
      createdAtMs: 20,
      clientRequestId: requestId,
      body: body,
    );
  }
}

void main() {
  sqfliteFfiInit();
  late Directory directory;
  late HumanChatCache cache;
  late HumanChatSync sync;
  late _Remote remote;
  int clock = 1000;
  const thread = '00000000-0000-4000-8000-000000000001';

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('human_dm_sync_');
    cache = HumanChatCache(
      secrets: _Secrets(),
      supportDirectory: () async => directory,
      dbOpener: (path, password) => databaseFactoryFfi.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: createHumanChatCacheSchema,
          onConfigure: (db) async => db.execute('PRAGMA foreign_keys = ON'),
        ),
      ),
    );
    await cache.openAccount(tenantId: 't', userId: 'a');
    remote = _Remote();
    sync = HumanChatSync(
      cache: cache, remote: remote,
      tenantId: 't', userId: 'a', nowMs: () => clock,
    );
    remote.inbox = [
      const CachedHumanThread(
        conversationId: thread, peerUserId: 'b', updatedAtMs: 30,
      ),
    ];
    await sync.refreshThreads();
  });

  tearDown(() async {
    sync.deactivate();
    await cache.close();
    await directory.delete(recursive: true);
  });

  test('uncertain network send keeps one durable ID across retry', () async {
    remote.timeout = true;
    final id = await sync.queueText(thread, 'hello offline');
    await sync.flushPending();
    expect(remote.sentIds, [id]);
    expect((await sync.cachedOutbox(thread)).single.status,
        HumanOutboxStatus.unknown);
    clock += 3000;
    remote.timeout = false;
    await sync.flushPending();
    expect(remote.sentIds, [id, id]);
    expect(await sync.cachedOutbox(thread), isEmpty);
    expect((await sync.cachedHistory(thread)).single.clientRequestId, id);
  });

  test('definitive rejection is visible and never auto-retried', () async {
    remote.denied = true;
    final id = await sync.queueText(thread, 'blocked recipient');
    await sync.flushPending();
    expect((await sync.cachedOutbox(thread)).single.status,
        HumanOutboxStatus.blocked);
    clock += 100000;
    await sync.flushPending();
    expect(remote.sentIds, [id]);
    expect(await sync.cachedHistory(thread), isEmpty);
  });

  test('cursor advances transactionally after authorized delta', () async {
    remote.delta = const HumanChatDelta(
      messages: [
        CachedHumanMessage(
          messageId: 'm1', conversationId: thread, senderUserId: 'b',
          sequence: 1, createdAtMs: 100, body: 'from b',
        ),
      ],
      nextSequence: 1, hasMore: false,
    );
    await sync.catchUp(thread);
    expect((await sync.cachedHistory(thread)).single.body, 'from b');
    expect(await cache.syncCursor(
      tenantId: 't', userId: 'a', conversationId: thread,
    ), 1);
  });

  test('deactivated account cannot apply late response', () async {
    remote.gate = Completer<HumanChatDelta>();
    final pending = sync.catchUp(thread);
    await Future<void>.delayed(const Duration(milliseconds: 2));
    sync.deactivate();
    remote.gate!.complete(const HumanChatDelta(
      messages: [], nextSequence: 100, hasMore: false,
    ));
    await expectLater(pending, throwsStateError);
    expect(await cache.syncCursor(
      tenantId: 't', userId: 'a', conversationId: thread,
    ), 0);
  });

  test('verified revocation wipes only that thread, including queued drafts',
      () async {
    await sync.queueText(thread, 'unsent');
    remote.revoked = true;
    await expectLater(sync.catchUp(thread),
        throwsA(isA<HumanChatRejected>()));
    expect(await sync.cachedHistory(thread), isEmpty);
    expect(await sync.cachedOutbox(thread), isEmpty);
    expect(await sync.cachedThreads(), isEmpty);
  });

  test('request IDs have UUIDv4 syntax and do not repeat', () {
    final ids = {for (var i = 0; i < 1000; i++) HumanChatSync.newRequestId()};
    expect(ids.length, 1000);
    expect(ids.first, matches(RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    )));
  });
}

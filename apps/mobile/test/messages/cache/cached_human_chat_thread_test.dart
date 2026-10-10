import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:masanawa/src/messages/cache/cached_human_chat_thread.dart';
import 'package:masanawa/src/messages/cache/cached_human_chats_list.dart';
import 'package:masanawa/src/messages/cache/human_chat_cache.dart';
import 'package:masanawa/src/messages/cache/human_chat_models.dart';
import 'package:masanawa/src/messages/cache/human_chat_sync.dart';

class _Keys implements HumanChatSecrets {
  final Map<String, String> values = {};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async { values[key] = value; }
  @override
  Future<void> delete(String key) async { values.remove(key); }
}

class _Disconnected implements HumanChatRemote {
  @override
  Future<List<CachedHumanThread>> fetchRecentThreads({int limit = 40}) =>
      Future.error(const SocketException('offline'));
  @override
  Future<HumanChatDelta> fetchDelta({
    required String conversationId,
    required int afterSequence,
    int limit = 50,
  }) => Future.error(const SocketException('offline'));
  @override
  Future<CachedHumanMessage> sendText({
    required String conversationId,
    required String requestId,
    required String body,
  }) => Future.error(const SocketException('uncertain'));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late Directory root;
  late HumanChatCache cache;
  late HumanChatSync sync;
  const thread = 'b00df86a-3421-49c2-9464-29ef9d6d16a2';

  setUp(() async {
    root = await Directory.systemTemp.createTemp('human_dm_widget_');
    cache = HumanChatCache(
      secrets: _Keys(),
      supportDirectory: () async => root,
      dbOpener: (path, _) => databaseFactoryFfi.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: createHumanChatCacheSchema,
          onConfigure: (db) async => db.execute('PRAGMA foreign_keys = ON'),
        ),
      ),
    );
    await cache.openAccount(tenantId: 't', userId: 'owner');
    await cache.saveThread(
      tenantId: 't', userId: 'owner',
      thread: const CachedHumanThread(
        conversationId: thread, peerUserId: 'peer', updatedAtMs: 12,
      ),
    );
    await cache.applyServerPage(
      tenantId: 't', userId: 'owner', conversationId: thread,
      nextSyncSequence: 1,
      messages: const [
        CachedHumanMessage(
          messageId: 'known', conversationId: thread, senderUserId: 'peer',
          sequence: 1, createdAtMs: 12, body: 'Real cached text',
        ),
      ],
    );
    sync = HumanChatSync(
      cache: cache, remote: _Disconnected(),
      tenantId: 't', userId: 'owner',
    );
  });

  tearDown(() async {
    sync.deactivate();
    await cache.close();
    await root.delete(recursive: true);
  });

  testWidgets('cached history paints offline and Send retains honest status',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: CachedHumanChatThread(
        sync: sync, conversationId: thread, title: 'Person B',
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Real cached text'), findsOneWidget);
    expect(find.textContaining('Offline or unable to sync'), findsOneWidget);
    expect(find.byIcon(Icons.mic), findsNothing);
    await tester.enterText(find.byType(TextField), 'My offline message');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(find.text('My offline message'), findsOneWidget);
    expect(find.textContaining('Delivery unknown'), findsOneWidget);
    expect((await sync.cachedOutbox(thread)).single.body,
        'My offline message');
  });

  testWidgets('cached inbox opens only selected real thread and shows unread',
      (tester) async {
    await cache.saveThread(
      tenantId: 't', userId: 'owner',
      thread: const CachedHumanThread(
        conversationId: thread, peerUserId: 'peer',
        displayName: 'Person B', updatedAtMs: 50, unreadCount: 3,
      ),
    );
    String? selectedId;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: CachedHumanChatsList(
          sync: sync,
          onOpenThread: (thread) => selectedId = thread.conversationId,
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Person B'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    await tester.tap(find.text('Person B'));
    expect(selectedId, thread);
  });

  testWidgets('never displays a fake delivered status without server ack',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: CachedHumanChatThread(
        sync: sync, conversationId: thread, title: 'Person B',
      ),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Need to retry');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Pending send'), findsNothing);
    expect(find.textContaining('Delivery unknown'), findsOneWidget);
    expect(find.text('Delivered'), findsNothing);
  });
}

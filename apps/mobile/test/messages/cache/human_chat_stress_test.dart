import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:masanawa/src/messages/cache/human_chat_cache.dart';
import 'package:masanawa/src/messages/cache/human_chat_models.dart';

class _Keys implements HumanChatSecrets {
  final Map<String, String> values = {};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String secret) async { values[key] = secret; }
  @override
  Future<void> delete(String key) async { values.remove(key); }
}

/// Opt-in fixture, not a claimed low-end Android p95 measurement.
/// Execute: flutter test --dart-define=HUMAN_DM_STRESS=true
///   test/messages/cache/human_chat_stress_test.dart
/// The companion physical-device profiling for J10 is still required.
void main() {
  sqfliteFfiInit();
  const stress = bool.fromEnvironment('HUMAN_DM_STRESS');

  test('1000 conversations / 100000 messages use indexed bounded pages',
      () async {
    final root = await Directory.systemTemp.createTemp('dm_stress_');
    final cache = HumanChatCache(
      secrets: _Keys(),
      supportDirectory: () async => root,
      dbOpener: (path, password) => databaseFactoryFfi.openDatabase(
        path,
        options: OpenDatabaseOptions(
          version: 1,
          onCreate: createHumanChatCacheSchema,
          onConfigure: (db) async => db.execute('PRAGMA foreign_keys = ON'),
        ),
      ),
    );
    try {
      await cache.openAccount(tenantId: 't', userId: 'stress-user');
      final total = Stopwatch()..start();
      for (var conversation = 0; conversation < 1000; conversation++) {
        final threadId = 'thread-$conversation';
        await cache.saveThread(
          tenantId: 't',
          userId: 'stress-user',
          thread: CachedHumanThread(
            conversationId: threadId,
            peerUserId: 'peer-$conversation',
            updatedAtMs: 100000 + conversation,
            lastSequence: 100,
          ),
        );
        await cache.applyServerPage(
          tenantId: 't',
          userId: 'stress-user',
          conversationId: threadId,
          nextSyncSequence: 100,
          messages: [
            for (var i = 1; i <= 100; i++)
              CachedHumanMessage(
                messageId: 'm-$conversation-$i',
                conversationId: threadId,
                senderUserId: 'peer-$conversation',
                sequence: i,
                createdAtMs: i,
                body: 'Hello $i',
              ),
          ],
        );
      }
      total.stop();
      final timing = Stopwatch()..start();
      final recent = await cache.recentThreads(
        tenantId: 't', userId: 'stress-user',
      );
      final messages = await cache.history(
        tenantId: 't', userId: 'stress-user', conversationId: 'thread-500',
      );
      timing.stop();
      expect(recent.length, 40);
      expect(messages.length, 40);
      expect(messages.first.sequence, 100);
      expect(messages.last.sequence, 61);
      // Intentionally report observed values, not guessed or guaranteed p95.
      // ignore: avoid_print
      print('C05 FFI fixture: insert 100k=${total.elapsedMilliseconds}ms; '
          'indexed 40+40 read=${timing.elapsedMicroseconds}us; '
          'device UI/network p95 NOT measured');
    } finally {
      await cache.close();
      await root.delete(recursive: true);
    }
  }, skip: !stress);
}

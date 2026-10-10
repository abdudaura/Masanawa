import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_sync/protected_dm_cache.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Run explicitly with:
/// flutter test --dart-define=C05_BENCHMARK=true test/human_sync/cache_benchmark_test.dart
/// A development host result is NOT the required named Android p95 evidence.
const _enabled = bool.fromEnvironment('C05_BENCHMARK', defaultValue: false);
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  test('1,000 thread / 100,000 message fixture with indexed retrieval', () async {
    final db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    final cache = await ProtectedDmCache.attachForTest(database: db,
      tenantId: 'benchmark', ownerId: 'benchmark-account',
      keyBytes: List<int>.generate(32, (i) => (i * 7) % 256));
    try {
      final threads = List.generate(1000, (i) => {
        'conversationId': 'thread-$i',
        'otherUserId': 'person-$i',
        'otherDisplayName': 'Person $i',
        'lastSequence': '100',
        'unreadCount': 0,
        'preview': 'A sample',
        'updatedAt': DateTime.utc(2026, 10, 8, 10)
            .add(Duration(milliseconds: i)).toIso8601String(),
      });
      for (var i = 0; i < threads.length; i += 40) {
        await cache.putInbox(threads.skip(i).take(40).toList());
      }
      for (var t = 0; t < 1000; t++) {
        final id = 'thread-$t';
        await cache.putMessages(id, List.generate(100, (j) => {
          'messageId': 'm-$t-$j', 'conversationId': id,
          'sequence': (j + 1).toString(),
          'senderUserId': 'benchmark-account',
          'clientRequestId': 'req-$t-$j-0123456789',
          'body': 'History message $j',
          'createdAt': '2026-10-08T10:00:00Z',
          'editedAt': null, 'deletedAt': null,
        }));
      }
      final warmInbox = Stopwatch()..start();
      final visible = await cache.inbox();
      warmInbox.stop();
      final warmThread = Stopwatch()..start();
      final latest = await cache.messages('thread-500');
      warmThread.stop();
      expect(visible.length, 40);
      expect(latest.length, 40);
      // Regressions logged by the runner; thresholds are measured on real phones.
      // ignore: avoid_print
      print('C05 host warm inbox ms: ' + warmInbox.elapsedMilliseconds.toString());
      // ignore: avoid_print
      print('C05 host warm thread ms: ' + warmThread.elapsedMilliseconds.toString());
    } finally {
      await cache.close();
    }
  }, skip: !_enabled);
}

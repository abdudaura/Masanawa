import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_sync/protected_dm_cache.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Actual encrypted SQLite file, not an in-memory substitute for crash state.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();

  test('closed process cache reopened with same key preserves pending request', () async {
    final directory = await Directory.systemTemp.createTemp('masanawa-c05-');
    final file = directory.path + '/history.sqlite';
    final key = List<int>.generate(32, (i) => (i * 3) % 256);
    try {
      final firstDb = await databaseFactoryFfi.openDatabase(file);
      final first = await ProtectedDmCache.attachForTest(
          database: firstDb, keyBytes: key, tenantId: 't', ownerId: 'u');
      await first.queue(conversationId: 'conversation',
          requestId: 'request_stable_0123456789', text: 'Offline restart');
      await first.close();

      final secondDb = await databaseFactoryFfi.openDatabase(file);
      final second = await ProtectedDmCache.attachForTest(
          database: secondDb, keyBytes: key, tenantId: 't', ownerId: 'u');
      expect((await second.pending()).single.text, 'Offline restart');
      expect((await second.pending()).single.requestId, 'request_stable_0123456789');
      await second.close();

      final wrongDb = await databaseFactoryFfi.openDatabase(file);
      final wrong = await ProtectedDmCache.attachForTest(
          database: wrongDb,
          keyBytes: List<int>.generate(32, (i) => (i * 5 + 1) % 256),
          tenantId: 't', ownerId: 'u');
      await expectLater(wrong.pending(), throwsA(isA<Exception>()));
      await wrong.close();
    } finally {
      await directory.delete(recursive: true);
    }
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_sync/cached_dm_thread_controller.dart';
import 'package:masanawa/src/human_sync/dm_sync_coordinator.dart';
import 'package:masanawa/src/human_sync/human_dm_offline_state_view.dart';
import 'package:masanawa/src/human_sync/protected_dm_cache.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();

  testWidgets('offline text is visibly queued, not a delivered bubble',
      (tester) async {
    final database = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    final cache = await ProtectedDmCache.attachForTest(
      database: database, keyBytes: List<int>.filled(32, 27),
      tenantId: 'tenant-a', ownerId: 'user-a');
    final sync = DmSyncCoordinator(cache: cache, transport: _NoNetwork(),
      currentOwnerId: () => 'user-a',
      currentTenantId: () => 'tenant-a');
    final controller = CachedDmThreadController(
      conversationId: 'thread-a', sync: sync);
    try {
      await cache.queue(conversationId: 'thread-a',
          requestId: 'request_unique_123456', text: 'Waiting for network');
      await controller.restore();
      await tester.pumpWidget(MaterialApp(home: Scaffold(
          body: HumanDmOfflineStateView(controller: controller))));
      expect(find.text('Waiting for network'), findsOneWidget);
      expect(find.text('Queued — not yet sent'), findsOneWidget);
      expect(controller.messages, isEmpty);
      expect(find.byTooltip('Retry with original request ID'), findsOneWidget);
    } finally {
      controller.dispose();
      await sync.close();
    }
  });
}

class _NoNetwork extends DmSyncTransport {
  @override
  Future<List<Map<String, dynamic>>> inbox() async => throw StateError('offline');
  @override
  Future<List<Map<String, dynamic>>> history(String conversationId,
      {String? before}) async => throw StateError('offline');
  @override
  Future<Map<String, dynamic>> send(
      String conversationId, String requestId, String body) async =>
      throw StateError('offline');
}

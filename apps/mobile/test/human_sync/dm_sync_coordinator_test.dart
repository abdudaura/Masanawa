import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_sync/dm_sync_coordinator.dart';
import 'package:masanawa/src/human_sync/cached_dm_thread_controller.dart';
import 'package:masanawa/src/human_sync/protected_dm_cache.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late ProtectedDmCache cache;
  late _Server server;
  late DmSyncCoordinator coordinator;

  setUp(() async {
    final db = await databaseFactoryFfi.openDatabase(inMemoryDatabasePath);
    cache = await ProtectedDmCache.attachForTest(
      database: db, keyBytes: List<int>.filled(32, 61),
      tenantId: 'tenant-a', ownerId: 'user-a');
    server = _Server();
    coordinator = DmSyncCoordinator(
        cache: cache, transport: server, currentOwnerId: () => 'user-a',
        currentTenantId: () => 'tenant-a');
  });
  tearDown(() => coordinator.close());

  test('timeout leaves original request for same-ID retry, never delivered', () async {
    await coordinator.enqueue(conversationId: 'thread-a',
        requestId: 'request_unique_123456', text: 'Hello B');
    server.loseResponse = true;
    var result = await coordinator.sendOnce((await cache.pending()).single);
    expect(result, DmSendOutcome.uncertain);
    expect((await cache.pending()).single.state, 'uncertain');
    expect(await cache.messages('thread-a'), isEmpty);
    server.loseResponse = false;
    result = await coordinator.sendOnce((await cache.pending()).single);
    expect(result, DmSendOutcome.confirmed);
    expect(server.ids, ['request_unique_123456', 'request_unique_123456']);
    expect(await cache.pending(), isEmpty);
    expect((await cache.messages('thread-a')).single['body'], 'Hello B');
  });

  test('server revocation erases cached and in-memory conversation', () async {
    await cache.putMessages('thread-a', [{
      'messageId': 'one', 'conversationId': 'thread-a', 'sequence': '1',
      'senderUserId': 'user-a', 'clientRequestId': 'request_unique_123456',
      'body': 'Must not survive blocked status',
      'createdAt': '2026-10-08T12:00:00Z',
    }]);
    final controller = CachedDmThreadController(
        conversationId: 'thread-a', sync: coordinator);
    await controller.restore();
    expect(controller.messages, hasLength(1));
    server.rejectHistory = true;
    await controller.refresh();
    expect(controller.messages, isEmpty);
    expect(await cache.messages('thread-a'), isEmpty);
    controller.dispose();
  });

  test('same user across a different tenant is never accepted as same session', () async {
    final switched = DmSyncCoordinator(
      cache: cache, transport: server, currentOwnerId: () => 'user-a',
      currentTenantId: () => 'other-tenant');
    await expectLater(switched.enqueue(conversationId: 'thread-a',
        requestId: 'request_unique_123456', text: 'Wrong tenant'),
        throwsStateError);
    expect(server.ids, isEmpty);
  });

  test('403 means rejected, does not claim delivered or retry automatically', () async {
    await coordinator.enqueue(conversationId: 'thread-a',
        requestId: 'request_unique_123456', text: 'Blocked');
    server.reject = true;
    final outcome = await coordinator.sendOnce((await cache.pending()).single);
    expect(outcome, DmSendOutcome.rejected);
    expect((await cache.pending()).single.state, 'rejected');
    expect(await coordinator.retryPending(), isEmpty);
    expect(await cache.messages('thread-a'), isEmpty);
  });
}

class _Server extends DmSyncTransport {
  bool loseResponse = false;
  bool reject = false;
  bool rejectHistory = false;
  final List<String> ids = [];
  @override
  Future<List<Map<String, dynamic>>> inbox() async => [];
  @override
  Future<List<Map<String, dynamic>>> history(String id, {String? before}) async {
    if (rejectHistory) {
      throw DioException(
        requestOptions: RequestOptions(path: '/messages'),
        response: Response(requestOptions: RequestOptions(path: '/messages'),
            statusCode: 403),
        type: DioExceptionType.badResponse);
    }
    return [];
  }
  @override
  Future<Map<String, dynamic>> send(String conversationId,
      String requestId, String body) async {
    ids.add(requestId);
    if (loseResponse || reject) {
      throw DioException(
        requestOptions: RequestOptions(path: '/messages'),
        response: reject
            ? Response(requestOptions: RequestOptions(path: '/messages'), statusCode: 403)
            : null,
        type: loseResponse ? DioExceptionType.connectionTimeout : DioExceptionType.badResponse,
      );
    }
    return {
      'messageId': 'server-message-1', 'conversationId': conversationId,
      'sequence': '1', 'senderUserId': 'user-a',
      'clientRequestId': requestId, 'body': body,
      'createdAt': '2026-10-08T12:00:00Z', 'editedAt': null, 'deletedAt': null,
    };
  }
}

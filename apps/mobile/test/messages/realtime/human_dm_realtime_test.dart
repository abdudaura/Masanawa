import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/realtime/human_dm_realtime_sync.dart';
import 'package:masanawa/src/messages/realtime/human_dm_realtime_transport.dart';

class _Store implements HumanDmRealtimeCursorStore {
  String? cursor;
  int saves = 0;

  @override
  Future<String?> load({required String tenantId, required String userId}) async {
    expect(tenantId, 'tenant_a');
    expect(userId, 'user_a');
    return cursor;
  }

  @override
  Future<void> save({
    required String tenantId, required String userId, required String cursor,
  }) async {
    expect(tenantId, 'tenant_a');
    expect(userId, 'user_a');
    this.cursor = cursor;
    saves++;
  }
}

class _Projection implements HumanDmRealtimeProjection {
  int full = 0;
  bool fail = false;
  bool failFull = false;
  final changed = <String>[];
  final invalidated = <String>[];
  final receipts = <String>[];

  @override
  Future<void> refreshAll() async {
    if (failFull) throw StateError('C02 full resnapshot unavailable');
    full++;
  }

  @override
  Future<void> refreshConversation(String id) async {
    if (fail) throw StateError('C02 not ready');
    changed.add(id);
  }

  @override
  Future<void> invalidateConversation(String id) async {
    invalidated.add(id);
  }

  @override
  Future<void> applyReadReceipt({
    required String conversationId,
    required String readerUserId,
    required String throughSequence,
  }) async {
    receipts.add(conversationId + ':' + readerUserId + ':' + throughSequence);
  }
}

class _Transport implements HumanDmRealtimeTransport {
  final responses = <HumanDmRealtimePage>[];
  Completer<HumanDmRealtimePage>? waiting;
  String? receivedCursor;
  int calls = 0;

  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor, int limit = 50, int waitMs = 10000,
    CancelToken? cancelToken,
  }) async {
    calls++;
    receivedCursor = cursor;
    if (waiting != null) return waiting!.future;
    if (responses.isEmpty) throw StateError('No test response');
    return responses.removeAt(0);
  }
}


class _RevokedTransport implements HumanDmRealtimeTransport {
  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor, int limit = 50, int waitMs = 10000,
    CancelToken? cancelToken,
  }) async {
    throw const ApiException('Session revoked', statusCode:401);
  }
}

HumanDmRealtimePage _page({
  String cursor = '1',
  bool hasMore = false,
  bool reset = false,
  List<HumanDmRealtimeEvent> events = const [],
}) => HumanDmRealtimePage(
  events: events,
  nextCursor: cursor,
  hasMore: hasMore,
  resetRequired: reset,
);

const _added = HumanDmRealtimeEvent(
  eventId: '1',
  conversationId: 'thread_a',
  kind: HumanDmChange.messageAdded,
  actorUserId: 'user_b',
  messageId: 'message_a',
  messageSequence: '14',
);
const _revoked = HumanDmRealtimeEvent(
  eventId: '2',
  conversationId: 'thread_a',
  kind: HumanDmChange.accessChanged,
  actorUserId: 'user_b',
);

HumanDmRealtimeSync _sync(
  _Store store, _Projection projection, _Transport transport, {
  bool Function()? session,
}) => HumanDmRealtimeSync(
  tenantId: 'tenant_a',
  userId: 'user_a',
  transport: transport,
  store: store,
  projection: projection,
  isCurrentSession: session ?? () => true,
);

void main() {
  test('validates ordered event metadata and refuses unknown types', () {
    final valid = HumanDmRealtimePage.fromJson({
      'events': [{
        'eventId': '1',
        'conversationId': 'thread_a',
        'kind': 'message_added',
        'actorUserId': 'user_b',
        'messageId': 'message_a',
        'messageSequence': '14',
      }],
      'nextCursor': '1',
      'hasMore': false,
      'resetRequired': false,
    });
    expect(valid.events.single.kind, HumanDmChange.messageAdded);
    expect(
      () => HumanDmRealtimePage.fromJson({
        'events': [{
          'eventId': '1',
          'conversationId': 'thread_a',
          'kind': 'unknown',
          'actorUserId': 'user_b',
          'messageId': null,
          'messageSequence': null,
        }],
        'nextCursor': '1',
        'hasMore': false,
        'resetRequired': false,
      }),
      throwsFormatException,
    );
    expect(
      () => HumanDmRealtimePage.fromJson({
        'events': [],
        'nextCursor': '01',
        'hasMore': false,
        'resetRequired': false,
      }),
      throwsFormatException,
    );
  });

  test('initial C02 bootstrap is required once before durable checkpoint', () async {
    final store = _Store();
    final projection = _Projection();
    final transport = _Transport()..responses.add(
      _page(events: [_added], cursor: '1', reset: true),
    );
    final sync = _sync(store, projection, transport);
    await sync.syncOnce();
    expect(projection.full, 1);
    expect(projection.changed, ['thread_a']);
    expect(store.cursor, '1');
    expect(store.saves, 1);
    expect(transport.receivedCursor, isNull);

    transport.responses.add(_page(cursor: '1'));
    await sync.syncOnce();
    expect(transport.receivedCursor, '1');
    expect(projection.full, 1);
    sync.stop();
  });

  test('server-issued read cursor reconciles a peer read receipt', () async {
    final store = _Store()..cursor = '1';
    final projection = _Projection();
    final transport = _Transport()..responses.add(_page(
      events: [
        const HumanDmRealtimeEvent(
          eventId: '2',
          conversationId: 'thread_a',
          kind: HumanDmChange.readChanged,
          actorUserId: 'user_b',
          messageSequence: '14',
        ),
      ],
      cursor: '2',
    ));
    final sync = _sync(store, projection, transport);
    await sync.syncOnce();
    expect(projection.receipts, ['thread_a:user_b:14']);
    expect(store.cursor, '2');
    sync.stop();
  });

  test('access invalidation overrides an earlier message change', () async {
    final store = _Store()..cursor = '0';
    final projection = _Projection();
    final transport = _Transport()..responses.add(
      _page(events: [_added, _revoked], cursor: '2'),
    );
    final sync = _sync(store, projection, transport);
    await sync.syncOnce();
    expect(projection.changed, isEmpty);
    expect(projection.invalidated, ['thread_a']);
    expect(store.cursor, '2');
    sync.stop();
  });

  test('rejected C02 projection cannot acknowledge the journal', () async {
    final store = _Store()..cursor = '0';
    final projection = _Projection()..fail = true;
    final transport = _Transport()..responses.add(
      _page(events: [_added], cursor: '1'),
    );
    final sync = _sync(store, projection, transport);
    await expectLater(sync.syncOnce(), throwsStateError);
    expect(store.cursor, '0');
    expect(store.saves, 0);
    sync.stop();
  });

  test('late A response is discarded after account switch to B', () async {
    final store = _Store()..cursor = '0';
    final projection = _Projection();
    final transport = _Transport();
    transport.waiting = Completer<HumanDmRealtimePage>();
    var owner = 'user_a';
    final sync = _sync(
      store, projection, transport,
      session: () => owner == 'user_a',
    );
    final pending = sync.syncOnce();
    await Future<void>.delayed(Duration.zero);
    owner = 'user_b';
    transport.waiting!.complete(_page(events: [_added], cursor: '1'));
    await expectLater(pending, throwsStateError);
    expect(store.cursor, '0');
    expect(projection.changed, isEmpty);
    sync.stop();
  });

  test('sign-out cancels pending poll and leaves cursor untouched', () async {
    final store = _Store()..cursor = '0';
    final transport = _Transport();
    transport.waiting = Completer<HumanDmRealtimePage>();
    final sync = _sync(store, _Projection(), transport);
    final pending = sync.syncOnce(waitMs: 12000);
    await Future<void>.delayed(Duration.zero);
    sync.stop();
    transport.waiting!.complete(_page(events: [_added], cursor: '1'));
    await expectLater(pending, throwsStateError);
    expect(store.cursor, '0');
  });

  test('restart resumes protected C05 cursor without new inbox bootstrap', () async {
    final store = _Store()..cursor = '123';
    final projection = _Projection();
    final transport = _Transport()..responses.add(_page(cursor: '123'));
    final sync = _sync(store, projection, transport);
    await sync.syncOnce();
    expect(projection.full, 0);
    expect(transport.receivedCursor, '123');
    sync.stop();
  });

  test('server rollback of cursor cannot enter durable state', () async {
    final store = _Store()..cursor = '9';
    final transport = _Transport()..responses.add(_page(cursor: '8'));
    final sync = _sync(store, _Projection(), transport);
    await expectLater(sync.syncOnce(), throwsFormatException);
    expect(store.cursor, '9');
    sync.stop();
  });

  test('expired journal cursor forces a real C02 resnapshot before ACK', () async {
    final store = _Store()..cursor = '12';
    final projection = _Projection()..failFull = true;
    final transport = _Transport()
      ..responses.add(_page(cursor:'30', reset:true));
    final sync = _sync(store, projection, transport);
    await expectLater(sync.syncOnce(), throwsStateError);
    expect(store.cursor, '12');
    expect(store.saves, 0);
    sync.stop();

    final retryTransport = _Transport()
      ..responses.add(_page(cursor:'30', reset:true));
    projection.failFull = false;
    final recovery = _sync(store, projection, retryTransport);
    await recovery.syncOnce();
    expect(projection.full, 1);
    expect(store.cursor, '30');
    expect(store.saves, 1);
    recovery.stop();
  });

  test('revoked bearer permanently stops realtime retries', () async {
    final statuses = <HumanDmRealtimeStatus>[];
    final sync = HumanDmRealtimeSync(
      tenantId: 'tenant_a', userId: 'user_a',
      transport: _RevokedTransport(),
      store: _Store()..cursor = '1',
      projection: _Projection(),
      isCurrentSession: () => true,
      onStatus: statuses.add,
      sleep: (_) => throw StateError('Auth errors must not retry'),
    );
    await sync.runWhileForeground();
    expect(sync.active, isFalse);
    expect(statuses, [
      HumanDmRealtimeStatus.connecting,
      HumanDmRealtimeStatus.authenticationRequired,
    ]);
  });

  test('two foreground entry points share one poll and one lifecycle', () async {
    final store = _Store()..cursor = '7';
    final transport = _Transport()
      ..waiting = Completer<HumanDmRealtimePage>();
    final statuses = <HumanDmRealtimeStatus>[];
    final sync = HumanDmRealtimeSync(
      tenantId: 'tenant_a', userId: 'user_a',
      transport: transport, store: store, projection: _Projection(),
      isCurrentSession: () => true,
      onStatus: statuses.add,
    );

    final first = sync.runWhileForeground();
    final second = sync.runWhileForeground();
    expect(identical(first, second), isTrue);
    await Future<void>.delayed(Duration.zero);
    expect(statuses, [HumanDmRealtimeStatus.connecting]);
    expect(transport.calls, 1);
    sync.stop();
    transport.waiting!.complete(_page(cursor:'7'));
    await Future.wait([first, second]);
    expect(store.saves, 0);
    expect(statuses, [
      HumanDmRealtimeStatus.connecting, HumanDmRealtimeStatus.stopped,
    ]);
  });

  test('foreground entry canceled before microtask never opens a poll', () async {
    final store = _Store()..cursor = '7';
    final transport = _Transport();
    final statuses = <HumanDmRealtimeStatus>[];
    final sync = HumanDmRealtimeSync(
      tenantId: 'tenant_a', userId: 'user_a',
      transport: transport, store: store, projection: _Projection(),
      isCurrentSession: () => true,
      onStatus: statuses.add,
    );

    final pending = sync.runWhileForeground();
    sync.stop();
    await pending;
    expect(transport.calls, 0);
    expect(store.saves, 0);
    expect(statuses, [HumanDmRealtimeStatus.stopped]);
  });

  test('reentrant connecting callback reuses active foreground loop', () async {
    final store = _Store()..cursor = '9';
    final transport = _Transport()
      ..waiting = Completer<HumanDmRealtimePage>();
    final statuses = <HumanDmRealtimeStatus>[];
    late final HumanDmRealtimeSync sync;
    Future<void>? reentered;
    sync = HumanDmRealtimeSync(
      tenantId: 'tenant_a', userId: 'user_a',
      transport: transport, store: store, projection: _Projection(),
      isCurrentSession: () => true,
      onStatus: (status) {
        statuses.add(status);
        if (status == HumanDmRealtimeStatus.connecting) {
          reentered = sync.runWhileForeground();
        }
      },
    );
    final first = sync.runWhileForeground();
    await Future<void>.delayed(Duration.zero);
    expect(identical(first, reentered), isTrue);
    expect(transport.calls, 1);
    sync.stop();
    transport.waiting!.complete(_page(cursor:'9'));
    await first;
    expect(statuses, [
      HumanDmRealtimeStatus.connecting, HumanDmRealtimeStatus.stopped,
    ]);
  });

}

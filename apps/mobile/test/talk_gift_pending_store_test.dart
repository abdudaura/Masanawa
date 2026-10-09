import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_gift_http_transport.dart';
import 'package:masanawa/src/talks/talk_gift_pending_store.dart';

class _Store implements TalkGiftPendingStore {
  final Map<String, String> records = {};
  bool failWrite = false;

  String key(String userId, String task) => '$userId|$task';

  @override
  Future<String?> read({
    required String userId,
    required String fingerprint,
  }) async => records[key(userId, fingerprint)];

  @override
  Future<void> write({
    required String userId,
    required String fingerprint,
    required String record,
  }) async {
    if (failWrite) throw StateError('encrypted storage unavailable');
    records[key(userId, fingerprint)] = record;
  }
}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _completed({String id = 'heart'}) => ResponseBody.fromString(
  '{"giftId":"gift-1","talkId":"talk-1","recipientUserId":"host-1",'
  '"recipientName":"Amina","amountCredits":100,'
  '"catalogItemId":"$id","status":"completed",'
  '"completedAt":"2026-10-08T06:00:00Z"}',
  200,
  headers: {Headers.contentTypeHeader: ['application/json']},
);

GatewayTalkGiftTransport _transport({
  required _Store store,
  required Future<ResponseBody> Function(RequestOptions) handler,
  String owner = 'owner-1',
  String? Function()? activeUserId,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = _Adapter(handler);
  return GatewayTalkGiftTransport(
    api: ApiClient(dio: dio),
    pendingStore: store,
    pendingOwnerId: owner,
    activeUserId: activeUserId ?? () => owner,
    now: () => DateTime.utc(2026, 10, 8, 6),
  );
}

Future<void> _send(GatewayTalkGiftTransport transport) async {
  await transport.sendGift(
    talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart',
  );
}

void main() {
  test('restart after lost receipt resends the original ID and never creates a fresh debit', () async {
    final store = _Store();
    final requestIds = <String>[];
    var attempt = 0;
    Future<ResponseBody> server(RequestOptions opts) async {
      requestIds.add((opts.data as Map)['requestId'] as String);
      attempt++;
      if (attempt == 1) {
        throw DioException(
          requestOptions: opts,
          type: DioExceptionType.connectionError,
          error: 'lost response after provider credit transfer',
        );
      }
      return _completed();
    }

    final original = _transport(store: store, handler: server);
    await expectLater(_send(original), throwsA(isA<DioException>()));
    expect(store.records.values.single, startsWith('pending:talk-gift-'));

    final restarted = _transport(store: store, handler: server);
    await _send(restarted);
    expect(requestIds, hasLength(2));
    expect(requestIds[1], requestIds[0]);
    expect(store.records.values.single, startsWith('completed:talk-gift-'));

    // Another deliberate gift with identical price/name is a new operation.
    await _send(restarted);
    expect(requestIds, hasLength(3));
    expect(requestIds[2], isNot(requestIds[0]));
  });

  test('concurrent confirmations of the same option share a single network request', () async {
    final store = _Store();
    final awaiting = Completer<ResponseBody>();
    final started = Completer<void>();
    var calls = 0;
    final transport = _transport(store: store, handler: (opts) {
      calls++;
      if (!started.isCompleted) started.complete();
      return awaiting.future;
    });
    final first = transport.sendGift(
      talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart',
    );
    final second = transport.sendGift(
      talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart',
    );
    // Wait for the actual request boundary, never for scheduler timing.
    await started.future;
    expect(calls, 1);
    awaiting.complete(_completed());
    final both = await Future.wait([first, second]);
    expect(both[0].giftId, both[1].giftId);
    expect(calls, 1);
  });

  test('secure persistence failure refuses the POST instead of minting a second ID', () async {
    final store = _Store()..failWrite = true;
    var calls = 0;
    final transport = _transport(store: store, handler: (_) async {
      calls++;
      return _completed();
    });
    await expectLater(_send(transport), throwsStateError);
    expect(calls, 0);
  });

  test('switching accounts between confirmation and transport refuses POST', () async {
    final store = _Store();
    var user = 'owner-1';
    var calls = 0;
    final transport = _transport(
      store: store,
      activeUserId: () => user,
      handler: (_) async {
        calls++;
        return _completed();
      },
    );
    user = 'owner-2';
    await expectLater(_send(transport), throwsStateError);
    expect(calls, 0);
    expect(store.records, isEmpty);
  });

  test('malformed persisted request state stops execution without charging', () async {
    final store = _Store();
    store.records['owner-1|talk-1:heart:100'] = 'completed:arbitrary';
    var calls = 0;
    final transport = _transport(store: store, handler: (_) async {
      calls++;
      return _completed();
    });
    await expectLater(_send(transport), throwsFormatException);
    expect(calls, 0);
  });

  test('a forged request marker cannot trigger a new charge', () async {
    final store = _Store();
    store.records['owner-1|talk-1:heart:100'] =
        'pending:talk-gift-100-1-2-3-forged';
    var posts = 0;
    final transport = _transport(store: store, handler: (_) async {
      posts++;
      return _completed();
    });
    await expectLater(_send(transport), throwsFormatException);
    expect(posts, 0);
  });

  test('account switch after HTTP acknowledgment retains original pending ID', () async {
    final store = _Store();
    final pendingResponse = Completer<ResponseBody>();
    final called = Completer<void>();
    var currentUser = 'owner-1';
    final original = _transport(
      store: store,
      activeUserId: () => currentUser,
      handler: (_) {
        called.complete();
        return pendingResponse.future;
      },
    );
    final send = _send(original);
    await called.future;
    currentUser = 'owner-2';
    pendingResponse.complete(_completed());
    await expectLater(send, throwsStateError);
    expect(store.records.values.single, startsWith('pending:talk-gift-'));

    currentUser = 'owner-1';
    var retries = 0;
    final recovered = _transport(
      store: store,
      activeUserId: () => currentUser,
      handler: (_) async {
        retries++;
        return _completed();
      },
    );
    await _send(recovered);
    expect(retries, 1);
    expect(store.records.values.single, startsWith('completed:talk-gift-'));
  });

  test('two signed-in accounts never reuse the same durable task record', () async {
    final store = _Store();
    final one = _transport(
      store: store, owner: 'first', handler: (_) async => _completed(),
    );
    final two = _transport(
      store: store, owner: 'second', handler: (_) async => _completed(),
    );
    await _send(one);
    await _send(two);
    expect(store.records, hasLength(2));
    expect(store.records.keys.any((key) => key.startsWith('first|')), isTrue);
    expect(store.records.keys.any((key) => key.startsWith('second|')), isTrue);
  });
}

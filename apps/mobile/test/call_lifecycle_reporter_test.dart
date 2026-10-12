import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:masanawa/src/agents/masanawa_transport.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/call_lifecycle_reporter.dart';
import 'package:masanawa/src/calls/call_lifecycle_limits.dart';

class MemoryStore implements CallLifecycleStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    this.value = value;
  }
}

class FailingStore extends MemoryStore {
  bool fail = true;
  @override
  Future<void> write(String value) async {
    if (fail) throw StateError('storage unavailable');
    await super.write(value);
  }
}

class GrantAdapter implements HttpClientAdapter {
  GrantAdapter(this.callId);
  final Object? callId;
  final started = Completer<RequestOptions>();
  final released = Completer<void>();
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    started.complete(options);
    await released.future;
    return ResponseBody.fromString(
      jsonEncode({
        'token': 'provider-token',
        'websocketUrl': 'wss://example.test',
        'model': 'model',
        'voiceName': 'voice',
        'expiresAt': '2026-10-11T12:00:00Z',
        'callId': callId,
      }),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test(
    'paid native audio stops at the earlier accepted quote or admission expiry',
    () {
      final now = DateTime.utc(2026, 10, 12);
      Duration cap(int seconds, int expirySeconds) => paidNativeCallMaxDuration(
        estimatedSeconds: seconds,
        now: now,
        admissionExpiresAt: now.add(Duration(seconds: expirySeconds)),
      );
      expect(cap(300, 600), const Duration(seconds: 300));
      expect(cap(300, 45), const Duration(seconds: 45));
      expect(cap(300, -1), Duration.zero);
    },
  );
  const a = CallLifecycleOwner('a', 'secret-a');
  const b = CallLifecycleOwner('b', 'secret-b');

  test(
    'terminal missing call drops its ordered events and continues healthy calls',
    () async {
      final store = MemoryStore();
      CallLifecycleOwner? current;
      final sent = <String>[];
      final reporter = CallLifecycleReporter(
        store: store,
        readOwner: () => current,
        send: (_, id, event) async {
          sent.add('$id/$event');
          if (id == 'missing') {
            final options = RequestOptions(path: '/missing');
            throw DioException(
              requestOptions: options,
              response: Response(requestOptions: options, statusCode: 404),
            );
          }
        },
      );
      final missing = reporter.bind(a, 'missing');
      await missing.connected();
      await missing.closed();
      await reporter.bind(a, 'healthy').closed();
      current = a;
      await reporter.flush();
      expect(sent, ['missing/connected', 'healthy/end']);
      expect(jsonDecode(store.value!), isEmpty);
    },
  );
  test(
    'transient unauthorized keeps ordering until owner token recovers',
    () async {
      final store = MemoryStore();
      var denied = true;
      final sent = <String>[];
      final reporter = CallLifecycleReporter(
        store: store,
        readOwner: () => a,
        send: (_, id, event) async {
          if (denied) {
            final options = RequestOptions(path: '/call');
            throw DioException(
              requestOptions: options,
              response: Response(requestOptions: options, statusCode: 401),
            );
          }
          sent.add(event);
        },
      );
      final call = reporter.bind(a, 'call');
      await call.connected();
      await call.closed();
      expect(jsonDecode(store.value!), hasLength(2));
      denied = false;
      await reporter.flush();
      expect(sent, ['connected', 'end']);
    },
  );
  test('expired and malformed metadata evicts before retry', () async {
    final store = MemoryStore()
      ..value = jsonEncode([
        {
          'accountId': 'a',
          'callId': 'old',
          'event': 'end',
          'createdAt': DateTime.now()
              .subtract(const Duration(hours: 25))
              .toIso8601String(),
        },
        {'accountId': 'a', 'callId': '../foreign', 'event': 'end'},
      ]);
    var sent = 0;
    final reporter = CallLifecycleReporter(
      store: store,
      readOwner: () => a,
      send: (_, __, ___) async {
        sent++;
      },
    );
    await reporter.flush();
    await reporter.bind(a, '../foreign').closed();
    expect(sent, 0);
    expect(jsonDecode(store.value!), isEmpty);
  });
  test(
    'storage failure preserves pending cleanup and prevents delivery until durable',
    () async {
      final store = FailingStore();
      var sent = 0;
      final reporter = CallLifecycleReporter(
        store: store,
        readOwner: () => a,
        send: (_, __, ___) async {
          sent++;
        },
      );
      await reporter.bind(a, 'orphan').closed();
      expect(sent, 0);
      await reporter.flush();
      expect(sent, 0);
      store.fail = false;
      await reporter.flush();
      expect(sent, 1);
      expect(jsonDecode(store.value!), isEmpty);
    },
  );
  for (final callId in ['history-id', null, 123]) {
    test(
      'grant parses optional callId $callId and pins issuance bearer',
      () async {
        var token = 'account-a';
        final adapter = GrantAdapter(callId);
        final dio = Dio()..httpClientAdapter = adapter;
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              options.headers['Authorization'] = 'Bearer account-b';
              handler.next(options);
            },
          ),
        );
        final transport = MasanawaAgentTransport(
          dio: dio,
          baseUrl: 'https://gateway.test',
          readAccessToken: () => token,
        );
        final pending = transport.mintLiveVoiceGrantPinned(
          'persona',
          accessToken: 'account-a',
        );
        final request = await adapter.started.future;
        token = 'account-b';
        expect(request.headers['Authorization'], 'Bearer account-a');
        expect(request.receiveTimeout, greaterThan(const Duration(seconds: 20)),
            reason: 'The gateway provider deadline is 20 seconds; a 15-second client gives up before issuance completes.');
        adapter.released.complete();
        final grant = await pending;
        expect(grant.callId, callId is String ? callId : null);
      },
    );
  }
  test(
    'failed connected persists before end and retries after restart without secrets',
    () async {
      final store = MemoryStore();
      final sent = <String>[];
      var offline = true;
      CallLifecycleReporter make() => CallLifecycleReporter(
        store: store,
        readOwner: () => a,
        send: (owner, id, event) async {
          if (offline) throw StateError('offline');
          sent.add('$id/$event/${owner.accessToken}');
        },
      );
      final binding = make().bind(a, 'call');
      await binding.connected();
      await binding.closed();
      await binding.closed();
      expect(jsonDecode(store.value!), hasLength(2));
      expect(store.value, isNot(contains('secret')));
      offline = false;
      await make().flush();
      expect(sent, ['call/connected/secret-a', 'call/end/secret-a']);
      expect(jsonDecode(store.value!), isEmpty);
    },
  );
  test(
    'foreign pending events wait for their owner and use current pinned bearer',
    () async {
      final store = MemoryStore();
      CallLifecycleOwner? current = b;
      final sent = <String>[];
      final reporter = CallLifecycleReporter(
        store: store,
        readOwner: () => current,
        send: (owner, id, event) async =>
            sent.add('${owner.accountId}/$id/$event'),
      );
      await reporter.bind(a, 'a-call').closed();
      expect(sent, isEmpty);
      await reporter.bind(b, 'b-call').closed();
      expect(sent, ['b/b-call/end']);
      current = a;
      await reporter.flush();
      expect(sent.last, 'a/a-call/end');
    },
  );
  test(
    'late response after switch is fenced and retried idempotently',
    () async {
      final store = MemoryStore();
      CallLifecycleOwner? current = a;
      final gate = Completer<void>();
      var requests = 0;
      var changes = 0;
      final reporter = CallLifecycleReporter(
        store: store,
        readOwner: () => current,
        onHistoryChanged: () => changes++,
        send: (owner, id, event) async {
          requests++;
          expect(owner.accessToken, 'secret-a');
          if (requests == 1) await gate.future;
        },
      );
      final pending = reporter.bind(a, 'call').closed();
      await Future<void>.delayed(Duration.zero);
      current = b;
      gate.complete();
      await pending;
      expect(changes, 0);
      expect(jsonDecode(store.value!), hasLength(1));
      await reporter.flush();
      expect(requests, 1);
      current = a;
      await reporter.flush();
      expect(requests, 2);
      expect(changes, 1);
    },
  );
  test('abandoned and legacy grants never report a connection', () async {
    final events = <String>[];
    final reporter = CallLifecycleReporter(
      store: MemoryStore(),
      readOwner: () => a,
      send: (_, __, event) async => events.add(event),
    );
    final orphan = reporter.bind(a, 'orphan');
    await orphan.closed();
    await orphan.connected();
    await orphan.closed();
    await reporter.bind(a, null).connected();
    expect(events, ['end']);
  });
  test('bounded queue evicts complete old call metadata', () async {
    final store = MemoryStore();
    final reporter = CallLifecycleReporter(
      store: store,
      capacity: 3,
      readOwner: () => null,
      send: (_, __, ___) async {},
    );
    final first = reporter.bind(a, 'first');
    await first.connected();
    await first.closed();
    await reporter.bind(a, 'second').closed();
    await reporter.bind(a, 'third').closed();
    final queued = jsonDecode(store.value!) as List;
    expect(queued, hasLength(2));
    expect(queued.any((e) => e['callId'] == 'first'), false);
  });
}

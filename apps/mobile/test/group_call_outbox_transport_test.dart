import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/call_lifecycle_reporter.dart';
import 'package:masanawa/src/calls/group_call_transport.dart';
import 'package:masanawa/src/calls/group_paid_voice_outbox.dart';
import 'package:masanawa/src/calls/group_paid_voice_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/voice/paid_voice.dart';

class Store implements GroupPaidVoiceStore {
  String? data;
  bool failWrites = false;
  @override
  Future<String?> read() async => data;
  @override
  Future<void> write(String value) async {
    if (failWrites) throw StateError('disk');
    data = value;
  }
}

class Adapter implements HttpClientAdapter {
  Adapter(this.respond);
  final FutureOr<Map<String, dynamic>> Function(RequestOptions) respond;
  final List<RequestOptions> requests = [];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(await respond(options)),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> groupJson() => {
  'group': {
    'groupId': 'g',
    'state': 'connecting',
    'createdAt': '2026-10-11T00:00:00Z',
    'endedAt': null,
    'participants': [
      for (final id in ['a', 'b'])
        {
          'characterId': id,
          'displayName': id,
          'state': 'selected',
          'callId': null,
        },
    ],
  },
};
Map<String, dynamic> voiceJson(String id) => {
  'groupId': 'g',
  'characterId': id,
  'callId': 'call_$id',
  'token': 'provider-secret',
  'websocketUrl': 'wss://example.invalid',
  'model': 'm',
  'voiceName': 'v',
  'expiresAt': '2027-01-01T00:00:00Z',
};
Map<String, dynamic> admissionJson() => {
  'admissionId': 'admission_1',
  'quoteId': 'quote_1',
  'characterId': 'a',
  'chargeMode': 'paid',
  'admittedAt': '2026-10-11T00:00:00Z',
  'expiresAt': '2027-01-01T00:00:00Z',
  'spendCapCredits': 10,
};
void main() {
  test(
    'persisted active reservation is skipped in-process and reconciled after restart without credentials',
    () async {
      final store = Store();
      CallLifecycleOwner? owner = const CallLifecycleOwner(
        'owner',
        'secret-bearer',
      );
      final sent = <String>[];
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => owner,
        send: (o, id, outcome) async {
          sent.add('${o.accountId}:$id:$outcome');
        },
      );
      await outbox.register('owner', 'admission_1');
      await outbox.flush();
      expect(sent, isEmpty);
      expect(store.data, contains('admission_1'));
      expect(store.data, isNot(contains('secret-bearer')));
      owner = const CallLifecycleOwner('other', 'other-secret');
      final restored = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => owner,
        send: (o, id, outcome) async {
          sent.add('${o.accountId}:$id:$outcome');
        },
      );
      await restored.flush();
      expect(sent, isEmpty);
      owner = const CallLifecycleOwner('owner', 'new-secret');
      await restored.flush();
      expect(sent, ['owner:admission_1:interrupted']);
      expect(jsonDecode(store.data!), isEmpty);
    },
  );
  test(
    'completion remains durable on network failure and later retries canonically',
    () async {
      final store = Store();
      bool offline = true;
      final sent = <String>[];
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => const CallLifecycleOwner('owner', 'token'),
        send: (owner, id, outcome) async {
          if (offline) throw StateError('offline');
          sent.add(outcome);
        },
      );
      await outbox.register('owner', 'a');
      await outbox.complete('owner', 'a', 'completed');
      await Future<void>.delayed(Duration.zero);
      expect(store.data, contains('completed'));
      expect(sent, isEmpty);
      offline = false;
      await outbox.flush();
      expect(sent, ['completed']);
      expect(jsonDecode(store.data!), isEmpty);
    },
  );
  test(
    'capacity never evicts unresolved financial completion; disk failure fails register',
    () async {
      final store = Store();
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        capacity: 1,
        readOwner: () => null,
        send: (_, _, _) async {},
      );
      await outbox.register('owner', 'a');
      await expectLater(outbox.register('owner', 'b'), throwsStateError);
      expect(store.data, contains('"a"'));
      expect(store.data, isNot(contains('"b"')));
      final broken = Store()..failWrites = true;
      final brokenOutbox = GroupPaidVoiceOutbox(
        store: broken,
        readOwner: () => null,
        send: (_, _, _) async {},
      );
      await expectLater(brokenOutbox.register('owner', 'a'), throwsStateError);
    },
  );
  test(
    'group requests snapshot original bearer and reject foreign token responses',
    () async {
      String? account = 'owner';
      final tokenGate = Completer<Map<String, dynamic>>();
      final adapter = Adapter(
        (request) =>
            request.path.endsWith('/token') ? tokenGate.future : groupJson(),
      );
      final api = ApiClient(dio: Dio())..accessToken = 'mutable-bearer';
      final transport = GatewayGroupCallTransport(
        api: api,
        accountKey: 'owner',
        currentAccountKey: () => account,
        accessToken: 'captured-bearer',
        adapter: adapter,
      );
      await transport.create('request_1', ['a', 'b']);
      api.accessToken = 'foreign-bearer';
      final token = transport.token('g', 'a');
      await Future<void>.delayed(Duration.zero);
      account = 'other';
      tokenGate.complete(voiceJson('a'));
      await expectLater(token, throwsA(isA<ApiException>()));
      await transport.end('g');
      expect(adapter.requests.map((r) => r.headers['Authorization']).toSet(), {
        'Bearer captured-bearer',
      });
      expect(adapter.requests.first.data, {
        'requestId': 'request_1',
        'characterIds': ['a', 'b'],
      });
      expect(adapter.requests.every((r) => r.followRedirects == false), isTrue);
      await expectLater(transport.load('g'), throwsA(isA<ApiException>()));
    },
  );
  test(
    'late accepted paid reservation is persisted and interrupted for original account',
    () async {
      String? account = 'owner';
      final gate = Completer<Map<String, dynamic>>();
      final store = Store();
      CallLifecycleOwner? owner = const CallLifecycleOwner('owner', 'bearer');
      final sent = <String>[];
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => owner,
        send: (o, id, outcome) async {
          sent.add('${o.accountId}:$outcome');
        },
      );
      final adapter = Adapter((request) => gate.future);
      final api = ApiClient(dio: Dio())..accessToken = 'mutable';
      final paid = GroupPaidVoiceTransport(
        api: api,
        accountKey: 'owner',
        currentAccountKey: () => account,
        accessToken: 'pinned',
        outbox: outbox,
        adapter: adapter,
      );
      final admission = paid.start(characterId: 'a', quoteId: 'quote_1');
      await Future<void>.delayed(Duration.zero);
      account = 'other';
      owner = const CallLifecycleOwner('other', 'foreign');
      gate.complete(admissionJson());
      await expectLater(admission, throwsStateError);
      expect(store.data, contains('interrupted'));
      expect(sent, isEmpty);
      owner = const CallLifecycleOwner('owner', 'fresh');
      await outbox.flush();
      expect(sent, ['owner:interrupted']);
      expect(adapter.requests.single.headers['Authorization'], 'Bearer pinned');
    },
  );
  test(
    'missing durable reconciliation denies paid start before any financial request',
    () async {
      final adapter = Adapter((_) => admissionJson());
      final paid = GroupPaidVoiceTransport(
        api: ApiClient(dio: Dio())..accessToken = 'token',
        accountKey: 'owner',
        currentAccountKey: () => 'owner',
        adapter: adapter,
      );
      await expectLater(
        paid.start(characterId: 'a', quoteId: 'quote_1'),
        throwsStateError,
      );
      expect(adapter.requests, isEmpty);
    },
  );
  test(
    'lost start response replays same consented quote after restart and completes once',
    () async {
      final store = Store();
      var reservations = 0;
      final canonical = <String, dynamic>{};
      final owner = const CallLifecycleOwner('owner', 'token');
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => owner,
        send: (_, _, _) async {},
      );
      await outbox.prepareStart('owner', 'a', 'quote_1');
      // Server reserved once, but client never saw the response before death.
      canonical['quote_1'] = admissionJson();
      reservations++;
      final sent = <String>[];
      final restored = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => owner,
        resolveStart: (o, c, q) async {
          expect(q, 'quote_1');
          expect(c, 'a');
          if (!canonical.containsKey(q)) {
            reservations++;
            canonical[q] = admissionJson();
          }
          return PaidVoiceAdmission.fromJson(
            canonical[q] as Map<String, dynamic>,
          );
        },
        send: (o, id, outcome) async {
          sent.add('$id:$outcome');
        },
      );
      await restored.flush();
      expect(reservations, 1);
      expect(sent, ['admission_1:interrupted']);
      expect(jsonDecode(store.data!), isEmpty);
    },
  );
  test(
    'definitive expired unadmitted intent is removed and later financial completion continues',
    () async {
      final store = Store()
        ..data = jsonEncode([
          {
            'kind': 'start',
            'accountId': 'owner',
            'characterId': 'a',
            'quoteId': 'expired',
          },
          {
            'kind': 'complete',
            'accountId': 'owner',
            'admissionId': 'held',
            'outcome': 'completed',
          },
        ]);
      final sent = <String>[];
      final outbox = GroupPaidVoiceOutbox(
        store: store,
        readOwner: () => const CallLifecycleOwner('owner', 'token'),
        resolveStart: (_, _, _) async =>
            throw const GroupPaidVoiceStartExpired(),
        send: (_, id, _) async {
          sent.add(id);
        },
      );
      await outbox.flush();
      expect(sent, ['held']);
      expect(jsonDecode(store.data!), isEmpty);
    },
  );
}

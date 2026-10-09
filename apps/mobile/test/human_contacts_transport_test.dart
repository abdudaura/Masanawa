import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.reply);
  final Future<ResponseBody> Function(RequestOptions options) reply;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => reply(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(String value, {int status = 200}) =>
    ResponseBody.fromString(value, status, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });

ApiClient _client(
  Future<ResponseBody> Function(RequestOptions options) handler, {
  String? token = 'real-session',
}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'));
  dio.httpClientAdapter = _Adapter(handler);
  final api = ApiClient(dio: dio);
  api.accessToken = token;
  return api;
}

const _contact = '{"userId":"user_b","handle":"bob",'
    '"displayName":"Bob","avatarUrl":null,'
    '"status":"none","canMessage":false}';

void main() {
  test('lookup uses exact normalized public handle and session bearer', () async {
    final api = _client((options) async {
      expect(options.path, '/messages/contacts/lookup/bob');
      expect(options.method, 'GET');
      expect(options.headers['Authorization'], 'Bearer real-session');
      return _json(_contact);
    });
    final result = await GatewayHumanContactsTransport(api: api).lookup('@BoB');
    expect(result?.userId, 'user_b');
    expect(result?.canMessage, isFalse);
    expect(result?.status, HumanContactStatus.none);
  });

  test('hidden, blocked and unknown handles share private 404 result', () async {
    final api = _client((options) async => _json(
      '{"error":{"code":"messages.contact_unavailable"}}', status: 404,
    ));
    expect(await GatewayHumanContactsTransport(api: api).lookup('bob'), isNull);
  });


  test('undeployed contacts route is an error, not a hidden person', () async {
    final api = _client((options) async =>
        _json('{"message":"Route not found"}', status: 404));
    final transport = GatewayHumanContactsTransport(api: api);
    await expectLater(
      transport.lookup('bob'),
      throwsA(isA<DioException>().having(
        (error) => error.response?.statusCode, 'statusCode', 404,
      )),
    );
  });

  test('revocation projection requires explicit request and cannot auto-message', () async {
    final api = _client((options) async => _json(
      '{"userId":"user_b","handle":"bob","displayName":"Bob",'
      '"avatarUrl":null,"status":"revoked","canMessage":false}',
    ));
    final result = await GatewayHumanContactsTransport(api: api).lookup('bob');
    expect(result?.status, HumanContactStatus.revoked);
    expect(result?.canMessage, isFalse);
  });

  test('do not send any request without canonical signed-in bearer', () async {
    var calls = 0;
    final api = _client((options) async {
      calls++;
      return _json('{}');
    }, token: null);
    final transport = GatewayHumanContactsTransport(api: api);
    await expectLater(transport.list(), throwsA(isA<ApiException>()));
    await expectLater(transport.preferences(), throwsA(isA<ApiException>()));
    await expectLater(transport.request('bob'), throwsA(isA<ApiException>()));
    await expectLater(
      transport.respond('user_b', accept: true, requestRevision: '1'),
      throwsA(isA<ApiException>()),
    );
    await expectLater(transport.revoke('user_b'), throwsA(isA<ApiException>()));
    expect(calls, 0);
  });

  test('preference mutations send only changed field, parse server result', () async {
    var requestCount = 0;
    final api = _client((options) async {
      requestCount++;
      expect(options.method, 'PATCH');
      expect(options.path, '/messages/contacts/preferences');
      if (requestCount == 1) {
        expect(options.data, {'policy': 'nobody'});
      } else {
        expect(options.data, {'discoverableByHandle': false});
      }
      return _json('{"policy":"nobody","discoverableByHandle":false}');
    });
    final transport = GatewayHumanContactsTransport(api: api);
    expect(
      (await transport.updatePreferences(policy: HumanContactPolicy.nobody))
          .policy,
      HumanContactPolicy.nobody,
    );
    expect(
      (await transport.updatePreferences(discoverableByHandle: false))
          .discoverableByHandle,
      isFalse,
    );
    expect(requestCount, 2);
  });

  test('contact request, approval, listing and revocation use typed IDs', () async {
    var step = 0;
    final api = _client((options) async {
      step++;
      expect(options.headers['Authorization'], 'Bearer real-session');
      switch (step) {
        case 1:
          expect(options.path, '/messages/contacts/requests');
          expect(options.method, 'POST');
          expect(options.data, {'handle': 'bob'});
          return _json('{"status":"pending"}');
        case 2:
          expect(options.path, '/messages/contacts');
          expect(options.queryParameters['limit'], 50);
          return _json('{"contacts":[{"userId":"user_b","handle":"bob",'
              '"displayName":"Bob","avatarUrl":null,'
              '"status":"incoming","requestRevision":"1","updatedAt":"2026-10-08T11:00:00Z"}]}');
        case 3:
          expect(options.path, '/messages/contacts/requests/user_b/response');
          expect(options.method, 'POST');
          expect(options.data, {'accept': true, 'requestRevision': '1'});
          return _json('{"status":"accepted"}');
        case 4:
          expect(options.path, '/messages/contacts/user_b');
          expect(options.method, 'DELETE');
          return _json('{"status":"revoked"}');
        default:
          fail('Unexpected HTTP request');
      }
    });
    final transport = GatewayHumanContactsTransport(api: api);
    expect(await transport.request('@BoB'), 'pending');
    final requests = await transport.list(limit: 50);
    expect(requests.single.userId, 'user_b');
    expect(requests.single.status, HumanContactStatus.incoming);
    expect(await transport.respond('user_b', accept: true, requestRevision: '1'), 'accepted');
    await transport.revoke('user_b');
    expect(step, 4);
  });

  test('server denial or malformed consent ack never becomes success', () async {
    final denied = GatewayHumanContactsTransport(
      api: _client((options) async => _json(
        '{"error":"forbidden"}', status: 403,
      )),
    );
    await expectLater(
      denied.respond('user_b', accept: true, requestRevision: '1'),
      throwsA(isA<DioException>()),
    );
    final malformed = GatewayHumanContactsTransport(
      api: _client((options) async => _json('{"status":"accepted"}')),
    );
    await expectLater(
      malformed.revoke('user_b'),
      throwsA(isA<FormatException>()),
    );
  });

  test('incoming consent requires a server request revision', () async {
    final transport = GatewayHumanContactsTransport(
      api: _client((options) async => _json(
        '{"contacts":[{"userId":"user_b","handle":"bob",'
        '"displayName":"Bob","avatarUrl":null,"status":"incoming",'
        '"updatedAt":"2026-10-08T11:00:00Z"}]}')),
    );
    await expectLater(transport.list(), throwsA(isA<FormatException>()));
    await expectLater(
      transport.respond('user_b', accept: true, requestRevision: '0'),
      throwsA(isA<FormatException>()),
    );
  });

  test('unknown privacy values or partial contacts fail closed', () async {
    final transport = GatewayHumanContactsTransport(
      api: _client((options) async =>
          _json('{"policy":"friends","discoverableByHandle":true}')),
    );
    await expectLater(
      transport.preferences(), throwsA(isA<FormatException>()),
    );
    expect(
      () => HumanContact.fromJson({
        'userId': 'a', 'handle': 'a', 'displayName': 'A', 'status': 'none',
      }, fromLookup: true),
      throwsA(isA<FormatException>()),
    );
  });

  test('cursor paging carries signed-in bearer and bounded stable continuation', () async {
    var calls = 0;
    final api = _client((options) async {
      calls++;
      expect(options.path, '/messages/contacts/page');
      expect(options.headers['Authorization'], 'Bearer real-session');
      expect(options.queryParameters['limit'], 1);
      if (calls == 1) {
        expect(options.queryParameters.containsKey('cursor'), isFalse);
        return _json('{"contacts":[{"userId":"user_b","handle":"bob",'
            '"displayName":"Bob","avatarUrl":null,"status":"accepted",'
            '"requestRevision":"1","updatedAt":"2026-10-08T11:00:00Z"}],'
            '"nextCursor":"cursor_Bob1"}');
      }
      expect(options.queryParameters['cursor'], 'cursor_Bob1');
      return _json('{"contacts":[{"userId":"user_c","handle":"cora",'
          '"displayName":"Cora","avatarUrl":null,"status":"accepted",'
          '"requestRevision":"2","updatedAt":"2026-10-08T10:00:00Z"}],'
          '"nextCursor":null}');
    });
    final transport = GatewayHumanContactsTransport(api: api);
    final first = await transport.page(limit: 1);
    expect(first.contacts.single.userId, 'user_b');
    expect(first.nextCursor, 'cursor_Bob1');
    final next = await transport.page(limit: 1, cursor: first.nextCursor);
    expect(next.contacts.single.userId, 'user_c');
    expect(next.nextCursor, isNull);
    expect(calls, 2);
  });

  test('invalid pagination data and logged-out page calls fail closed', () async {
    final missing = GatewayHumanContactsTransport(api: _client(
      (_) async => _json('{"contacts":[]}'),
    ));
    await expectLater(missing.page(), throwsA(isA<FormatException>()));
    final overflow = GatewayHumanContactsTransport(api: _client(
      (_) async => _json('{"contacts":[{},{}],"nextCursor":null}'),
    ));
    await expectLater(overflow.page(limit: 1), throwsA(isA<FormatException>()));
    final invalid = GatewayHumanContactsTransport(api: _client(
      (_) async => _json('{"contacts":[],"nextCursor":"wrong!"}'),
    ));
    await expectLater(invalid.page(), throwsA(isA<FormatException>()));
    await expectLater(
      invalid.page(cursor: 'bad!'), throwsA(isA<FormatException>()),
    );
    final signedOut = GatewayHumanContactsTransport(
      api: _client((_) async => fail('network must not be called'), token: null),
    );
    await expectLater(signedOut.page(), throwsA(isA<ApiException>()));
  });
}

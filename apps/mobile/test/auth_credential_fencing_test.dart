import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';

/// Executes real Dio interceptors and HTTP validation against controlled,
/// deferred transport responses. No network, user secret or external account.
class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  final queued = <Completer<ResponseBody>>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? body,
      Future<void>? cancelFuture) {
    requests.add(options);
    final request = Completer<ResponseBody>();
    queued.add(request);
    return request.future;
  }

  void complete(int index, int status, {Map<String, Object?> data = const {}}) {
    queued[index].complete(ResponseBody.fromString(
      jsonEncode(data), status, headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    ));
  }

  @override
  void close({bool force = false}) {}
}

Future<void> _flush() async {
  for (var i = 0; i < 8; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  late ApiClient api;
  late _Adapter adapter;

  setUp(() {
    adapter = _Adapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://unit.test',
      validateStatus: (s) => s != null && s >= 200 && s < 300));
    dio.httpClientAdapter = adapter;
    api = ApiClient(dio: dio);
  });

  void login(String user, String token) {
    api.authenticatedAccountId = user;
    api.accessToken = token;
  }

  test('old account success cannot read back after replacement', () async {
    login('fan-a', 'a1');
    final result = api.dio.get<Map<String, dynamic>>('/v1/chats');
    await _flush();
    expect(adapter.requests, hasLength(1));
    expect(adapter.requests.first.headers['Authorization'], 'Bearer a1');
    login('fan-b', 'b1');
    adapter.complete(0, 200, data: {'chats': ['private-A']});
    await expectLater(result, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
  });

  test('late A 401 never rotates or replays against B', () async {
    login('fan-a', 'a1');
    var rotations = 0;
    api.onUnauthorized = () async { rotations++; return 'other'; };
    final result = api.dio.get('/v1/rooms');
    await _flush();
    login('fan-b', 'b1');
    adapter.complete(0, 401, data: {'code': 'UNAUTHORIZED'});
    await expectLater(result, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
    expect(rotations, 0);
    expect(adapter.requests, hasLength(1));
  });

  test('same-account 401 refresh retries once and keeps account', () async {
    login('fan-a', 'a1');
    var rotations = 0;
    api.onUnauthorized = () async { rotations++; return 'a2'; };
    final result = api.dio.get('/v1/chats');
    await _flush();
    adapter.complete(0, 401, data: {'code': 'UNAUTHORIZED'});
    await _flush();
    expect(adapter.requests, hasLength(2));
    expect(adapter.requests[1].headers['Authorization'], 'Bearer a2');
    adapter.complete(1, 200, data: {'chats': []});
    expect((await result).statusCode, 200);
    expect(rotations, 1);
    expect(api.authenticatedAccountId, 'fan-a');
  });

  test('account switches during refresh: B token never sent on A request', () async {
    login('fan-a', 'a1');
    final rotating = Completer<String?>();
    api.onUnauthorized = () => rotating.future;
    final result = api.dio.get('/v1/chats');
    await _flush();
    adapter.complete(0, 401, data: {'code': 'UNAUTHORIZED'});
    await _flush();
    login('fan-b', 'b1');
    rotating.complete('a2');
    await expectLater(result, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
    expect(api.accessToken, 'b1');
    expect(adapter.requests, hasLength(1));
  });

  test('A-B-A still rejects response of the original A login', () async {
    login('fan-a', 'a1');
    final stale = api.dio.get('/account/deletion');
    await _flush();
    login('fan-b', 'b1');
    login('fan-a', 'a3');
    adapter.complete(0, 200, data: {'request': {'secret': 'old'}});
    await expectLater(stale, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
  });

  test('signed-out token replacement invalidates old pending request', () async {
    api.accessToken = 'a1';
    final old = api.dio.get('/v1/chats');
    await _flush();
    api.accessToken = 'b1';
    adapter.complete(0, 200, data: {'chats': ['old']});
    await expectLater(old, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
  });

  test('logout discards old HTTP read even with same user next login', () async {
    login('fan-a', 'a1');
    final old = api.dio.get('/v1/chats');
    await _flush();
    api.authenticatedAccountId = null;
    api.accessToken = null;
    login('fan-a', 'new-login');
    adapter.complete(0, 200, data: {'chats': ['old']});
    await expectLater(old, throwsA(isA<DioException>().having(
      (e) => e.type, 'type', DioExceptionType.cancel)));
  });
}

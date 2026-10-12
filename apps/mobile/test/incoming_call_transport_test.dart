import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/incoming_call_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handle);
  final Future<ResponseBody> Function(RequestOptions) handle;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? stream,
    Future<void>? cancelFuture,
  ) => handle(options);
  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> record([String id = 'call']) => {
  'callId': id,
  'characterId': 'character_test',
  'displayName': 'Masana',
  'state': 'accepted',
  'createdAt': '2026-10-12T00:00:00Z',
  'expiresAt': '2026-10-12T00:01:00Z',
};
ResponseBody response(Object value) => ResponseBody.fromString(
  jsonEncode(value),
  200,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);
void main() {
  test(
    'accept has no spending or media authority and captures original bearer',
    () async {
      final api = ApiClient(
        dio: Dio(BaseOptions(baseUrl: 'https://example.test')),
      )..accessToken = 'old';
      final transport = GatewayIncomingCallTransport(
        api: api,
        accountKey: 'a',
        currentAccountKey: () => 'a',
        adapter: _Adapter((request) async {
          expect(request.path, '/v1/calls/incoming/call/accept');
          expect(request.data, {});
          expect(request.headers['Authorization'], 'Bearer old');
          return response({'call': record()});
        }),
      );
      api.accessToken = 'new';
      expect((await transport.accept('call')).state, 'accepted');
    },
  );
  test('account switch rejects delayed authoritative response', () async {
    var account = 'a';
    final pending = Completer<ResponseBody>();
    final transport = GatewayIncomingCallTransport(
      api: ApiClient(dio: Dio(BaseOptions(baseUrl: 'https://example.test'))),
      accountKey: 'a',
      currentAccountKey: () => account,
      adapter: _Adapter((_) => pending.future),
    );
    final loading = transport.load('call');
    await Future<void>.delayed(Duration.zero);
    account = 'b';
    pending.complete(response({'call': record()}));
    await expectLater(loading, throwsA(isA<ApiException>()));
  });
  test('rejects invitation identity substitution', () async {
    final transport = GatewayIncomingCallTransport(
      api: ApiClient(dio: Dio(BaseOptions(baseUrl: 'https://example.test'))),
      accountKey: 'a',
      currentAccountKey: () => 'a',
      adapter: _Adapter((_) async => response({'call': record('other')})),
    );
    await expectLater(transport.load('call'), throwsFormatException);
  });
}

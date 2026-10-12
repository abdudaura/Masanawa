import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/call_history.dart';
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

void main() {
  test(
    'history uses canonical endpoint, opaque cursor and session authorization',
    () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
      final api = ApiClient(dio: dio)..accessToken = 'session-token';
      dio.httpClientAdapter = _Adapter((request) async {
        expect(request.path, '/v1/calls');
        expect(request.queryParameters, {
          'limit': 30,
          'cursor': 'opaque-cursor',
        });
        expect(request.headers['Authorization'], 'Bearer session-token');
        return ResponseBody.fromString(
          jsonEncode({'calls': [], 'nextCursor': null}),
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        );
      });
      final page = await GatewayCallHistoryTransport(
        api: api,
      ).loadPage(cursor: 'opaque-cursor');
      expect(page.calls, isEmpty);
      expect(page.nextCursor, isNull);
      dio.close();
    },
  );
  test('query is sent only through canonical authorized /v1/calls', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    final api = ApiClient(dio: dio)..accessToken = 'session-token';
    dio.httpClientAdapter = _Adapter((request) async {
      expect(request.path, '/v1/calls');
      expect(request.queryParameters, {
        'limit': 30,
        'q': 'amina',
        'cursor': 'query-bound-cursor',
      });
      expect(request.headers['Authorization'], 'Bearer session-token');
      return ResponseBody.fromString(
        '{"calls":[],"nextCursor":null}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    await GatewayCallHistoryTransport(api: api).loadPage(
      query: 'amina', cursor: 'query-bound-cursor',
    );
    dio.close();
  });

  test(
    'rejects malformed history rather than silently displaying an empty list',
    () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
      final api = ApiClient(dio: dio);
      dio.httpClientAdapter = _Adapter(
        (_) async => ResponseBody.fromString(
          '{"calls":"invalid","nextCursor":null}',
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json'],
          },
        ),
      );
      await expectLater(
        GatewayCallHistoryTransport(api: api).loadPage(),
        throwsFormatException,
      );
      dio.close();
    },
  );
}

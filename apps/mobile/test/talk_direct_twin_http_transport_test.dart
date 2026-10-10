import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_direct_twin_http_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object value, [int status = 200]) => ResponseBody.fromString(
  jsonEncode(value),
  status,
  headers: {Headers.contentTypeHeader: ['application/json']},
);

void main() {
  test('owned Twin Seats use authenticated Talk-scoped projection', () async {
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      return _json([
        {'seatId': 'seat-1', 'personaId': 'twin-1'},
      ]);
    });

    final transport = GatewayDirectTwinTransport(api: ApiClient(dio: dio));
    final seats = await transport.mine('talk-1');

    expect(path, '/talks/talk-1/twin-seats/mine');
    expect(seats, hasLength(1));
    expect(seats.single.seatId, 'seat-1');
    expect(seats.single.personaId, 'twin-1');
  });

  test('Direct Twin set carries compare-and-swap revision and private text', () async {
    String? path;
    Map<String,dynamic>? body;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      body = (options.data as Map).cast<String,dynamic>();
      return _json({
        'revision': 4,
        'instruction': 'Ask for evidence',
        'expiresAt': '2026-10-07T12:30:00Z',
      });
    });

    final transport = GatewayDirectTwinTransport(api: ApiClient(dio: dio));
    final result = await transport.set(
      talkId: 'talk-1',
      seatId: 'seat-1',
      revision: 3,
      instruction: 'Ask for evidence',
    );

    expect(path, '/talks/talk-1/twin-seats/seat-1/direct');
    expect(body, {
      'expectedRevision': 3,
      'instruction': 'Ask for evidence',
    });
    expect(result.revision, 4);
    expect(result.instruction, 'Ask for evidence');
  });

  test('first Direct Twin instruction sends null expected revision', () async {
    Object? expectedRevision;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expectedRevision = (options.data as Map)['expectedRevision'];
      return _json({'revision': 1, 'instruction': 'Be concise', 'expiresAt': null});
    });

    final transport = GatewayDirectTwinTransport(api: ApiClient(dio: dio));
    await transport.set(
      talkId: 'talk-1',
      seatId: 'seat-1',
      revision: 0,
      instruction: 'Be concise',
    );

    expect(expectedRevision, isNull);
  });
}

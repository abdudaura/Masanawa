import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/voice/paid_voice_http_transport.dart';

class _PaidVoiceAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode({'ok': true}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('paid voice reports media start before completion on canonical routes', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _PaidVoiceAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'user-session';
    final transport = GatewayPaidVoiceTransport(api: client);

    await transport.mediaStarted(admissionId: 'operation_voice_123');
    await transport.complete(
      admissionId: 'operation_voice_123',
      outcome: 'completed',
    );

    expect(
      adapter.requests.map((request) => request.uri.path).toList(),
      [
        '/agent/twin/voice/operation_voice_123/media-started',
        '/agent/twin/voice/operation_voice_123/complete',
      ],
    );
    expect(adapter.requests[0].method, 'POST');
    expect(adapter.requests[1].data, {'outcome': 'completed'});
    for (final request in adapter.requests) {
      expect(request.headers['Authorization'], 'Bearer user-session');
    }
  });
}

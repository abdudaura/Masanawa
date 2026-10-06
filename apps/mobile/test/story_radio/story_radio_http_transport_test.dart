import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/story_radio/story_radio_http_transport.dart';

class _Adapter implements HttpClientAdapter {
  final authorizationHeaders = <String?>[];
  var requests = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests += 1;
    authorizationHeaders.add(options.headers['Authorization']?.toString());
    if (requests == 1) {
      return ResponseBody.fromString(
        jsonEncode({
          'error': {
            'code': 'customer_auth.session.invalid',
            'message': 'session expired',
          },
        }),
        401,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString(
      jsonEncode({
        'featured': null,
        'series': const [],
        'continueProgress': null,
      }),
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
  test('Story Radio retries once after the shared ApiClient refreshes auth',
      () async {
    final adapter = _Adapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = adapter;
    final api = ApiClient(dio: dio)
      ..accessToken = 'expired-token'
      ..onUnauthorized = () async => 'fresh-token';
    final transport = GatewayStoryRadioTransport(api: api);

    final home = await transport.loadHome();

    expect(home.series, isEmpty);
    expect(adapter.requests, 2);
    expect(
      adapter.authorizationHeaders,
      ['Bearer expired-token', 'Bearer fresh-token'],
    );
    expect(api.accessToken, 'fresh-token');
  });
}

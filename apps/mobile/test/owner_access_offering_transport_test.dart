import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';
import 'package:masanawa/src/owner_access/owner_access_http_transport.dart';

class _OwnerAccessOfferingAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  bool malformed = false;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final body = malformed
        ? {
            'enabled': true,
            'modalities': <String>[],
            'durationOptionsMinutes': <int>[],
            'priceCreditsPerMinute': -1,
          }
        : {
            'enabled': options.method == 'PUT',
            'modalities': ['voice'],
            'durationOptionsMinutes': [15, 30],
            'priceCreditsPerMinute': options.method == 'PUT' ? 12 : 0,
            'revision': options.method == 'PUT' ? 2 : 1,
          };
    return ResponseBody.fromString(
      jsonEncode(body),
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
  test('human access offering uses canonical authenticated Gateway routes', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _OwnerAccessOfferingAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'user-session';
    final transport = GatewayOwnerAccessOfferingTransport(api: client);

    final initial = await transport.read();
    expect(initial.enabled, isFalse);
    expect(initial.modalities, {OwnerAccessModality.voice});
    expect(initial.durationOptionsMinutes, [15, 30]);
    expect(initial.priceCreditsPerMinute, 0);

    final saved = await transport.update(
      const OwnerAccessOffering(
        enabled: true,
        modalities: {OwnerAccessModality.voice},
        durationOptionsMinutes: [15, 30],
        priceCreditsPerMinute: 12,
      ),
    );
    expect(saved.enabled, isTrue);
    expect(saved.priceCreditsPerMinute, 12);

    expect(
      adapter.requests.map((request) => request.uri.path).toList(),
      [
        '/v1/twin/owner-access/offering',
        '/v1/twin/owner-access/offering',
      ],
    );
    expect(
      adapter.requests.map((request) => request.method).toList(),
      ['GET', 'PUT'],
    );
    expect(adapter.requests.last.data, {
      'enabled': true,
      'modalities': ['voice'],
      'durationOptionsMinutes': [15, 30],
      'priceCreditsPerMinute': 12,
    });
    for (final request in adapter.requests) {
      expect(request.headers['Authorization'], 'Bearer user-session');
    }
  });

  test('human access offering parser rejects malformed server state', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _OwnerAccessOfferingAdapter()..malformed = true;
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio);
    final transport = GatewayOwnerAccessOfferingTransport(api: client);

    await expectLater(transport.read(), throwsFormatException);
  });
}

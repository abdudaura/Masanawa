import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';
import 'package:masanawa/src/owner_access/owner_access_http_transport.dart';

class _OfferingGatewayAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final body = options.method == 'GET'
        ? {
            'enabled': false,
            'modalities': ['voice'],
            'durationOptionsMinutes': [15],
            'priceCreditsPerMinute': 0,
            'revision': 0,
          }
        : {
            ...(options.data as Map).cast<String, dynamic>(),
            'revision': 1,
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
  test('owner access offering stays simple and owner-controlled', () {
    const offering = OwnerAccessOffering(
      enabled: true,
      modalities: {
        OwnerAccessModality.text,
        OwnerAccessModality.voice,
      },
      durationOptionsMinutes: [15, 30],
      priceCreditsPerMinute: 20,
    );

    final disabled = offering.copyWith(enabled: false);

    expect(offering.modalities.length, 2);
    expect(offering.durationOptionsMinutes, [15, 30]);
    expect(offering.priceCreditsPerMinute, 20);
    expect(disabled.enabled, isFalse);
  });

  test('human-access offering uses canonical authenticated Gateway routes',
      () async {
    final dio = Dio();
    final adapter = _OfferingGatewayAdapter();
    dio.httpClientAdapter = adapter;
    final api = ApiClient(dio: dio)..accessToken = 'account-session';
    final transport = GatewayOwnerAccessOfferingTransport(api: api);

    final initial = await transport.read();
    expect(initial.enabled, isFalse);
    expect(initial.modalities, {OwnerAccessModality.voice});
    expect(initial.durationOptionsMinutes, [15]);
    expect(initial.priceCreditsPerMinute, 0);

    final saved = await transport.update(
      initial.copyWith(
        enabled: true,
        durationOptionsMinutes: const [15, 30, 60],
        priceCreditsPerMinute: 12,
      ),
    );

    expect(saved.enabled, isTrue);
    expect(saved.durationOptionsMinutes, [15, 30, 60]);
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
    expect(
      adapter.requests.every(
        (request) =>
            request.headers['Authorization'] == 'Bearer account-session',
      ),
      isTrue,
    );
    expect(adapter.requests.last.data, {
      'enabled': true,
      'modalities': ['voice'],
      'durationOptionsMinutes': [15, 30, 60],
      'priceCreditsPerMinute': 12,
    });
  });
}

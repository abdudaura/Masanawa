import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';
import 'package:masanawa/src/owner_access/owner_access_http_transport.dart';

class _OwnerAccessAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final body = {
      'requestId': 'owner-request-123',
      'requesterUserId': 'user-requester',
      'ownerUserId': 'user-owner',
      'originatingCharacterId': 'character_test',
      'modality': 'voice',
      'durationMinutes': 15,
      'priceCredits': 0,
      'chargeMode': 'trial',
      'state': options.method == 'POST' ? 'cancelled' : 'requested',
      'requestedAt': '2026-10-05T10:00:00Z',
      'acceptBy': '2026-10-05T11:00:00Z',
      'scheduledFor': null,
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
  test('latest owner request and cancellation use canonical Gateway routes', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _OwnerAccessAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'user-session';
    final transport = GatewayOwnerAccessTransport(api: client);

    final latest = await transport.latest(characterId: 'character_test');
    expect(latest?.state, OwnerAccessState.requested);

    final cancelled = await transport.act(
      characterId: 'character_test',
      requestId: 'owner-request-123',
      action: 'cancel',
    );
    expect(cancelled.state, OwnerAccessState.cancelled);

    expect(adapter.requests[0].uri.path, '/agent/twin/owner-access/latest');
    expect(adapter.requests[0].uri.queryParameters['characterId'], 'character_test');
    expect(adapter.requests[1].uri.path,
        '/agent/twin/owner-access/owner-request-123/action');
    expect(adapter.requests[1].data, {
      'characterId': 'character_test',
      'action': 'cancel',
    });
    for (final request in adapter.requests) {
      expect(request.headers['Authorization'], 'Bearer user-session');
    }
  });
}

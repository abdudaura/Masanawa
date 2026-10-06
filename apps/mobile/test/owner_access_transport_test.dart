import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';
import 'package:masanawa/src/owner_access/owner_access_http_transport.dart';

class _OwnerAccessAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  Map<String, dynamic> _requestBody(String state) => {
        'requestId': 'owner-request-123',
        'requesterUserId': 'user-requester',
        'ownerUserId': 'user-owner',
        'originatingCharacterId': 'character_test',
        'modality': 'text',
        'durationMinutes': 15,
        'priceCredits': 0,
        'chargeMode': 'trial',
        'state': state,
        'requestedAt': '2026-10-05T10:00:00Z',
        'acceptBy': '2026-10-05T11:00:00Z',
        'scheduledFor': null,
      };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final path = options.uri.path;
    Object body;
    if (path.endsWith('/heartbeat')) {
      body = {
        'attendanceVerified': true,
        'verifiedSeconds': 75,
        'sessionEndsAt': '2026-10-05T10:20:00Z',
        'presence': [
          {
            'userId': 'user-requester',
            'firstSeenAt': '2026-10-05T10:00:00Z',
            'lastSeenAt': '2026-10-05T10:01:15Z',
            'heartbeatCount': 6,
          },
          {
            'userId': 'user-owner',
            'firstSeenAt': '2026-10-05T10:00:00Z',
            'lastSeenAt': '2026-10-05T10:01:15Z',
            'heartbeatCount': 6,
          },
        ],
      };
    } else if (path.endsWith('/messages') && options.method == 'GET') {
      body = [
        {
          'requestId': 'owner-request-123',
          'messageId': 'message-server-123',
          'senderUserId': 'user-owner',
          'body': 'Hello',
          'sentAt': '2026-10-05T10:00:30Z',
        },
      ];
    } else if (path.endsWith('/messages')) {
      final data = (options.data as Map).cast<String, dynamic>();
      body = {
        'requestId': 'owner-request-123',
        'messageId': data['messageId'],
        'senderUserId': 'user-requester',
        'body': data['body'],
        'sentAt': '2026-10-05T10:00:40Z',
      };
    } else {
      body = _requestBody(
        path.endsWith('/action') ? 'cancelled' : 'requested',
      );
    }
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
    expect(latest?.modality, OwnerAccessModality.text);

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
  });

  test('human room heartbeat, message read and send use private request routes', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _OwnerAccessAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'user-session';
    final transport = GatewayOwnerAccessTransport(api: client);

    final status = await transport.heartbeat(
      characterId: 'character_test',
      requestId: 'owner-request-123',
    );
    expect(status.attendanceVerified, isTrue);
    expect(status.verifiedSeconds, 75);
    expect(status.sessionEndsAt, isNotNull);
    expect(status.presence, hasLength(2));

    final messages = await transport.messages(
      characterId: 'character_test',
      requestId: 'owner-request-123',
    );
    expect(messages.single.body, 'Hello');

    final sent = await transport.sendMessage(
      characterId: 'character_test',
      requestId: 'owner-request-123',
      messageId: 'message-client-123',
      body: 'Hi',
    );
    expect(sent.body, 'Hi');

    expect(
      adapter.requests.map((request) => request.uri.path).toList(),
      [
        '/agent/twin/owner-access/owner-request-123/heartbeat',
        '/agent/twin/owner-access/owner-request-123/messages',
        '/agent/twin/owner-access/owner-request-123/messages',
      ],
    );
    expect(adapter.requests[1].uri.queryParameters['characterId'], 'character_test');
    expect(adapter.requests[2].data, {
      'characterId': 'character_test',
      'messageId': 'message-client-123',
      'body': 'Hi',
    });
    for (final request in adapter.requests) {
      expect(request.headers['Authorization'], 'Bearer user-session');
    }
  });
}

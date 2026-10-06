import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_profile.dart';
import 'package:masanawa/src/agents/twin_profile_http_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

class _TwinProfileAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    Object body;
    if (options.uri.path.endsWith('/customize/preview')) {
      body = {
        'currentRevision': 7,
        'patch': {
          'discoverable': true,
        },
        'requiresConfirmation': true,
        'standingChanges': ['publish-profile'],
      };
    } else if (options.uri.path.endsWith('/customize')) {
      body = {
        'characterId': 'character_test',
        'publicId': 'owner-twin',
        'displayName': 'Owner',
        'bio': 'Builder',
        'interests': <String>[],
        'languages': ['English'],
        'avatarUrl': null,
        'discoverable': true,
        'revision': 8,
        'representationLabel': 'AI twin',
      };
    } else {
      body = {
        'hasTwin': true,
        'characterId': 'character_test',
        'displayName': 'Owner',
        'bio': 'Builder',
        'publicUrl': 'https://masanawa.com/twin/owner-twin',
        'discoverable': true,
        'voiceEnabled': true,
        'ownerAccessEnabled': true,
        'languages': ['English'],
        'summary': {
          'visitors': 0,
          'conversations': 0,
          'earningsCredits': 0,
          'pendingOwnerRequests': 0,
        },
      };
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
  test('Teach customization previews, confirms and refreshes My Twin', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final adapter = _TwinProfileAdapter();
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'user-session';
    final transport = GatewayTwinProfileTransport(api: client);

    final preview = await transport.previewCustomization(
      const TwinProfileCustomizationPatch(discoverable: true),
    );
    expect(preview.currentRevision, 7);
    expect(preview.requiresConfirmation, isTrue);
    expect(preview.standingChanges, ['publish-profile']);

    final profile = await transport.applyCustomization(
      preview: preview,
      confirmed: true,
    );
    expect(profile.discoverable, isTrue);

    expect(
      adapter.requests.map((request) => request.uri.path).toList(),
      [
        '/agent/twin/profile/customize/preview',
        '/agent/twin/profile/customize',
        '/v1/my-twin',
      ],
    );
    expect(adapter.requests[1].data, containsPair('expectedRevision', 7));
    expect(adapter.requests[1].data, containsPair('confirmed', true));
    expect(adapter.requests[1].data, containsPair('discoverable', true));
    expect(
      adapter.requests.every(
        (request) => request.headers['Authorization'] == 'Bearer user-session',
      ),
      isTrue,
    );
  });
}

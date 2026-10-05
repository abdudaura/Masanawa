import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_profile_http_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

const _profileJson =
    '{"hasTwin":true,"characterId":"character-1","displayName":"Abdullahi","bio":"Technology","publicUrl":"https://masanawa.com/abdullahi","discoverable":true,"voiceEnabled":true,"ownerAccessEnabled":true,"languages":["English","Hausa"],"summary":{"visitors":12,"conversations":7,"earningsCredits":850,"pendingOwnerRequests":2}}';

void main() {
  test('My Twin transport loads the composed consumer endpoint', () async {
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      return ResponseBody.fromString(
        _profileJson,
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinProfileTransport(api: ApiClient(dio: dio));
    final profile = await transport.load();

    expect(path, '/v1/my-twin');
    expect(profile.displayName, 'Abdullahi');
    expect(profile.summary.earningsCredits, 850);
  });

  test('discoverability update sends only the simple boolean intent', () async {
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        _profileJson.replaceFirst('"discoverable":true', '"discoverable":false'),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinProfileTransport(api: ApiClient(dio: dio));
    final profile = await transport.setDiscoverable(false);

    expect(seen, {'discoverable': false});
    expect(profile.discoverable, isFalse);
  });
}

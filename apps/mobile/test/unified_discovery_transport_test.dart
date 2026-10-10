import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_models.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_transport.dart';

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

Dio _dio(Future<ResponseBody> Function(RequestOptions) handler) {
  final dio = Dio(BaseOptions(baseUrl: 'https://gateway.example.test'));
  dio.httpClientAdapter = _Adapter(handler);
  return dio;
}

ResponseBody _json(String text, int status) => ResponseBody.fromString(
  text,
  status,
  headers: {Headers.contentTypeHeader: ['application/json']},
);

void main() {
  test('sends signed-in tenant request with typed filters and bounded page', () async {
    RequestOptions? request;
    final api = ApiClient(dio: _dio((options) async {
      request = options;
      return _json(
        '{"items":[{"kind":"person","id":"amina","title":"Amina",'
        '"subtitle":"@amina","isLive":false,"avatarUrl":null}],'
        '"nextOffset":null,"searchWindowSaturated":false}',
        200,
      );
    }))..accessToken = 'session-a';
    final result = await GatewayPublicDiscoveryTransport(api).search(
      query: '  amina  ', filter: PublicDiscoveryFilter.people,
      liveOnly: false, offset: 0,
    );
    expect(request?.path, '/discovery/public');
    expect(request?.queryParameters, {
      'q': 'amina', 'type': 'people', 'liveOnly': false,
      'offset': 0, 'limit': 20,
    });
    expect(request?.headers['Authorization'], 'Bearer session-a');
    expect(result.items.single.route, '/u/amina');
  });

  test('does not transmit any query when signed out', () async {
    var calls = 0;
    final api = ApiClient(dio: _dio((options) async {
      calls++;
      return _json('{"items":[]}', 200);
    }));
    await expectLater(
      GatewayPublicDiscoveryTransport(api).search(
        query: 'amina', filter: PublicDiscoveryFilter.all,
        liveOnly: false, offset: 0,
      ),
      throwsA(isA<ApiException>()),
    );
    expect(calls, 0);
  });

  test('does not reinterpret an undeployed search route as empty results', () async {
    final api = ApiClient(dio: _dio(
      (_) async => _json('{"error":"Not Found"}', 404),
    ))..accessToken = 'viewer';
    await expectLater(
      GatewayPublicDiscoveryTransport(api).search(
        query: 'amina', filter: PublicDiscoveryFilter.all,
        liveOnly: false, offset: 0,
      ),
      throwsA(isA<DioException>()),
    );
  });

  test('refuses untrusted private routes and malformed pagination', () async {
    final api = ApiClient(dio: _dio((_) async => _json(
      '{"items":[{"kind":"person","id":"../../admin","title":"Private",'
      '"subtitle":"-","isLive":false}],"nextOffset":null,'
      '"searchWindowSaturated":false}',
      200,
    )))..accessToken = 'viewer';
    await expectLater(
      GatewayPublicDiscoveryTransport(api).search(
        query: 'amina', filter: PublicDiscoveryFilter.all,
        liveOnly: false, offset: 0,
      ),
      throwsA(isA<FormatException>()),
    );
  });
}

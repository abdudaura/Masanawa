import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/social/own_profile_transport.dart';

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

ResponseBody _json(String body, {int status = 200}) =>
    ResponseBody.fromString(
      body,
      status,
      headers: {Headers.contentTypeHeader: ['application/json']},
    );

const _profile = '{"handle":"amina","displayName":"Amina","bio":"Host",'
    '"avatarUrl":null,"followerCount":0,"followingCount":0,'
    '"isFollowing":false,"isLive":false}';

void main() {
  test('own profile is loaded through authenticated self route', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.method, 'GET');
      expect(options.path, '/profiles/me');
      return _json(_profile);
    });
    final transport = GatewayOwnProfileTransport(api: ApiClient(dio: dio));
    final result = await transport.loadSelf();
    expect(result.handle, 'amina');
    expect(result.displayName, 'Amina');
  });

  test('owner edit sends changed fields only, including photo removal', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.method, 'PATCH');
      expect(options.path, '/profiles/me');
      expect(options.data, {
        'displayName': 'Amina Bello',
        'bio': '',
        'removeAvatar': true,
      });
      return _json(_profile);
    });
    final transport = GatewayOwnProfileTransport(api: ApiClient(dio: dio));
    await transport.updateSelf(
      displayName: 'Amina Bello', bio: '', removeAvatar: true,
    );
  });

  test('first-time profile creation uses PUT with no user ID override', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.method, 'PUT');
      expect(options.path, '/profiles/me');
      expect(options.data, {
        'handle': 'amina', 'displayName': 'Amina', 'bio': '',
      });
      return _json(_profile, status: 201);
    });
    final transport = GatewayOwnProfileTransport(api: ApiClient(dio: dio));
    expect(
      (await transport.createSelf(
        handle: 'amina', displayName: 'Amina', bio: '',
      )).handle,
      'amina',
    );
  });

  test('empty updates cannot produce a cosmetic success', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    final transport = GatewayOwnProfileTransport(api: ApiClient(dio: dio));
    await expectLater(
      transport.updateSelf(), throwsArgumentError,
    );
  });

  test('server 401 is not treated as a missing editable profile', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter =
        _Adapter((_) async => _json('{"error":"unauthorized"}', status: 401));
    final transport = GatewayOwnProfileTransport(api: ApiClient(dio: dio));
    await expectLater(
      transport.loadSelf(),
      throwsA(isA<DioException>().having(
        (error) => error.response?.statusCode, 'statusCode', 401,
      )),
    );
  });
}

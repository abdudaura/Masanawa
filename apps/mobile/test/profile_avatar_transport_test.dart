import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/profile_avatar/avatar_transport.dart';

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

void main() {
  test('uploads bounded PNG as binary with authenticated API client', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.path, '/profiles/me/avatar');
      expect(options.method, 'POST');
      expect(options.contentType, 'image/png');
      expect(options.headers['x-avatar-expected'], 'v1:');
      expect(options.data, isA<Stream<List<int>>>());
      return _json(
        '{"avatarUrl":"https://images.masanawa.example/profile.png"}',
        status: 201,
      );
    });
    final api = ApiClient(dio: dio)..accessToken = 'session';
    final avatar = GatewayProfileAvatarTransport(api: api);
    expect(
      await avatar.upload(Uint8List.fromList(List.filled(64, 1)), expectedUrl: null),
      'https://images.masanawa.example/profile.png',
    );
  });

  test('rejects arbitrary unsafe URL from a compromised profile response', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.example.test'));
    dio.httpClientAdapter = _Adapter((_) async =>
      _json('{"avatarUrl":"javascript:alert(1)"}', status: 201));
    final avatar = GatewayProfileAvatarTransport(api: ApiClient(dio: dio));
    await expectLater(
      avatar.upload(Uint8List.fromList(List.filled(64, 1)), expectedUrl: null),
      throwsFormatException,
    );
  });

  test('does not claim photo removal without canonical server reply', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.method, 'DELETE');
      expect(options.path, '/profiles/me/avatar');
      expect(options.headers['x-avatar-expected'], startsWith('v1:'));
      return _json('{"avatarUrl":null}');
    });
    await GatewayProfileAvatarTransport(api: ApiClient(dio: dio)).remove(expectedUrl: 'https://images.masanawa.example/old.png');
  });

  test('refuses giant/empty images before making an HTTP request', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.example.test'));
    final avatar = GatewayProfileAvatarTransport(api: ApiClient(dio: dio));
    await expectLater(avatar.upload(Uint8List(0), expectedUrl: null), throwsFormatException);
    await expectLater(
      avatar.upload(Uint8List(2 * 1024 * 1024 + 1), expectedUrl: null), throwsFormatException,
    );
  });
}

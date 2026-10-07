import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/library/talk_library_http_transport.dart';

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

void main() {
  test('saved state GET uses canonical Talk saved route', () async {
    String? method;
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      method = options.method;
      path = options.path;
      return ResponseBody.fromString(
        '{"saved":true}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTalkLibraryTransport(api: ApiClient(dio: dio));
    final saved = await transport.isSaved('talk 1');

    expect(saved, isTrue);
    expect(method, 'GET');
    expect(path, '/talks/talk%201/saved');
  });

  test('save mutation posts only authoritative saved intent', () async {
    String? method;
    String? path;
    Map<String, dynamic>? body;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      method = options.method;
      path = options.path;
      body = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        '{"saved":false}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTalkLibraryTransport(api: ApiClient(dio: dio));
    final saved = await transport.setSaved('talk-1', saved: false);

    expect(saved, isFalse);
    expect(method, 'POST');
    expect(path, '/talks/talk-1/saved');
    expect(body, {'saved': false});
  });
}

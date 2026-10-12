import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_directory_http_transport.dart';
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

void main() {
  test('Explore transport accepts the current backend directory shape', () async {
    String? query;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      query = options.queryParameters['q']?.toString();
      return ResponseBody.fromString(
        '[{"characterId":"character-1","publicId":"amina","displayName":"Amina","headline":"Technology and business","avatarUrl":null,"representationLabel":"AI twin","ownerPresence":"not-present","textChatMode":"free"}]',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinDirectoryTransport(api: ApiClient(dio: dio));
    final page = await transport.search(query: 'amina');

    expect(query, 'amina');
    expect(page.items.single.publicId, 'amina');
    expect(page.items.single.bio, 'Technology and business');
    expect(page.items.single.languages, isEmpty);
    expect(page.nextCursor, isNull);
  });

  test('resolves a public twin id for shared links', () async {
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      return ResponseBody.fromString(
        '{"characterId":"character-1","publicId":"amina","displayName":"Amina","headline":"Technology","avatarUrl":null,"representationLabel":"AI twin","ownerPresence":"not-present","textChatMode":"free"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinDirectoryTransport(api: ApiClient(dio: dio));
    final twin = await transport.resolve(publicId: 'amina');

    expect(path, '/agent/twins/amina');
    expect(twin?.displayName, 'Amina');
  });

  test('returns null when a public twin link no longer resolves', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      return ResponseBody.fromString(
        '{"error":"Twin not found"}',
        404,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinDirectoryTransport(api: ApiClient(dio: dio));
    expect(await transport.resolve(publicId: 'missing'), isNull);
  });

}

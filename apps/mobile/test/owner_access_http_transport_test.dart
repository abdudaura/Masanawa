import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/owner_access/owner_access_http_transport.dart';

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

const _requestJson =
    '{"requestId":"owner-request-1","requesterUserId":"user-a","ownerUserId":"user-b","originatingCharacterId":"character-b","modality":"voice","durationMinutes":15,"priceCredits":0,"chargeMode":"trial","state":"requested","requestedAt":"2026-10-05T10:00:00Z","acceptBy":"2026-10-05T11:00:00Z","scheduledFor":null}';

void main() {
  test('owner request submits only opaque quote id, not client price', () async {
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        _requestJson,
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayOwnerAccessTransport(api: ApiClient(dio: dio));
    final request = await transport.request(
      characterId: 'character-b',
      quoteId: 'owner-quote-1',
    );

    expect(request.requestId, 'owner-request-1');
    expect(seen?['characterId'], 'character-b');
    expect(seen?['quoteId'], 'owner-quote-1');
    expect(seen?.containsKey('priceCredits'), isFalse);
    expect(seen?.containsKey('ownerEarningCredits'), isFalse);
  });

  test('owner action sends schedule as UTC', () async {
    Map<String, dynamic>? seen;
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        _requestJson.replaceFirst('"requested"', '"scheduled"'),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayOwnerAccessTransport(api: ApiClient(dio: dio));
    await transport.act(
      characterId: 'character-b',
      requestId: 'owner-request-1',
      action: 'schedule',
      scheduledFor: DateTime.utc(2026, 10, 6, 17),
    );

    expect(path, '/agent/twin/owner-access/owner-request-1/action');
    expect(seen?['action'], 'schedule');
    expect(seen?['scheduledFor'], '2026-10-06T17:00:00.000Z');
  });
}

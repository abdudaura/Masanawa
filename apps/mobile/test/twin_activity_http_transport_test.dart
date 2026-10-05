import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_activity.dart';
import 'package:masanawa/src/agents/twin_activity_http_transport.dart';
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
  test('Activity transport loads the privacy-safe owner projection', () async {
    int? seenLimit;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seenLimit = int.tryParse(options.queryParameters['limit'].toString());
      return ResponseBody.fromString(
        '{"hasTwin":true,"characterId":"character-1","summary":{"visitors":2,"conversations":1,"earningsCredits":40,"pendingOwnerRequests":1},"items":[{"eventId":"event-1","kind":"gift","status":"completed","occurredAt":"2026-10-05T10:00:00Z","amountCredits":40,"title":"Gift received","detail":"Someone blessed you through your twin."}]}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayTwinActivityTransport(api: ApiClient(dio: dio));
    final view = await transport.load(limit: 25);

    expect(seenLimit, 25);
    expect(view.summary.earningsCredits, 40);
    expect(view.items.single.kind, TwinActivityKind.gift);
  });
}

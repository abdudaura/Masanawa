import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talk_live_copilot/models.dart';
import 'package:masanawa/src/talk_live_copilot/transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final Future<ResponseBody> Function(RequestOptions) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(String body, int status) => ResponseBody.fromString(
  body, status, headers: {Headers.contentTypeHeader: ['application/json']},
);

void main() {
  test('suggestions use versioned Gateway route and encode the Talk reference', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.path, '/v1/talks/talk%2FA/ai-stage/suggestions');
      return _json('{"suggestions":[]}', 200);
    });
    expect(await GatewayHostCopilotTransport(api: ApiClient(dio: dio))
        .suggestions('talk/A'), isEmpty);
  });
  test('typed quota 429 remains a known server outcome, not a retryable unknown', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.path, '/v1/talks/talk-A/ai-stage/seats/seat-A/turns');
      expect(options.data, {
        'requestId': 'id-1', 'hostApprovedTranscript': 'Question',
      });
      return _json('{"status":"budget_exhausted","reason":"claim_budget_exhausted"}', 429);
    });
    final receipt = await GatewayHostCopilotTransport(api: ApiClient(dio: dio))
        .approveTurn(
          talkId: 'talk-A', seatId: 'seat-A', requestId: 'id-1',
          hostApprovedTranscript: 'Question',
        );
    expect(receipt.status, HostCopilotStatus.budgetExhausted);
  });

  test('rejected unknown API shape never claims a published turn', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) async => _json(
      '{"status":"delivered","reason":"all good"}', 200,
    ));
    await expectLater(
      GatewayHostCopilotTransport(api: ApiClient(dio: dio)).approveTurn(
        talkId: 'talk-A', seatId: 'seat-A', requestId: 'id-1',
        hostApprovedTranscript: 'Question',
      ),
      throwsFormatException,
    );
  });

  test('missing Gateway route is not reinterpreted as a valid denial', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) async => _json(
      '{"error":"route not found"}', 404,
    ));
    await expectLater(
      GatewayHostCopilotTransport(api: ApiClient(dio: dio)).suggestions('talk-A'),
      throwsA(isA<DioException>().having(
        (exception) => exception.response?.statusCode, 'HTTP status', 404,
      )),
    );
  });
}


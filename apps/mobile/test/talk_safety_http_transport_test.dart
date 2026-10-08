import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_safety.dart';
import 'package:masanawa/src/talks/talk_safety_http_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final ResponseBody Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async => respond(options);
  @override
  void close({bool force = false}) {}
}

void main() {
  test('persona report sends authenticated public ID and stable request key',
      () async {
    final observed = <Map<String, dynamic>>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) {
      expect(options.path, '/safety/reports');
      expect(options.method, 'POST');
      expect(options.headers['Authorization'], 'Bearer report-token');
      observed.add(Map<String, dynamic>.from(options.data as Map));
      return ResponseBody.fromString(
        '{"reportId":"report-1","accepted":true}',
        202,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    final client = ApiClient(dio: dio)..accessToken = 'report-token';
    final service = GatewayTalkSafetyTransport(api: client);
    for (var i = 0; i < 2; i++) {
      await service.reportTarget(
        targetKind: TalkSafetyTargetKind.persona,
        targetId: 'expert-wazobia',
        reason: TalkSafetyReportReason.harassment,
        detail: 'Repeated interruptions',
        clientRequestId: 'same-report-key',
      );
    }
    expect(observed, hasLength(2));
    expect(observed[0], observed[1]);
    expect(observed[0]['targetKind'], 'persona');
    expect(observed[0]['targetId'], 'expert-wazobia');
    expect(observed[0]['clientRequestId'], 'same-report-key');
  });

  test('does not treat a missing server receipt as a successful report',
      () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) => ResponseBody.fromString(
      '{"accepted":false}', 202,
      headers: {Headers.contentTypeHeader: ['application/json']},
    ));
    final service = GatewayTalkSafetyTransport(api: ApiClient(dio: dio));
    await expectLater(
      service.reportTarget(
        targetKind: TalkSafetyTargetKind.persona,
        targetId: 'twin-amina',
        reason: TalkSafetyReportReason.other,
        clientRequestId: 'report-key',
      ),
      throwsA(isA<FormatException>()),
    );
  });

  test('invalid target fails before request', () async {
    final service = GatewayTalkSafetyTransport(
      api: ApiClient(dio: Dio(BaseOptions(baseUrl: 'https://example.test'))),
    );
    await expectLater(
      service.reportTarget(
        targetKind: TalkSafetyTargetKind.persona,
        targetId: '',
        reason: TalkSafetyReportReason.fraud,
      ),
      throwsA(isA<FormatException>()),
    );
  });
}

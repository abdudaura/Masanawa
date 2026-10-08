import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';
import 'package:masanawa/src/talks/talk_ai_seat_http_transport.dart';

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
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

void main() {
  test('404 AI Seat route error is not disguised as an empty catalog', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.path, '/talks/talk-1/ai-seats');
      return _json('{"error":"route unavailable"}', status: 404);
    });
    final transport = GatewayTalkAiSeatTransport(api: ApiClient(dio: dio));

    await expectLater(
      transport.loadCandidates(talkId: 'talk-1'),
      throwsA(isA<DioException>().having(
        (error) => error.response?.statusCode,
        'statusCode',
        404,
      )),
    );
  });

  test('valid empty catalog is distinct from 404 infrastructure failure', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) async => _json('[]'));
    final transport = GatewayTalkAiSeatTransport(api: ApiClient(dio: dio));
    expect(await transport.loadCandidates(talkId: 'talk-1'), isEmpty);
  });

  test('catalog preserves authoritative explicit unavailability', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) async => _json(
      '[{"personaId":"expert-1","displayName":"Expert",'
      '"kind":"expert","seatFeeLabel":"10 Credits"}]',
    ));
    final transport = GatewayTalkAiSeatTransport(api: ApiClient(dio: dio));
    final entries = await transport.loadCandidates(talkId: 'talk-1');
    expect(entries, hasLength(1));
    expect(entries.single.isAvailable, isFalse);
    expect(entries.single.kind, TalkAiPersonaKind.expert);
  });

  test('malformed catalog entry fails rather than silently disappearing', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((_) async => _json('[null]'));
    final transport = GatewayTalkAiSeatTransport(api: ApiClient(dio: dio));
    await expectLater(
      transport.loadCandidates(talkId: 'talk-1'),
      throwsFormatException,
    );
  });
}

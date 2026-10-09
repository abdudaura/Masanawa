import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/learning/learning_progress.dart';
import 'package:masanawa/src/learning/learning_http_transport.dart';

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
  test('authenticates actual private lesson readback through shared API client',
      () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    var seen = 0;
    dio.httpClientAdapter = _Adapter((options) async {
      seen++;
      expect(options.method, 'GET');
      expect(options.uri.path, '/agent/learning/progress');
      expect(options.queryParameters['characterId'], 'character-1');
      expect(options.headers['Authorization'], 'Bearer current-user');
      return ResponseBody.fromString(
        '{"state":"available","progress":{"topic":"Fractions","goal":"Understand halves","level":"beginner","checkpoint":"Recognize halves","nextStep":"Practice addition","masteryNotes":[],"updatedAt":"2026-10-09T00:00:00.000Z"}}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    final api = ApiClient(dio: dio)..accessToken = 'current-user';
    final transport = GatewayLearningTransport(
      api: api,
      characterSessionId: 'session-1',
      authorizedRelationshipId: 'relationship-1',
    );
    final result = await transport.read(
      characterId: 'character-1',
      relationshipId: 'relationship-1',
    );
    expect(result.checkpoint!.topic, 'Fractions');
    expect(seen, 1);
  });

  test('refuses stale relationship locally before an action is transmitted',
      () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    var calls = 0;
    dio.httpClientAdapter = _Adapter((_) async {
      calls++;
      return ResponseBody.fromString('{}', 200);
    });
    final transport = GatewayLearningTransport(
      api: ApiClient(dio: dio),
      characterSessionId: 'session-1',
      authorizedRelationshipId: 'relationship-1',
    );
    await expectLater(
      transport.perform(
        characterId: 'character-1',
        relationshipId: 'relationship-old',
        command: const LearningCommand(
          action: LearningAction.practice,
          requestId: 'request-001',
          expectedUpdatedAt: null,
        ),
      ),
      throwsA(isA<ApiException>()),
    );
    expect(calls, 0);
  });

  test('sends canonical request ID and immutable Study context to Gateway',
      () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      expect(options.method, 'POST');
      expect(options.uri.path, '/agent/learning/actions');
      expect(options.headers['x-request-id'], 'request-001');
      expect(options.headers['Authorization'], 'Bearer current-user');
      final data = options.data;
      expect(data, isA<Map>());
      expect(data['characterId'], 'character-1');
      expect(data['characterSessionId'], 'session-1');
      expect(data['requestId'], 'request-001');
      expect(data['action'], 'practice');
      return ResponseBody.fromString(
        '{"state":"uncertain","code":"learning.turn_status_unknown","latest":{"state":"empty","progress":null}}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    final api = ApiClient(dio: dio)..accessToken = 'current-user';
    final result = await GatewayLearningTransport(
      api: api,
      characterSessionId: 'session-1',
      authorizedRelationshipId: 'relationship-1',
    ).perform(
      characterId: 'character-1',
      relationshipId: 'relationship-1',
      command: const LearningCommand(
        action: LearningAction.practice,
        requestId: 'request-001',
        expectedUpdatedAt: null,
      ),
    );
    expect(result.state, 'uncertain');
    expect(result.latest.checkpoint, isNull);
  });
}

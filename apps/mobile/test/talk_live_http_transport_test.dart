import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_live.dart';
import 'package:masanawa/src/talks/talk_live_http_transport.dart';

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

ResponseBody _json(String body, {int status = 200}) {
  return ResponseBody.fromString(
    body,
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );
}

void main() {
  test('connect uses canonical Talk live route', () async {
    String? path;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      return _json(
        '{"sessionId":"talk-live_test-session","talkId":"talk-1","role":"listener","state":"live","canPublishAudio":false,"canHearAudio":true,"aiGenerationAllowed":false,"reconnectGraceEndsAt":null}',
        status: 201,
      );
    });

    final transport = GatewayTalkLiveTransport(api: ApiClient(dio: dio));
    final session = await transport.connect('talk-1');

    expect(path, '/talks/talk-1/live/connect');
    expect(session.role, TalkLiveRole.listener);
    expect(session.canPublishAudio, isFalse);
  });

  test('heartbeat and disconnect send only server-issued session id', () async {
    final seen = <String, Map<String, dynamic>>{};
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      if (options.data is Map) {
        seen[options.path] = (options.data as Map).cast<String, dynamic>();
      }
      if (options.path.endsWith('/disconnect')) {
        return _json(
          '{"talkId":"talk-1","state":"reconnecting","hostConnected":false,"listenerCount":0,"aiGenerationAllowed":false,"reconnectGraceEndsAt":"2026-10-07T10:00:30Z"}',
        );
      }
      return _json(
        '{"sessionId":"talk-live_test-session","talkId":"talk-1","role":"host","state":"live","canPublishAudio":true,"canHearAudio":true,"aiGenerationAllowed":true,"reconnectGraceEndsAt":null}',
      );
    });

    final transport = GatewayTalkLiveTransport(api: ApiClient(dio: dio));
    await transport.heartbeat(
      talkId: 'talk-1',
      sessionId: 'talk-live_test-session',
    );
    await transport.disconnect(
      talkId: 'talk-1',
      sessionId: 'talk-live_test-session',
    );

    expect(
      seen['/talks/talk-1/live/heartbeat'],
      {'sessionId': 'talk-live_test-session'},
    );
    expect(
      seen['/talks/talk-1/live/disconnect'],
      {'sessionId': 'talk-live_test-session'},
    );
  });

  test('media token parses exact LiveKit credential envelope', () async {
    String? path;
    Map<String, dynamic>? body;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      body = (options.data as Map).cast<String, dynamic>();
      return _json(
        '{"server_url":"wss://live.example.test","participant_token":"token","room_name":"talk-1","participant_identity":"user:session","expires_at":"2030-01-01T00:00:00Z"}',
      );
    });

    final transport = GatewayTalkLiveTransport(api: ApiClient(dio: dio));
    final credentials = await transport.mediaToken(
      talkId: 'talk-1',
      sessionId: 'talk-live_test-session',
    );

    expect(path, '/talks/talk-1/live/media-token');
    expect(body, {'sessionId': 'talk-live_test-session'});
    expect(credentials.serverUrl, 'wss://live.example.test');
    expect(credentials.participantToken, 'token');
  });
}

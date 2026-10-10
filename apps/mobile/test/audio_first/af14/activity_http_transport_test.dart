import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/activity/talk_activity_http_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

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

GatewayTalkActivityTransport _transport(
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
  dio.httpClientAdapter = _Adapter(handler);
  return GatewayTalkActivityTransport(api: ApiClient(dio: dio));
}

void main() {
  test('unavailable authenticated Activity route fails instead of showing empty', () async {
    final transport = _transport((options) async {
      expect(options.path, '/activity');
      expect(options.queryParameters['filter'], 'all');
      expect(options.queryParameters['limit'], 60);
      return _json('{"error":"NOT_FOUND"}', status: 404);
    });

    await expectLater(
      transport.load(filter: TalkActivityFilter.all),
      throwsA(
        isA<DioException>().having(
          (error) => error.response?.statusCode,
          'statusCode',
          404,
        ),
      ),
    );
  });

  test('valid empty Activity projection remains a legitimate empty list', () async {
    final transport = _transport((options) async {
      expect(options.queryParameters['filter'], 'social');
      expect(options.queryParameters['limit'], 10);
      return _json('[]');
    });

    expect(
      await transport.load(filter: TalkActivityFilter.social, limit: 10),
      isEmpty,
    );
  });

  test('malformed Activity entry is rejected rather than silently omitted', () async {
    final transport = _transport((_) async => _json('[null]'));
    await expectLater(
      transport.load(filter: TalkActivityFilter.all),
      throwsFormatException,
    );
  });

  test('missing Activity identity cannot display an inert unread action', () async {
    final transport = _transport((_) async => _json(
      '[{"kind":"talk_invitation","title":"Private item",'
      '"detail":"Private detail","createdAt":"2026-10-10T01:00:00Z",'
      '"unread":true}]',
    ));
    await expectLater(
      transport.load(filter: TalkActivityFilter.all),
      throwsFormatException,
    );
  });

  test('malformed Activity envelope is rejected rather than marked empty', () async {
    final transport = _transport((_) async => _json('{"items":[]}'));
    await expectLater(
      transport.load(filter: TalkActivityFilter.all),
      throwsFormatException,
    );
  });

  test('authorized Activity response preserves invitation action and title', () async {
    final transport = _transport((_) async => _json(
      '[{"id":"inv-1","kind":"talk_invitation",'
      '"title":"Invitation from A","detail":"Join the Talk",'
      '"createdAt":"2026-10-10T01:00:00Z","talkId":"talk-1",'
      '"requiresAction":true,"unread":true}]',
    ));
    final items = await transport.load(filter: TalkActivityFilter.talks);
    expect(items, hasLength(1));
    expect(items.single.title, 'Invitation from A');
    expect(items.single.talkId, 'talk-1');
    expect(items.single.requiresAction, isTrue);
    expect(items.single.unread, isTrue);
  });

  test('mark as read uses canonical authenticated Activity endpoint', () async {
    final requests = <RequestOptions>[];
    final transport = _transport((options) async {
      requests.add(options);
      return _json('{"id":"activity-1","unread":false}');
    });

    await transport.markRead(activityId: 'activity-1');

    expect(requests, hasLength(1));
    expect(requests.single.method, 'POST');
    expect(requests.single.path, '/activity/activity-1/read');
  });

  test('mark as read propagates missing or unauthorized activity', () async {
    final transport = _transport((_) async => _json(
      '{"error":"ACTIVITY_NOT_FOUND"}',
      status: 404,
    ));
    await expectLater(
      transport.markRead(activityId: 'someone-else'),
      throwsA(isA<DioException>().having(
        (error) => error.response?.statusCode,
        'statusCode',
        404,
      )),
    );
  });

  test('invitation decision calls existing canonical response endpoint', () async {
    final requests = <RequestOptions>[];
    final transport = _transport((options) async {
      requests.add(options);
      return _json('{"status":"accepted"}');
    });
    await transport.respondToInvitation(talkId: 'talk-1', accept: true);
    await transport.respondToInvitation(talkId: 'talk-1', accept: false);
    expect(requests, hasLength(2));
    for (final req in requests) {
      expect(req.path, '/talks/talk-1/invitation-response');
      expect(req.method, 'POST');
    }
    expect(requests.first.data, {'action': 'accept'});
    expect(requests.last.data, {'action': 'decline'});
  });
}

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/realtime/human_dm_realtime_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.onRequest);
  final Future<ResponseBody> Function(RequestOptions request) onRequest;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => onRequest(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _reply(String json,{int status=200}) =>
    ResponseBody.fromString(json,status,headers:{
      Headers.contentTypeHeader:['application/json'],
    });

ApiClient _api(Future<ResponseBody> Function(RequestOptions) handler) {
  final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
  dio.httpClientAdapter=_Adapter(handler);
  final api=ApiClient(dio:dio);
  api.accessToken='device-owner-session';
  return api;
}

void main() {
  test('C03 uses verified bearer and private sync path, never body',() async {
    final transport=GatewayHumanDmRealtimeTransport(_api((options) async {
      expect(options.method,'GET');
      expect(options.path,'/messages/sync');
      expect(options.headers['Authorization'],'Bearer device-owner-session');
      expect(options.queryParameters['cursor'],'40');
      expect(options.queryParameters['limit'],50);
      expect(options.queryParameters['waitMs'],10000);
      return _reply('{"events":[{"eventId":"41",'
        '"conversationId":"01234567-89ab-cdef-0123-456789abcdef",'
        '"kind":"read_changed","actorUserId":"user_b",'
        '"messageId":null,"messageSequence":"24"}],'
        '"nextCursor":"41","hasMore":false,"resetRequired":false}');
    }));
    final page=await transport.poll(cursor:'40');
    expect(page.events.single.kind,HumanDmChange.readChanged);
    expect(page.events.single.messageSequence,'24');
  });

  test('first sync disables wait and requires initial server snapshot',() async {
    final transport=GatewayHumanDmRealtimeTransport(_api((options) async {
      expect(options.queryParameters.containsKey('cursor'),isFalse);
      expect(options.queryParameters['waitMs'],0);
      return _reply('{"events":[],"nextCursor":"0",'
        '"hasMore":false,"resetRequired":true}');
    }));
    final page=await transport.poll();
    expect(page.resetRequired,isTrue);
  });

  test('do not poll with a signed-out or missing bearer',() async {
    var called=false;
    final api=_api((_) async {
      called=true;
      return _reply('{}');
    });
    api.accessToken=null;
    await expectLater(
      GatewayHumanDmRealtimeTransport(api).poll(),
      throwsA(isA<ApiException>()),
    );
    expect(called,isFalse);
  });

  test('missing backend route or revoked session propagates an error',() async {
    final transport=GatewayHumanDmRealtimeTransport(_api(
      (_) async => _reply('{"error":"missing"}',status:404),
    ));
    await expectLater(transport.poll(cursor:'9'),
      throwsA(isA<DioException>().having(
        (error)=>error.response?.statusCode,'status',404,
      )));
  });

  test('malformed ordered cursor is rejected before server acknowledgment',() async {
    final transport=GatewayHumanDmRealtimeTransport(_api((_) async =>
      _reply('{"events":[{"eventId":"12",'
        '"conversationId":"c","kind":"access_changed",'
        '"actorUserId":"u","messageId":null,"messageSequence":null},'
        '{"eventId":"11","conversationId":"c","kind":"access_changed",'
        '"actorUserId":"u","messageId":null,"messageSequence":null}],'
        '"nextCursor":"11","hasMore":false,"resetRequired":false}'),
    ));
    await expectLater(transport.poll(cursor:'10'),throwsFormatException);
  });
}

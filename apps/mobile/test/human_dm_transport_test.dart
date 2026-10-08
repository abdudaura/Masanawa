import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/human_dm_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final ResponseBody Function(RequestOptions request) handler;
  @override
  Future<ResponseBody> fetch(RequestOptions options,Stream<List<int>>? requestStream,Future<void>? cancelFuture) async => handler(options);
  @override
  void close({bool force=false}){}
}
ResponseBody json(String body,int status)=>ResponseBody.fromString(body,status,headers:{
  Headers.contentTypeHeader:['application/json']});
void main() {
  test('human DM uses canonical token interceptor and typed server response',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='secret-test-token';
    dio.httpClientAdapter=_Adapter((req){
      expect(req.headers['Authorization'],'Bearer secret-test-token');
      expect(req.path,'/v1/messages/conversations');
      return json('{"conversationId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',201);
    });
    final id=await GatewayHumanDmTransport(api).open('user_bob');
    expect(id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
  test('403 privacy rejection stays a failure, not optimistic delivery',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='token';
    dio.httpClientAdapter=_Adapter((_)=>
      json('{"error":{"code":"messages.send_forbidden"}}',403));
    await expectLater(GatewayHumanDmTransport(api).send('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      clientMessageId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',text:'Hello'),
      throwsA(isA<ApiException>().having((e)=>e.statusCode,'status',403)));
  });
  test('missing required history keys fail closed instead of empty fake list',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='token';
    dio.httpClientAdapter=_Adapter((_)=>json('{"messages":"not-a-list"}',200));
    await expectLater(GatewayHumanDmTransport(api).history('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      throwsFormatException);
  });
}

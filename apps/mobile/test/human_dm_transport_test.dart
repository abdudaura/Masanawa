import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/human_dm_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);
  final ResponseBody Function(RequestOptions request) handler;
  @override
  Future<ResponseBody> fetch(RequestOptions options,Stream<Uint8List>? requestStream,Future<void>? cancelFuture) async => handler(options);
  @override
  void close({bool force=false}){}
}
ResponseBody json(String body,int status)=>ResponseBody.fromString(body,status,headers:{
  Headers.contentTypeHeader:['application/json']});
void main() {
  test('canonical body and decimal sequence preserve the server acknowledgment', () async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='token';
    const thread='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const intent='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    dio.httpClientAdapter=_Adapter((request) {
      expect(request.method,'POST');
      expect(request.path,'/messages/$thread');
      expect(request.data is String ? jsonDecode(request.data as String) : request.data,
          {'clientRequestId':intent,'body':'Hello'});
      return json(jsonEncode({
        'conversationId':thread,'messageId':'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'sequence':'104','clientRequestId':intent,'senderUserId':'user_alice',
        'body':'Hello','createdAt':'2026-10-08T00:00:00Z',
        'editedAt':null,'deletedAt':null,
      }),201);
    });
    final message=await GatewayHumanDmTransport(api).send(thread,
      clientMessageId:intent,text:'Hello');
    expect(message.sequence,104);
    expect(message.clientMessageId,intent);
    expect(message.text,'Hello');
  });
  test('read uses canonical decimal cursor and real returned server receipt', () async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='token';
    const thread='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    dio.httpClientAdapter=_Adapter((request) {
      expect(request.method,'PUT');
      expect(request.path,'/messages/$thread/read');
      expect(request.data is String ? jsonDecode(request.data as String) : request.data,
          {'throughSequence':'104'});
      return json('{"lastReadSequence":"104"}',200);
    });
    expect(await GatewayHumanDmTransport(api).read(thread,104),104);
  });
  test('human DM uses canonical token interceptor and typed server response',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://gateway.example.test'));
    final api=ApiClient(dio:dio)..accessToken='secret-test-token';
    dio.httpClientAdapter=_Adapter((req){
      expect(req.headers['Authorization'],'Bearer secret-test-token');
      expect(req.path,'/messages');
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


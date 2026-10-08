import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/messages/human_messages_transport.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(RequestOptions options,Stream<List<int>>? requestStream,
    Future<void>? cancelFuture)=>respond(options);
  @override
  void close({bool force=false}) {}
}
ResponseBody _json(String body)=>ResponseBody.fromString(body,200,
  headers:{Headers.contentTypeHeader:['application/json']});
const _message='{"conversationId":"conv-12345678","messageId":"message-12345",'
  '"senderUserId":"person-a","text":"Hello","revision":1,'
  '"createdAt":"2026-10-08T10:00:00.000Z","editedAt":null,"deletedAt":null}';
void main(){
  test('human DM POST transmits a stable client request id with only approved fields',() async {
    String? url;
    dynamic payload;
    final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.httpClientAdapter=_Adapter((options)async{
      url=options.path;payload=options.data;
      return _json(_message);
    });
    final api=ApiClient(dio:dio)..accessToken='session-token';
    final transport=GatewayHumanMessagesTransport(api);
    final sent=await transport.send(conversationId:'conv-12345678',requestId:'request-1234',text:'Hello');
    expect(sent.text,'Hello');
    expect(url,'/messages/conversations/conv-12345678/messages');
    expect(payload,{'requestId':'request-1234','text':'Hello'});
  });
  test('typed history parses only server-owned messages and durable next cursor',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.httpClientAdapter=_Adapter((options)async{
      expect(options.method,'GET');
      expect(options.path,'/messages/conversations/conv-12345678/messages');
      expect(options.queryParameters['before'],'cursor-from-server');
      return _json('{"messages":['+_message+'],"nextCursor":"cursor-old"}');
    });
    final transport=GatewayHumanMessagesTransport(ApiClient(dio:dio));
    final page=await transport.history(conversationId:'conv-12345678',before:'cursor-from-server');
    expect(page.messages.single.messageId,'message-12345');
    expect(page.nextCursor,'cursor-old');
  });
  test('incorrect deleted-body and malformed message revision fail closed',() {
    final values=<String,dynamic>{
      'conversationId':'conv-12345678','messageId':'message-12345',
      'senderUserId':'person-a','text':'Hello',
      'createdAt':'2026-10-08T10:00:00Z','editedAt':null,'deletedAt':null,'revision':1,
    };
    expect(()=>HumanMessageDto.fromJson({...values,'revision':0}),throwsFormatException);
    expect(()=>HumanMessageDto.fromJson({...values,
      'deletedAt':'2026-10-08T10:00:01Z'}),throwsFormatException);
    expect(()=>HumanMessageDto.fromJson({...values,'conversationId':''}),throwsFormatException);
  });
  test('edit/delete require expected revisions and target exact message',() async {
    final paths=<String>[];
    final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.httpClientAdapter=_Adapter((options)async{
      paths.add('${options.method} ${options.path}');
      if(options.method=='PATCH'){
        expect(options.data,{'text':'Changed','expectedRevision':1});
      }else{
        expect(options.queryParameters['expectedRevision'],1);
      }
      return _json('{"conversationId":"conv-12345678","messageId":"message-12345",'
        '"senderUserId":"person-a","text":"","revision":2,'
        '"createdAt":"2026-10-08T10:00:00Z","editedAt":null,'
        '"deletedAt":"2026-10-08T10:01:00Z"}');
    });
    final transport=GatewayHumanMessagesTransport(ApiClient(dio:dio));
    await transport.edit(conversationId:'conv-12345678',messageId:'message-12345',
      expectedRevision:1,text:'Changed');
    await transport.delete(conversationId:'conv-12345678',messageId:'message-12345',
      expectedRevision:1);
    expect(paths,['PATCH /messages/conversations/conv-12345678/messages/message-12345',
      'DELETE /messages/conversations/conv-12345678/messages/message-12345']);
  });
}

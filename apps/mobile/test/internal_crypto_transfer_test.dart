import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/finance/internal_crypto_transfer.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.run);
  final Future<ResponseBody> Function(RequestOptions) run;
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<List<int>>? requestStream, Future<void>? cancelFuture) => run(options);
  @override
  void close({bool force=false}) {}
}
ResponseBody _json(String value,{int status=200}) =>
  ResponseBody.fromString(value,status,headers:{
    Headers.contentTypeHeader:['application/json']});
const _quote='{'
 '"requestId":"request_0199f499-8c22-7a12-9a18-07a317745ebb",'
 '"recipientLabel":"user@example.com","asset":"USDT","network":"tron",'
 '"amount":"3.000000000000000001","fee":"0","status":"quoted",'
 '"expiresAt":"2099-01-01T00:00:00.000Z","completedAt":null,'
 '"confirmationToken":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'
 '}';
const _done='{'
 '"requestId":"request_0199f499-8c22-7a12-9a18-07a317745ebb",'
 '"recipientLabel":"user@example.com","asset":"USDT","network":"tron",'
 '"amount":"3.000000000000000001","fee":"0","status":"completed",'
 '"expiresAt":"2099-01-01T00:00:00.000Z","completedAt":"2026-10-08T11:30:00.000Z"'
 '}';
void main(){
  test('quote JSON preserves exact 18-place assets and requires server proof',(){
    final quote=InternalCryptoTransferQuote.fromJson({
      'requestId':'request_x','recipientLabel':'user@example.com',
      'asset':'USDT','network':'tron','amount':'3.000000000000000001',
      'fee':'0','status':'quoted','expiresAt':'2099-01-01T00:00:00Z',
      'completedAt':null,'confirmationToken':''.padRight(64,'a'),
    });
    expect(quote.amount,'3.000000000000000001');
    expect(quote.confirmationToken,''.padRight(64,'a'));
    expect(() => InternalCryptoTransferQuote.fromJson({
      'requestId':'request_x','recipientLabel':'user@example.com',
      'asset':'USDT','network':'tron','amount':3.0,'fee':'0',
      'status':'completed','expiresAt':'2099-01-01T00:00:00Z',
      'completedAt':null,
    }),throwsFormatException);
  });
  test('quote, status and confirm use request-scoped distinct routes and token only at final step',()async{
    final requests=<RequestOptions>[];
    final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.httpClientAdapter=_Adapter((options) async{
      requests.add(options);
      return _json(options.path.endsWith('/confirm')?_done:_quote);
    });
    final api=ApiClient(dio:dio)..accessToken='scope-a';
    final t=GatewayInternalCryptoTransferTransport(dio:api.dio,
      baseUrl:'https://example.test');
    final quote=await t.quote(requestId:'request_0199f499-8c22-7a12-9a18-07a317745ebb',
      recipient:'user@example.com',providerCode:'USDTTRC20',amount:'3.000000000000000001');
    expect(requests[0].path,'/v1/financial/crypto/internal-transfers/quotes');
    expect(requests[0].data,containsPair('recipient','user@example.com'));
    expect((requests[0].data as Map).containsKey('senderUserId'),false);
    expect(requests[0].headers['Authorization'],'Bearer scope-a');
    final reread=await t.read(quote.requestId);
    expect(reread!.requestId,quote.requestId);
    final confirmed=await t.confirm(quote.requestId,quote.confirmationToken!);
    expect(confirmed.completed,true);
    expect(requests[2].data,{'confirmationToken':''.padRight(64,'a')});
    expect(requests[2].path,endsWith('/confirm'));
  });
  test('404 readback is not a fabricated successful transfer',()async{
    final dio=Dio();
    dio.httpClientAdapter=_Adapter((options) async=>
      _json('{"error":"crypto.transfer.quote_not_found"}',status:404));
    final result=await GatewayInternalCryptoTransferTransport(dio:dio,
      baseUrl:'https://example.test').read('request_missing');
    expect(result,isNull);
  });
  test('an uncertain 503 confirmation never silently becomes completed',()async{
    final dio=Dio();
    dio.httpClientAdapter=_Adapter((_) async=>_json('{"error":"not_qualified"}',status:503));
    final transport=GatewayInternalCryptoTransferTransport(dio:dio,
      baseUrl:'https://example.test');
    await expectLater(transport.confirm('request_1',''.padRight(64,'a')),
      throwsA(isA<DioException>()));
  });
}

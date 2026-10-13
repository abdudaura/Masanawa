import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/finance/msn_funding_transport.dart';

final pending = <String, dynamic>{
  'quoteId':'quote-1','fundingReference':'fund-1',
  'fundingRail':'NGN_FLUTTERWAVE','ngnFundingKobo':'15025',
  'backingAsset':'USDTTRC20','backingNetwork':'tron',
  'state':'fiat_verified_backing_pending','issuedMsnMicro':null,
};

void main() {
  test('read-only funding readback uses existing current bearer and exact amounts',
      () async {
    final sent = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
      sent.add(options);
      handler.resolve(Response<Map<String,dynamic>>(
        requestOptions:options,statusCode:200,data:{'items':[pending]},
      ));
    }));
    final t = GatewayMsnFundingTransport(
      dio:dio,baseUrl:'https://gateway.example/',
      readAccessToken:()=> 'scoped',
    );
    final results=await t.read();
    expect(results,hasLength(1));
    expect(results.single.statusLabel,'Payment verified · backing pending');
    expect(results.single.issuedAmount,isNull);
    expect(sent.single.uri.toString(),
        'https://gateway.example/v1/wallet/msn/funding');
    expect(sent.single.headers['Authorization'],'Bearer scoped');
    expect(sent.single.method,'GET');
    expect(sent.single.followRedirects,isFalse);
  });

  test('never sends anonymous funding requests',() async {
    var calls=0;
    final dio=Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest:(opts,handler){
      calls++;
      handler.reject(DioException(requestOptions:opts));
    }));
    final t=GatewayMsnFundingTransport(
      dio:dio,baseUrl:'https://gateway.example',
      readAccessToken:()=>null,
    );
    await expectLater(t.read(),throwsA(isA<ApiException>()
        .having((e)=>e.statusCode,'statusCode',401)));
    expect(calls,0);
  });

  test('stale bearer response cannot be reused by another signed-in account',
      () async {
    var active='fan-A';
    final dio=Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest:(opts,handler){
      active='fan-B';
      handler.resolve(Response<Map<String,dynamic>>(
        requestOptions:opts,statusCode:200,data:{'items':[pending]},
      ));
    }));
    final t=GatewayMsnFundingTransport(
      dio:dio,baseUrl:'https://gateway.example',
      readAccessToken:()=>active,
    );
    await expectLater(t.read(),throwsA(isA<ApiException>()
        .having((e)=>e.statusCode,'statusCode',401)));
  });

  test('only typed status can display issued MSN: never convert NGN to MSN',() {
    final operation=MsnFundingOperation.fromJson(pending);
    expect(operation.ngnFundingKobo,'15025');
    expect(operation.issuedAmount,isNull);
    final minted=MsnFundingOperation.fromJson({
      ...pending,'state':'backed_issued','issuedMsnMicro':'2000001',
    });
    expect(minted.issuedAmount,'2.000001');
    for(final bad in [
      {...pending,'state':'paid'},
      {...pending,'state':'backed_issued'},
      {...pending,'issuedMsnMicro':'123456'},
      {...pending,'ngnFundingKobo':15025},
      {...pending,'ngnFundingKobo':'150.25'},
      {...pending,'fundingRail':'NOWPAYMENTS_CRYPTO'},
      {...pending,'state':'backed_issued','issuedMsnMicro':'1000000.01'},
    ]){
      expect(()=>MsnFundingOperation.fromJson(bad),throwsFormatException);
    }
    expect(()=>MsnFundingOperation.fromJson({
      ...pending,'fundingRail':'NOWPAYMENTS_CRYPTO','ngnFundingKobo':null,
      'state':'awaiting_verified_funding',
    }),returnsNormally);
  });

  test('unavailable funding route preserves failure, not empty balances',() async {
    final dio=Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest:(opts,handler){
      handler.reject(DioException(
        requestOptions:opts,
        response:Response(requestOptions:opts,statusCode:404),
        type:DioExceptionType.badResponse,
      ));
    }));
    final t=GatewayMsnFundingTransport(
      dio:dio,baseUrl:'https://gateway.example',
      readAccessToken:()=> 'token',
    );
    await expectLater(t.read(),throwsA(isA<ApiException>()
        .having((e)=>e.statusCode,'statusCode',404)));
  });

  test('rejects malformed payloads and too many funding rows',() async {
    for(final data in [
      <String,dynamic>{'items':'wrong'},
      <String,dynamic>{'items':[{'state':'paid'}]},
      <String,dynamic>{'items':List.filled(21,pending)},
    ]){
      final dio=Dio();
      dio.interceptors.add(InterceptorsWrapper(onRequest:(opts,handler){
        handler.resolve(Response<Map<String,dynamic>>(
          requestOptions:opts,statusCode:200,data:data,
        ));
      }));
      final t=GatewayMsnFundingTransport(
        dio:dio,baseUrl:'https://gateway.example',
        readAccessToken:()=> 'token',
      );
      await expectLater(t.read(),throwsA(isA<ApiException>()));
    }
  });
}

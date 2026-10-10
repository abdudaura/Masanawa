import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/finance/msn_balance_transport.dart';

void main() {
  test('reads exact micro-units with current bearer session, no NGN balance', () async {
    final sent = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        sent.add(options);
        handler.resolve(Response<Map<String, dynamic>>(
          requestOptions: options,
          statusCode: 200,
          data: {'asset': 'MSN', 'spendableMicro': '12345678901234567890123456789'},
        ));
      },
    ));
    final transport = GatewayMsnBalanceTransport(
      dio: dio, baseUrl: 'https://gateway.example/',
      readAccessToken: () => 'scoped-session',
    );
    final balance = await transport.read();
    expect(balance.spendableMicro, '12345678901234567890123456789');
    expect(balance.displayAmount, '12345678901234567890123.456789');
    expect(sent, hasLength(1));
    expect(sent.single.uri.toString(), 'https://gateway.example/v1/wallet/msn');
    expect(sent.single.headers['Authorization'], 'Bearer scoped-session');
    expect(sent.single.followRedirects, isFalse);
    expect(sent.single.method, 'GET');
    expect(sent.single.uri.toString(), isNot(contains('NGN')));
  });

  test('does not send an unauthenticated balance request', () async {
    var sent = 0;
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      sent++;
      handler.reject(DioException(requestOptions: options));
    }));
    final t = GatewayMsnBalanceTransport(
      dio: dio, baseUrl: 'https://gateway.example',
      readAccessToken: () => null,
    );
    await expectLater(t.read(), throwsA(isA<ApiException>().having(
      (e) => e.statusCode, 'statusCode', 401)));
    expect(sent, 0);
  });

  test('rejects fabricated, imprecise and misleading balance payloads', () {
    for (final value in <dynamic>['001', '-1', '1e6', '2.000001', 1000000, null]) {
      expect(() => MsnBalance.fromJson({'asset': 'MSN', 'spendableMicro': value}),
          throwsFormatException);
    }
    expect(
      () => MsnBalance.fromJson({'asset': 'NGN', 'spendableMicro': '1000000'}),
      throwsFormatException,
    );
    expect(
      MsnBalance.fromJson({'asset': 'MSN', 'spendableMicro': '0'}).displayAmount,
      '0',
    );
    expect(
      MsnBalance.fromJson({'asset': 'MSN', 'spendableMicro': '1230000'}).displayAmount,
      '1.23',
    );
  });

  test('fails closed when MSN route is not mounted', () async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) => handler.reject(DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 404),
        type: DioExceptionType.badResponse,
      )),
    ));
    final t = GatewayMsnBalanceTransport(
      dio: dio, baseUrl: 'https://gateway.example',
      readAccessToken: () => 'session',
    );
    await expectLater(t.read(), throwsA(isA<ApiException>().having(
      (e) => e.statusCode, 'statusCode', 404)));
  });
}

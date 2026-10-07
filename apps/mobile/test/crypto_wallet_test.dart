import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/finance/crypto_models.dart';
import 'package:masanawa/src/finance/crypto_transport.dart';

class _CryptoGatewayAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final path = options.uri.path;
    final body = switch ((options.method, path)) {
      ('GET', '/v1/financial/capabilities') => {
          'deposits': true,
          'withdrawals': true,
          'conversions': true,
          'fiatOnRamp': true,
          'fiatCurrencies': ['NGN', 'USD'],
          'fiatSettlementProviderCode': 'USDTTRC20',
          'payoutReason': null,
          'conversionReason': null,
          'fiatOnRampReason': null,
        },
      ('GET', '/v1/financial/crypto/routes') => {
          'routes': [
            {
              'providerCode': 'USDTTRC20',
              'asset': 'USDT',
              'network': 'tron',
            },
          ],
        },
      ('GET', '/v1/financial/crypto/conversion-routes') => {
          'routes': [
            {
              'providerCode': 'USDTTRC20',
              'asset': 'USDT',
              'network': 'tron',
            },
            {
              'providerCode': 'BTC',
              'asset': 'BTC',
              'network': null,
            },
          ],
        },
      ('GET', '/v1/financial/crypto/balances/USDTTRC20') => {
          'providerCode': 'USDTTRC20',
          'amount': '12.340000',
        },
      ('GET', '/v1/financial/crypto/history') => {
          'intents': [
            _intent(operation: 'deposit'),
          ],
        },
      ('GET', '/v1/financial/crypto/intents/request_missing') => null,
      ('POST', '/v1/financial/crypto/deposits') =>
        _intent(operation: 'deposit', payAddress: 'deposit-address'),
      ('POST', '/v1/financial/crypto/purchases') => {
          'requestId': 'request_buy',
          'fiatAmount': '1500',
          'fiatCurrency': 'NGN',
          'settlementAsset': 'USDTTRC20',
          'settlementNetwork': 'tron',
          'cryptoAmount': null,
          'status': 'awaiting_payment',
          'providerInvoiceId': 'invoice-1',
          'providerPaymentId': null,
          'checkoutUrl': 'https://nowpayments.io/payment/?iid=invoice-1',
          'outcomeUnknown': false,
        },
      ('POST', '/v1/financial/crypto/purchases/request_buy/refresh') => {
          'requestId': 'request_buy',
          'fiatAmount': '1500',
          'fiatCurrency': 'NGN',
          'settlementAsset': 'USDTTRC20',
          'settlementNetwork': 'tron',
          'cryptoAmount': '1.234567',
          'status': 'succeeded',
          'providerInvoiceId': 'invoice-1',
          'providerPaymentId': 'payment-1',
          'checkoutUrl': 'https://nowpayments.io/payment/?iid=invoice-1',
          'outcomeUnknown': false,
        },
      ('POST', '/v1/financial/crypto/withdrawals/quote') => {
          'providerCode': 'USDTTRC20',
          'amount': '10',
          'destinationAddress': 'wallet-address',
          'minimumAmount': '1',
          'networkFee': '0.1',
          'networkFeeMode': 'receiver',
          'feePayer': 'user',
          'estimatedReceiveAmount': '9.9',
          'quotedAt': '2026-10-05T00:00:00Z',
        },
      ('POST', '/v1/financial/crypto/withdrawals') =>
        _intent(operation: 'withdraw', providerPayoutId: 'batch-1'),
      ('POST', '/v1/financial/crypto/withdrawals/request_test/refresh') =>
        _intent(
          operation: 'withdraw',
          status: 'succeeded',
          providerPayoutId: 'batch-1',
        ),
      ('POST', '/v1/financial/crypto/conversions/quote') => {
          'providerCode': 'USDTTRC20',
          'targetProviderCode': 'BTC',
          'amount': '10',
          'minimumAmount': '1',
          'estimatedTargetAmount': '0.00016',
          'quotedAt': '2026-10-05T00:00:00Z',
        },
      ('POST', '/v1/financial/crypto/conversions') =>
        _intent(
          operation: 'convert',
          targetAsset: 'BTC',
          providerConversionId: 'conversion-1',
        ),
      ('POST', '/v1/financial/crypto/conversions/request_test/refresh') =>
        _intent(
          operation: 'convert',
          targetAsset: 'BTC',
          status: 'succeeded',
          providerConversionId: 'conversion-1',
          providerTargetAmount: '0.00016',
        ),
      _ => <String, dynamic>{},
    };

    if (body == null) {
      return ResponseBody.fromString(
        jsonEncode({'error': {'code': 'NOT_FOUND'}}),
        404,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }

    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  static Map<String, dynamic> _intent({
    required String operation,
    String status = 'processing',
    String? payAddress,
    String? providerPayoutId,
    String? providerConversionId,
    String? providerTargetAmount,
    String? targetAsset,
  }) {
    return {
      'requestId': 'request_test',
      'operation': operation,
      'asset': 'USDTTRC20',
      'network': 'tron',
      'amount': '10.000000',
      'targetAsset': targetAsset,
      'targetNetwork': null,
      'destinationAddress':
          operation == 'withdraw' ? 'wallet-address' : null,
      'status': status,
      'providerPaymentId': operation == 'deposit' ? 'payment-1' : null,
      'providerPayoutId': providerPayoutId,
      'providerConversionId': providerConversionId,
      'providerTargetAmount': providerTargetAmount,
      'payAddress': payAddress,
      'providerPayAmount': payAddress == null ? null : '10',
      'providerNetworkFee': operation == 'withdraw' ? '0.1' : null,
      'withdrawalFeePayer': operation == 'withdraw' ? 'user' : null,
      'createdAt': '2026-10-05T00:00:00Z',
      'updatedAt': '2026-10-05T00:00:01Z',
    };
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('crypto models preserve exact decimal strings and network identity', () {
    final intent = CryptoIntent.fromJson({
      'requestId': 'request_test',
      'operation': 'convert',
      'asset': 'USDTTRC20',
      'network': 'tron',
      'amount': '10.000000000000000001',
      'targetAsset': 'BTC',
      'targetNetwork': null,
      'destinationAddress': null,
      'status': 'succeeded',
      'providerPaymentId': null,
      'providerPayoutId': null,
      'providerConversionId': 'conversion-1',
      'providerTargetAmount': '0.00000001',
      'payAddress': null,
      'providerPayAmount': null,
      'providerNetworkFee': null,
      'withdrawalFeePayer': null,
      'createdAt': '2026-10-05T00:00:00Z',
      'updatedAt': '2026-10-05T00:00:01Z',
    });
    expect(intent.amount, '10.000000000000000001');
    expect(intent.providerTargetAmount, '0.00000001');
    expect(intent.targetAsset, 'BTC');
    expect(intent.terminal, isTrue);

    final route = CryptoRoute.fromJson({
      'providerCode': 'USDTTRC20',
      'asset': 'USDT',
      'network': 'tron',
    });
    expect(route.label, 'USDT · tron');
  });

  test('crypto transport uses the canonical authenticated Gateway contract', () async {
    final adapter = _CryptoGatewayAdapter();
    final dio = Dio(
      BaseOptions(
        validateStatus: (status) =>
            status != null && status >= 200 && status < 300,
      ),
    );
    dio.httpClientAdapter = adapter;

    final transport = MasanawaCryptoWalletTransport(
      dio: dio,
      baseUrl: 'https://gateway.test',
      readAccessToken: () => 'private-user-token',
    );

    final capabilities = await transport.capabilities();
    expect(capabilities.conversions, isTrue);
    expect(capabilities.fiatOnRamp, isTrue);
    expect(capabilities.fiatCurrencies, ['NGN', 'USD']);
    expect(capabilities.fiatSettlementProviderCode, 'USDTTRC20');
    expect((await transport.depositRoutes()).single.providerCode, 'USDTTRC20');
    expect((await transport.conversionRoutes()).length, 2);
    expect((await transport.balance('USDTTRC20')).amount, '12.34');
    expect((await transport.history()).single.operation, 'deposit');
    expect(await transport.intent('request_missing'), isNull);

    final deposit = await transport.createDeposit(
      requestId: 'request_test',
      providerCode: 'USDTTRC20',
      amount: '10',
    );
    expect(deposit.payAddress, 'deposit-address');

    final purchase = await transport.createFiatPurchase(
      requestId: 'request_buy',
      fiatAmount: '1500',
      fiatCurrency: 'NGN',
    );
    expect(purchase.providerInvoiceId, 'invoice-1');
    expect(purchase.checkoutUrl, 'https://nowpayments.io/payment/?iid=invoice-1');
    expect(purchase.settlementAsset, 'USDTTRC20');
    final settledPurchase = await transport.refreshFiatPurchase('request_buy');
    expect(settledPurchase.status, 'succeeded');
    expect(settledPurchase.cryptoAmount, '1.234567');

    final withdrawalQuote = await transport.quoteWithdrawal(
      providerCode: 'USDTTRC20',
      amount: '10',
      destinationAddress: 'wallet-address',
    );
    expect(withdrawalQuote.networkFee, '0.1');
    expect(withdrawalQuote.networkFeeMode, 'receiver');
    expect(withdrawalQuote.feePayer, 'user');
    expect(withdrawalQuote.estimatedReceiveAmount, '9.9');

    await transport.createWithdrawal(
      requestId: 'request_test',
      providerCode: 'USDTTRC20',
      amount: '10',
      destinationAddress: 'wallet-address',
    );
    expect((await transport.refreshWithdrawal('request_test')).status, 'succeeded');

    final conversionQuote = await transport.quoteConversion(
      providerCode: 'USDTTRC20',
      targetProviderCode: 'BTC',
      amount: '10',
    );
    expect(conversionQuote.estimatedTargetAmount, '0.00016');

    await transport.createConversion(
      requestId: 'request_test',
      providerCode: 'USDTTRC20',
      targetProviderCode: 'BTC',
      amount: '10',
    );
    final conversion = await transport.refreshConversion('request_test');
    expect(conversion.status, 'succeeded');
    expect(conversion.providerTargetAmount, '0.00016');

    final paths = adapter.requests.map((request) => request.uri.path).toList();
    expect(paths, contains('/v1/financial/crypto/purchases'));
    expect(
      paths,
      contains('/v1/financial/crypto/purchases/request_buy/refresh'),
    );
    expect(paths, contains('/v1/financial/crypto/withdrawals/quote'));
    expect(paths, contains('/v1/financial/crypto/conversions/quote'));
    expect(paths, contains('/v1/financial/crypto/conversion-routes'));
    expect(paths.where((path) => path.contains('/verify')), isEmpty);

    for (final request in adapter.requests) {
      expect(request.headers['Authorization'], 'Bearer private-user-token');
      expect(request.uri.host, 'gateway.test');
    }
  });
}

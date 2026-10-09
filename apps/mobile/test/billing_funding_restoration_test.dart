import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/screens/billing/billing_screen.dart';

class _BillingAdapter implements HttpClientAdapter {
  _BillingAdapter(this.handle);
  final Future<ResponseBody> Function(RequestOptions) handle;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handle(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Map<String, dynamic> document, [int code = 200]) {
  return ResponseBody.fromString(
    jsonEncode(document),
    code,
    headers: {Headers.contentTypeHeader: ['application/json']},
  );
}

Map<String, dynamic> _quote() => {
      'quoteId': 'quote-1',
      'revision': 1,
      'categoryCode': 'AIRTIME',
      'billerCode': 'bill-1',
      'itemCode': 'airtime-1',
      'itemName': 'Airtime',
      'customerId': '07010102053',
      'serviceAmountKobo': 10000,
      'feeAmountKobo': 0,
      'totalAmountKobo': 10000,
      'currency': 'NGN',
      'state': 'confirmed',
      'expiresAt': DateTime.now().toUtc().add(const Duration(minutes: 15)).toIso8601String(),
      'checkoutUrl': null,
      'providerReference': null,
      'billProviderReference': null,
      'fulfillmentReference': null,
      'refundReference': null,
      'createdAt': '2026-10-08T05:00:00Z',
      'updatedAt': '2026-10-08T05:00:00Z',
    };

Map<String, dynamic> _view() => {
      'quote': _quote(),
      'phase': 'quoted',
      'checkoutUrl': null,
      'purchase': null,
    };

Map<String, dynamic> _status({required bool pending}) => {
      'balanceKobo': 0,
      'balance': '0',
      'phase': pending ? 'awaiting-funds' : 'processing',
      'quoteId': 'quote-1',
      'funding': pending ? {
        'fundingReference': 'funding-1',
        'amountKobo': 10000,
        'accountNumber': '0001112223',
        'bankName': 'Example Bank',
        'expiresAt': DateTime.now().toUtc().add(const Duration(minutes: 10)).toIso8601String(),
      } : null,
      'purchase': null,
    };

void main() {
  test('restored funding GET is bearer-authenticated and read-only', () async {
    final seen = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _BillingAdapter((options) async {
      seen.add('${options.method} ${options.path} ${options.headers['Authorization']}');
      return _json(_status(pending: true));
    });
    final api = ApiClient(dio: dio)..accessToken = 'owner-session';
    final view = await api.billingWalletStatus('quote-1');
    expect(view.phase, 'awaiting-funds');
    expect(view.funding?.fundingReference, 'funding-1');
    expect(seen, ['GET /v1/commerce/bills/quotes/quote-1/wallet-status Bearer owner-session']);
  });

  testWidgets('history restores current account, then refresh removes stale bank details',
      (tester) async {
    var statusReads = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _BillingAdapter((options) async {
      if (options.path == '/v1/commerce/bills/categories') {
        return _json({'categories': <dynamic>[]});
      }
      if (options.path == '/v1/commerce/bills/quotes') {
        return _json({'quotes': [_view()]});
      }
      if (options.path == '/v1/commerce/bills/quotes/quote-1') {
        return _json(_view());
      }
      if (options.path == '/v1/commerce/bills/quotes/quote-1/wallet-status') {
        statusReads++;
        return _json(_status(pending: statusReads == 1));
      }
      return _json({'error': 'not_found'}, 404);
    });
    final api = ApiClient(dio: dio)..accessToken = 'owner-session';
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, home: BillingScreen()),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Airtime'));
    await tester.pumpAndSettle();
    expect(find.text('Example Bank'), findsOneWidget);
    expect(find.text('0001112223'), findsOneWidget);
    expect(statusReads, 1);

    await tester.tap(find.text('Refresh status'));
    await tester.pumpAndSettle();
    expect(statusReads, 2);
    expect(find.text('0001112223'), findsNothing);
    expect(find.textContaining('do not send another payment'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed funding status retrieval never keeps old bank instructions',
      (tester) async {
    var reads = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _BillingAdapter((options) async {
      if (options.path == '/v1/commerce/bills/categories') {
        return _json({'categories': <dynamic>[]});
      }
      if (options.path == '/v1/commerce/bills/quotes') {
        return _json({'quotes': [_view()]});
      }
      if (options.path == '/v1/commerce/bills/quotes/quote-1') {
        return _json(_view());
      }
      if (options.path.endsWith('/wallet-status')) {
        reads++;
        return reads == 1
            ? _json(_status(pending: true))
            : _json({'error': 'billing_wallet_status_unavailable'}, 503);
      }
      return _json({'error': 'not_found'}, 404);
    });
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(ApiClient(dio: dio))],
      child: const MaterialApp(localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, home: BillingScreen()),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Airtime'));
    await tester.pumpAndSettle();
    expect(find.text('0001112223'), findsOneWidget);

    await tester.tap(find.text('Refresh status'));
    await tester.pumpAndSettle();
    expect(find.text('0001112223'), findsNothing);
    expect(find.textContaining('Could not'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}

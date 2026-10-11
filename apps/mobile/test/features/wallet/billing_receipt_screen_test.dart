import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/wallet/billing_receipt.dart';
import 'package:masanawa/src/features/wallet/billing_receipt_screen.dart';

class _Reader implements BillReceiptReader {
  _Reader(this.load);
  final Future<BillReceipt> Function(String, bool) load;
  @override
  Future<BillReceipt> read(String reference, {bool refresh = false}) =>
      load(reference, refresh);
}

const _pending = BillReceipt(
  reference: 'bill-1',
  status: BillReceiptStatus.processing,
  title: 'Electricity',
  summary: 'Provider checking',
  rows: [BillReceiptRow('Reference', 'bill-1')],
  canRefresh: true,
);

void main() {
  test('fail closed on malformed receipt identity, status and data', () {
    final valid = <String, Object?>{
      'fulfillmentReference': 'bill-1',
      'billerCode': 'ELEC', 'itemCode': 'E01',
      'itemName': 'Electricity', 'customerId': 'meter-12',
      'customerName': null, 'amount': '100.00', 'currency': 'NGN',
      'revision': 1, 'state': 'dispatching',
      'providerReference': null, 'providerStatus': null,
      'lastEvidenceAt': null, 'deliveryCode': null,
    };
    expect(BillReceipt.fromJson(valid).finalStatus, false);
    expect(BillReceipt.fromJson(valid).status, BillReceiptStatus.processing);
    expect(() => BillReceipt.fromJson({...valid, 'currency': 'USD'}),
        throwsFormatException);
    expect(() => BillReceipt.fromJson({...valid, 'state': 'paid'}),
        throwsFormatException);
    expect(() => BillReceipt.fromJson({...valid, 'amount': 100.0}),
        throwsFormatException);
    expect(() => BillReceipt.fromJson({...valid, 'fulfillmentReference': '../tenant'}),
        throwsFormatException);
    final verified = BillReceipt.fromJson({
      ...valid, 'state': 'succeeded', 'deliveryCode': 'PIN-1234',
    });
    expect(verified.finalStatus, true);
    expect(verified.rows.any((e) => e.label == 'Delivery code'), true);
    final notVerified = BillReceipt.fromJson({
      ...valid, 'state': 'manual_review', 'deliveryCode': 'PIN-1234',
    });
    expect(notVerified.rows.any((e) => e.label == 'Delivery code'), false);
    expect(validBillReference('../tenant'), false);
  });

  testWidgets('pending is never called paid and refresh is explicit',
      (tester) async {
    var refresh = false;
    String? report;
    await tester.pumpWidget(MaterialApp(home: BillReceiptScreen(
      enabled: true, reference: 'bill-1', accountKey: 'a',
      reader: _Reader((_, isRefresh) async { refresh = isRefresh; return _pending; }),
      onAskGwani: (ref) => report = ref,
    )));
    await tester.pumpAndSettle();
    expect(find.text('Processing'), findsOneWidget);
    expect(find.textContaining('Pending is not settled'), findsOneWidget);
    expect(refresh, false);
    await tester.tap(find.text('Check provider status'));
    await tester.pumpAndSettle();
    expect(refresh, true);
    await tester.tap(find.text('Ask Gwani'));
    expect(report, 'bill-1');
  });

  testWidgets('late response from previous account is fenced', (tester) async {
    final old = Completer<BillReceipt>();
    final next = Completer<BillReceipt>();
    final reader = _Reader((ref, _) => ref == 'bill-1' ? old.future : next.future);
    Widget page(String id, String account) => MaterialApp(home: BillReceiptScreen(
      enabled: true, reference: id, accountKey: account, reader: reader,
    ));
    await tester.pumpWidget(page('bill-1', 'a'));
    await tester.pump();
    await tester.pumpWidget(page('bill-2', 'b'));
    await tester.pump();
    old.complete(_pending);
    await tester.pump();
    expect(find.text('Electricity'), findsNothing);
    next.complete(const BillReceipt(
      reference: 'bill-2', status: BillReceiptStatus.successful,
      title: 'Airtime', summary: 'Confirmed', rows: [], canRefresh: false,
    ));
    await tester.pumpAndSettle();
    expect(find.text('Airtime'), findsOneWidget);
    expect(find.text('Electricity'), findsNothing);
  });

  testWidgets('disabled flag never contacts the finance API', (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(home: BillReceiptScreen(
      reference: 'bill-1', accountKey: 'a',
      reader: _Reader((_, __) async { calls++; return _pending; }),
    )));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.text('Receipt viewing is unavailable.'), findsOneWidget);
  });

  testWidgets('denial hides provider content', (tester) async {
    await tester.pumpWidget(MaterialApp(home: BillReceiptScreen(
      reference: 'bill-1', accountKey: 'a', enabled: true,
      reader: _Reader((_, __) async => throw DioException(
        requestOptions: RequestOptions(path: '/v1/commerce/bills/purchases'),
        response: Response(
          requestOptions: RequestOptions(path: '/v1/commerce/bills/purchases'),
          statusCode: 401, data: {'private': 'never leak'}),
      )),
    )));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to the purchasing account.'), findsOneWidget);
    expect(find.textContaining('never leak'), findsNothing);
  });
}

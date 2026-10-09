import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/billing_models.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/screens/billing/billing_screen.dart';
import 'package:masanawa/l10n/app_localizations.dart';

BillingCheckoutView serverReceipt({String phase = 'fulfilled'}) {
  final quote = BillingQuote(
    quoteId: 'quote-server', revision: 3, categoryCode: 'ELECTRICITY',
    billerCode: 'provider-1', itemCode: 'plan-1', itemName: 'Electricity',
    customerId: 'METER-123456', serviceAmountKobo: 123456,
    feeAmountKobo: 2500, totalAmountKobo: 125956, currency: 'NGN',
    state: phase, expiresAt: '2026-10-08T17:00:00Z', checkoutUrl: null,
    providerReference: null, billProviderReference: 'REF-987',
    fulfillmentReference: 'fulfill-1', refundReference: null,
    createdAt: '2026-10-08T13:00:00Z', updatedAt: '2026-10-08T13:01:00Z',
  );
  return BillingCheckoutView(
    quote: quote, phase: phase, checkoutUrl: null,
    purchase: const BillingPurchaseReceipt(
      fulfillmentReference: 'fulfill-1', state: 'succeeded',
      providerReference: 'REF-987', providerStatus: 'success',
      deliveryCode: 'TOKEN-654321',
    ),
  );
}

void main() {
  for (final locale in ['en', 'fr', 'es', 'pt', 'ar']) {
    testWidgets('authoritative receipt is localized but identifiers and kobo amounts remain exact ($locale)', (tester) async {
      await tester.pumpWidget(MaterialApp(
        locale: Locale(locale),
        localizationsDelegates: MasanawaLocalization.delegates,
        supportedLocales: MasanawaLocalization.supportedLocales,
        home: Scaffold(body: BillDetails(view: serverReceipt())),
      ));
      final element = tester.element(find.byType(BillDetails));
      final l = AppLocalizations.of(element);
      expect(find.text(l.billingTotalLabel), findsOneWidget);
      expect(find.text(l.billingStatusCompleted), findsOneWidget);
      expect(find.text(l.billingTokenLabel), findsOneWidget);
      expect(find.text('TOKEN-654321'), findsOneWidget);
      expect(find.text('REF-987'), findsOneWidget);
      expect(find.text('METER-123456'), findsOneWidget);
      expect(find.text('₦1259.56'), findsOneWidget);
    });
  }

  testWidgets('unknown and refunded states fail closed instead of claiming success', (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: MasanawaLocalization.delegates,
      supportedLocales: MasanawaLocalization.supportedLocales,
      home: Scaffold(body: BillDetails(view: serverReceipt(phase: 'unexpected-server-phase'))),
    ));
    final l = AppLocalizations.of(tester.element(find.byType(BillDetails)));
    expect(find.text(l.billingStatusUnknown), findsOneWidget);
    expect(find.text(l.billingStatusCompleted), findsNothing);
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: MasanawaLocalization.delegates,
      supportedLocales: MasanawaLocalization.supportedLocales,
      home: Scaffold(body: BillDetails(view: serverReceipt(phase: 'refunded'))),
    ));
    expect(find.text(l.billingRefundedInfo), findsOneWidget);
  });
}

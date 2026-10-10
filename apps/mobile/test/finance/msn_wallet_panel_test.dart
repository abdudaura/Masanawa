import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/finance/msn_wallet_panel.dart';

void main() {
  testWidgets('crypto is primary and funded MSN stays distinct from NGN',
      (tester) async {
    var cryptoOpened = 0;
    var quotesOpened = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: MsnWalletPanel(
        crypto: const [MsnCryptoHolding(
          asset: 'USDT', network: 'TRON', available: '13.250000',
        )],
        msnExactAmount: '42.000001',
        onOpenCrypto: () => cryptoOpened++,
        onViewNgnFundingQuote: () => quotesOpened++,
      ),
    ))));
    expect(find.text('Crypto holdings'), findsOneWidget);
    expect(find.text('MSN · Masanawa balance'), findsOneWidget);
    expect(find.text('42.000001 MSN'), findsOneWidget);
    expect(find.text('13.250000'), findsOneWidget);
    expect(find.textContaining('NGN wallet balance'), findsNothing);
    await tester.tap(find.text('Manage crypto'));
    expect(cryptoOpened, 1);
    await tester.ensureVisible(find.text('View NGN to MSN quote'));
    await tester.tap(find.text('View NGN to MSN quote'));
    expect(quotesOpened, 1);
  });

  testWidgets('unavailable state never invents a zero balance or rate',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: MsnWalletPanel(
      crypto: const [], msnExactAmount: null,
      error: 'provider unavailable',
      onOpenCrypto: () {},
    ))));
    expect(find.text('Balance unavailable'), findsOneWidget);
    expect(find.textContaining('0.00 MSN'), findsNothing);
    expect(find.textContaining('1 MSN ='), findsNothing);
    expect(find.text('View NGN to MSN quote'), findsNothing);
  });

  testWidgets('offline prompts read retry but never opens an unsafe quote',
      (tester) async {
    var retried = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: MsnWalletPanel(
      crypto: const [], msnExactAmount: null, offline: true,
      onOpenCrypto: () {}, onRetry: () => retried++,
    ))));
    expect(find.text('Balance unavailable'), findsOneWidget);
    await tester.tap(find.text('Retry balance'));
    expect(retried, 1);
  });
}

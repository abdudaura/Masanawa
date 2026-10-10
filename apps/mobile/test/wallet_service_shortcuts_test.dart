import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _UnavailableWalletController extends WalletController {
  @override
  Future<WalletView?> build() async => throw StateError('offline');
}

void main() {
  testWidgets('service entry survives a wallet balance outage', (tester) async {
    final intents = <String>[];
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(_UnavailableWalletController.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: WalletScreen(onOpenBillingService: intents.add),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Wallet balances are unavailable right now.'), findsOneWidget);
    expect(find.text('Data bundles'), findsOneWidget);
    expect(find.text('Airtime'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Data bundles'));
    expect(intents, ['data']);
    expect(tester.takeException(), isNull);
  });


  testWidgets('R17 orders qualified services and passes exact category intents',
      (tester) async {
    final selected = <String>[];
    var cryptoOpened = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: WalletServiceShortcuts(
          onOpenCrypto: () => cryptoOpened++,
          onOpenBillingService: selected.add,
        ),
      ),
    ));

    final labels = tester.widgetList<ActionChip>(find.byType(ActionChip))
        .map((chip) => (chip.label as Text).data)
        .toList();
    expect(labels, [
      'Crypto',
      'Data bundles',
      'Airtime',
      'Electricity',
      'TV / Cable',
    ]);

    await tester.tap(find.text('Crypto'));
    await tester.tap(find.text('Data bundles'));
    await tester.tap(find.text('Airtime'));
    await tester.tap(find.text('Electricity'));
    await tester.tap(find.text('TV / Cable'));
    expect(cryptoOpened, 1);
    expect(selected, ['data', 'airtime', 'electricity', 'tv']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('R17 does not show disabled or unqualified service actions',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: WalletServiceShortcuts()),
    ));
    expect(find.byType(ActionChip), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _UnavailableWalletController extends WalletController {
  @override
  Future<WalletView?> build() async => throw StateError('offline');
}

void main() {
  testWidgets('Wallet keeps Crypto tab accessible during a balance outage, without bills', (tester) async {
    final intents = <String>[];
    await tester.pumpWidget(
      ProviderScope(
        overrides: [walletProvider.overrideWith(_UnavailableWalletController.new)],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: WalletScreen(onOpenBillingService: intents.add),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Wallet balances are unavailable right now.'), findsOneWidget);
    expect(find.text('Balance'), findsOneWidget);
    expect(find.text('Crypto'), findsOneWidget);
    for (final label in ['Data bundles', 'Airtime', 'Electricity', 'TV / Cable']) {
      expect(find.text(label), findsNothing);
    }
    await tester.tap(find.text('Crypto'));
    await tester.pumpAndSettle();
    expect(find.byType(TabBar), findsOneWidget);
    expect(intents, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('retired WalletServiceShortcuts never exposes billing or calls obsolete callbacks', (tester) async {
    final selected = <String>[];
    var cryptoOpened = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WalletServiceShortcuts(
            onOpenCrypto: () => cryptoOpened++,
            onOpenBillingService: selected.add,
          ),
        ),
      ),
    );
    expect(find.byType(ActionChip), findsNothing);
    expect(find.text('Data bundles'), findsNothing);
    expect(find.text('Airtime'), findsNothing);
    expect(find.text('Electricity'), findsNothing);
    expect(find.text('TV / Cable'), findsNothing);
    expect(selected, isEmpty);
    expect(cryptoOpened, 0);
    expect(tester.takeException(), isNull);
  });
}

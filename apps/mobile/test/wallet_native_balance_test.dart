import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/state/wallet_state.dart';

class _VerifiedWalletController extends WalletController {
  @override
  Future<WalletView?> build() async => WalletView.fromJson({
    'spendableCredits': 50,
    'pendingEarningsCredits': 10,
    'availableEarningsCredits': 20,
    'ngnBalanceKobo': 123456,
    'entries': [],
  });
}

class _UnavailableNgnController extends WalletController {
  @override
  Future<WalletView?> build() async => WalletView.fromJson({
    'spendableCredits': 50,
    'pendingEarningsCredits': 10,
    'availableEarningsCredits': 20,
    'entries': [],
  });
}

void main() {
  test('native NGN formatting uses integer minor units, never floating money', () {
    expect(formatNativeNgnKobo(0, 'en'), '₦0.00');
    expect(formatNativeNgnKobo(1, 'en'), '₦0.01');
    expect(formatNativeNgnKobo(1234567, 'en'), '₦12,345.67');
    expect(
      formatNativeNgnKobo(9007199254740991, 'en'),
      '₦90,071,992,547,409.91',
    );
    expect(() => formatNativeNgnKobo(-1, 'en'), throwsRangeError);
  });

  testWidgets('wallet displays compact MSN platform balance with indicative NGN conversion',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(_VerifiedWalletController.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        localizationsDelegates: MasanawaLocalization.delegates,
        supportedLocales: MasanawaLocalization.supportedLocales,
        home: const WalletScreen(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('MSN Balance'), findsOneWidget);
    expect(find.text('Platform Currency'), findsOneWidget);
    expect(find.text('50'), findsOneWidget);
    expect(find.text('MSN'), findsWidgets);
    expect(find.textContaining('₦1,234.56'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unverified native balance displays MSN without fabricated ₦ amount',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(_UnavailableNgnController.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        localizationsDelegates: MasanawaLocalization.delegates,
        supportedLocales: MasanawaLocalization.supportedLocales,
        home: const WalletScreen(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('MSN Balance'), findsOneWidget);
    expect(find.text('Platform Currency'), findsOneWidget);
    expect(find.text('50'), findsOneWidget);
    expect(find.text('MSN'), findsWidgets);
    expect(find.textContaining('₦'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

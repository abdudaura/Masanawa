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

  testWidgets('wallet displays verified native money separately from Credits',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(_VerifiedWalletController.new),
      ],
      child: MaterialApp(theme: buildMasanawaTheme(brightness: Brightness.light), localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, home: WalletScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Nigerian naira · NGN'), findsOneWidget);
    expect(find.text('₦1,234.56'), findsOneWidget);
    expect(find.text('Spendable Credits'), findsOneWidget);
    expect(find.text('50 Cr'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Available'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unknown native balance displays retry, not fabricated ₦0',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(_UnavailableNgnController.new),
      ],
      child: MaterialApp(theme: buildMasanawaTheme(brightness: Brightness.light), localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, home: WalletScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Nigerian naira · NGN'), findsOneWidget);
    expect(find.text('Balance unavailable'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('₦0.00'), findsNothing);
    expect(find.text('50 Cr'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

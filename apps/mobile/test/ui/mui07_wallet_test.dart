import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/masanawa_wordmark.dart';

WalletView _view({
  int amount = 9007199254740991,
  bool empty = false,
}) => WalletView(
  spendableCredits: amount,
  pendingEarningsCredits: 123,
  availableEarningsCredits: 456,
  ngnBalanceKobo: 0,
  entries: empty
      ? const []
      : [
          WalletEntry(
            id: 'entry-1',
            kind: WalletEntryKind.transferReceived,
            title:
                'A long authorized transaction description that wraps on a narrow screen',
            amountCredits: amount,
            incoming: true,
            createdAt: DateTime(2026, 10, 12, 13, 42),
          ),
          WalletEntry(
            id: 'entry-2',
            kind: WalletEntryKind.purchase,
            title: 'Data bundle',
            amountCredits: 75,
            incoming: false,
            createdAt: DateTime(2026, 10, 11, 9, 5),
          ),
        ],
);

class _Wallet extends WalletController {
  _Wallet(this.value);
  final WalletView? value;
  @override
  Future<WalletView?> build() async => value;
}

class _RetryWallet extends WalletController {
  int attempts = 0;
  @override
  Future<WalletView?> build() async => throw StateError('fixture outage');
  @override
  Future<void> refresh() async {
    attempts++;
    state = AsyncData(_view(amount: 42, empty: true));
  }
}

class _LoadingWallet extends WalletController {
  final pending = Completer<WalletView?>();
  @override
  Future<WalletView?> build() => pending.future;
}

void main() {
  Future<void> mount(
    WidgetTester tester, {
    double width = 390,
    double scale = 1,
    TextDirection direction = TextDirection.ltr,
    WalletView? value,
    WalletController Function()? controller,
    VoidCallback? onCrypto,
    VoidCallback? onSend,
    ValueChanged<String>? onBilling,
  }) async {
    tester.view.physicalSize = Size(width, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        key: UniqueKey(),
        overrides: [
          walletProvider.overrideWith(controller ?? () => _Wallet(value)),
        ],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 900),
              textScaler: TextScaler.linear(scale),
            ),
            child: Directionality(
              textDirection: direction,
              child: WalletScreen(
                onOpenCrypto: onCrypto,
                onSend: onSend,
                onOpenBillingService: onBilling,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
  }

  for (final width in [320.0, 360.0, 390.0, 430.0]) {
    for (final scale in [1.0, 2.0]) {
      for (final direction in TextDirection.values) {
        testWidgets('truthful flat wallet $width ${scale}x $direction', (
          tester,
        ) async {
          await mount(
            tester,
            width: width,
            scale: scale,
            direction: direction,
            value: _view(),
            onCrypto: () {},
            onBilling: (_) {},
          );
          expect(find.byType(MasanawaWordmark), findsOneWidget);
          expect(find.text('9007199254740991 Cr'), findsOneWidget);
          expect(find.text('123 Cr'), findsOneWidget);
          expect(find.text('456 Cr'), findsOneWidget);
          expect(find.textContaining('MSN'), findsNothing);
          expect(find.textContaining('₦'), findsNothing);
          expect(find.text('Send'), findsNothing);
          expect(find.text('Withdraw'), findsNothing);
          expect(tester.takeException(), isNull);
          await tester.scrollUntilVisible(find.text('Data bundle').first, 180);
          expect(find.text('+9007199254740991 Cr'), findsOneWidget);
          expect(find.text('-75 Cr'), findsOneWidget);
          expect(find.text('Oct 12 2026 · 13:42'), findsOneWidget);
          expect(find.text('Oct 11 2026 · 09:05'), findsOneWidget);
          expect(tester.takeException(), isNull);
        });
      }
    }
  }

  testWidgets('actual zero remains distinct from unavailable balance', (
    tester,
  ) async {
    await mount(tester, value: _view(amount: 0, empty: true));
    expect(find.text('0 Cr'), findsOneWidget);
    expect(find.text('No wallet activity yet.'), findsOneWidget);
    await mount(tester);
    expect(find.text('0 Cr'), findsNothing);
    expect(
      find.text('Wallet balances are unavailable right now.'),
      findsOneWidget,
    );
    expect(find.text('No wallet activity yet.'), findsNothing);
  });

  testWidgets(
    'loading preserves unified balance/crypto tabs without inventing balances',
    (tester) async {
      final loading = _LoadingWallet();
      await mount(tester, controller: () => loading);
      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.text('0 Cr'), findsNothing);
      expect(find.text('Balance'), findsOneWidget);
      expect(find.text('Crypto'), findsOneWidget);
      expect(find.text('Airtime'), findsNothing);
      expect(find.text('Electricity'), findsNothing);
    },
  );

  testWidgets('outage retry restores actual balance and empty history', (
    tester,
  ) async {
    final controller = _RetryWallet();
    await mount(tester, controller: () => controller, onCrypto: () {});
    expect(
      find.text('Wallet balances are unavailable right now.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('42 Cr'), findsOneWidget);
    expect(find.text('No wallet activity yet.'), findsOneWidget);
    expect(controller.attempts, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('main Wallet embeds Crypto as its own tab, without bill shortcuts', (tester) async {
    await mount(tester, value: _view(amount: 12, empty: true));
    expect(find.text('Balance'), findsOneWidget);
    await tester.tap(find.text('Crypto'));
    await tester.pumpAndSettle();
    expect(find.byType(TabBar), findsOneWidget);
    expect(find.text('Airtime'), findsNothing);
    expect(find.text('Electricity'), findsNothing);
    expect(find.text('TV / Cable'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'only supplied financial callbacks are exposed and work at 320px large text',
    (tester) async {
      var sent = 0;
      await mount(
        tester,
        width: 320,
        scale: 2,
        value: _view(amount: 12, empty: true),
        onSend: () => sent++,
      );
      expect(find.text('Add money'), findsNothing);
      expect(find.byTooltip('Withdraw'), findsNothing);
      await tester.ensureVisible(find.text('Send'));
      await tester.tap(find.text('Send'));
      expect(sent, 1);
      expect(tester.takeException(), isNull);
    },
  );
}

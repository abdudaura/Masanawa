import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/finance/crypto_models.dart';
import 'package:masanawa/src/finance/crypto_state.dart';
import 'package:masanawa/src/finance/crypto_wallet_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const exact = '12345678901234567890.123456789012345678';
const route = CryptoRoute(
  providerCode: 'USDTTRC20',
  asset: 'USDT',
  network: 'tron',
);
CryptoWalletSnapshot snapshot({String? balance = exact, bool enabled = true}) =>
    CryptoWalletSnapshot(
      capabilities: CryptoCapabilities(
        deposits: enabled,
        withdrawals: enabled,
        conversions: enabled,
        fiatOnRamp: enabled,
        fiatCurrencies: const ['NGN'],
        fiatSettlementProviderCode: 'USDTTRC20',
      ),
      depositRoutes: const [route],
      conversionRoutes: const [
        route,
        CryptoRoute(providerCode: 'BTC', asset: 'BTC', network: null),
      ],
      balances: {route.providerCode: ?balance},
      selectedProviderCode: route.providerCode,
      history: [
        CryptoIntent.fromJson({
          'requestId': 'fixture-receipt',
          'operation': 'withdraw',
          'asset': 'USDTTRC20',
          'network': 'tron',
          'amount': exact,
          'status': 'processing',
          'destinationAddress':
              'long-fixture-address-012345678901234567890123456789',
          'providerNetworkFee': '0.123456789012345678',
          'createdAt': '2026-10-12T12:00:00Z',
        }),
      ],
    );

class FixtureWallet extends CryptoWalletController {
  FixtureWallet(this.value);
  final CryptoWalletSnapshot value;
  int refreshes = 0;
  @override
  Future<CryptoWalletSnapshot> build() async => value;
  @override
  Future<void> refresh() async {
    refreshes++;
    state = AsyncData(value);
  }
}

Future<void> mount(
  WidgetTester tester, {
  double width = 390,
  double scale = 1,
  TextDirection direction = TextDirection.ltr,
  CryptoWalletSnapshot? value,
  CryptoWalletController Function()? controller,
}) async {
  tester.view.physicalSize = Size(width, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        cryptoWalletProvider.overrideWith(
          controller ?? () => FixtureWallet(value ?? snapshot()),
        ),
      ],
      child: RepaintBoundary(
        key: captureKey,
        child: MaterialApp(
          theme: renderTheme(),
          debugShowCheckedModeBanner: false,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: Directionality(textDirection: direction, child: child!),
          ),
          home: const CryptoWalletScreen(),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ThemeData renderTheme() {
  final theme = buildMasanawaTheme(brightness: Brightness.light);
  const fonts = String.fromEnvironment('MUI08_FONTS');
  if (fonts.isEmpty) return theme;
  return theme.copyWith(
    appBarTheme: theme.appBarTheme.copyWith(
      titleTextStyle: theme.appBarTheme.titleTextStyle!.copyWith(
        fontFamily: 'Roboto',
      ),
    ),
  );
}

final captureKey = GlobalKey();
Future<void> capture(WidgetTester tester, String name) async {
  const folder = String.fromEnvironment('MUI08_CAPTURE');
  if (folder.isEmpty) return;
  final boundary =
      captureKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final rendered = await boundary.toImage(pixelRatio: 1);
    final data = await rendered.toByteData(format: ui.ImageByteFormat.png);
    await File('$folder/$name.png').writeAsBytes(data!.buffer.asUint8List());
    rendered.dispose();
  });
}

class DeferredWallet extends FixtureWallet {
  DeferredWallet() : super(snapshot());
  final quote = Completer<CryptoWithdrawalQuote>();
  int quoteCalls = 0;
  int executions = 0;
  @override
  Future<CryptoWithdrawalQuote> quoteWithdrawal({
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) {
    quoteCalls++;
    return quote.future;
  }

  @override
  Future<CryptoIntent> createWithdrawal({
    required String requestId,
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    executions++;
    return value.history.first;
  }
}

class ConversionWallet extends FixtureWallet {
  ConversionWallet() : super(snapshot());
  int executions = 0;
  @override
  Future<CryptoConversionQuote> quoteConversion({
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async => CryptoConversionQuote.fromJson({
    'providerCode': providerCode,
    'targetProviderCode': targetProviderCode,
    'amount': amount,
    'minimumAmount': '1',
    'estimatedTargetAmount': '0.000000123456789123',
    'quotedAt': '2026-10-12T12:00:00Z',
  });
  @override
  Future<CryptoIntent> createConversion({
    required String requestId,
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    executions++;
    return value.history.first;
  }
}

class UnavailableWallet extends FixtureWallet {
  UnavailableWallet() : super(snapshot());
  @override
  Future<CryptoWalletSnapshot> build() async =>
      throw StateError('fixture outage');
}

void main() {
  setUpAll(() async {
    const fonts = String.fromEnvironment('MUI08_FONTS');
    if (fonts.isEmpty) return;
    for (final family in ['Roboto', 'Ahem', 'MaterialIcons']) {
      final file = family == 'MaterialIcons'
          ? 'MaterialIcons-Regular.otf'
          : 'Roboto-Regular.ttf';
      final loader = FontLoader(
        family,
      )..addFont(File('$fonts/$file').readAsBytes().then(ByteData.sublistView));
      await loader.load();
    }
  });
  for (final width in [320.0, 360.0, 390.0, 430.0]) {
    for (final scale in [1.0, 2.0]) {
      for (final direction in TextDirection.values) {
        testWidgets('flat exact Crypto $width/$scale/$direction', (
          tester,
        ) async {
          await mount(tester, width: width, scale: scale, direction: direction);
          expect(
            tester.widget<AppBar>(find.byType(AppBar)).backgroundColor,
            Colors.white,
          );
          await capture(tester, 'crypto-$width-$scale-${direction.name}');
          expect(find.byType(Card), findsNothing);
          expect(find.text(exact), findsWidgets);
          expect(find.text('USDT · tron'), findsWidgets);
          await tester.scrollUntilVisible(find.text('Withdrawal'), 150);
          expect(find.textContaining(exact), findsWidgets);
          expect(tester.takeException(), isNull);
        });
      }
    }
  }
  testWidgets('unavailable balance differs from actual zero', (tester) async {
    await mount(tester, value: snapshot(balance: null));
    expect(find.text('Balance unavailable'), findsOneWidget);
    await mount(tester, value: snapshot(balance: '0'));
    expect(find.text('0'), findsWidgets);
    expect(find.text('Balance unavailable'), findsNothing);
  });
  testWidgets('unsupported actions have no enabled controls', (tester) async {
    await mount(tester, value: snapshot(enabled: false));
    for (final title in ['Buy', 'Receive', 'Convert', 'Withdraw']) {
      expect(find.text(title), findsNothing);
    }
  });
  testWidgets(
    'receipt exposes exact network recipient fee and request identity',
    (tester) async {
      await mount(tester, width: 320, scale: 2);
      await tester.scrollUntilVisible(find.text('Withdrawal'), 150);
      await tester.tap(find.text('Withdrawal'));
      await tester.pumpAndSettle();
      await capture(tester, 'receipt-320-2');
      expect(find.text('Transaction details'), findsOneWidget);
      expect(find.text('fixture-receipt'), findsOneWidget);
      expect(find.text('0.123456789012345678 USDTTRC20'), findsOneWidget);
      expect(find.text('tron'), findsOneWidget);
      expect(
        find.text('long-fixture-address-012345678901234567890123456789'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('receive sheet fits keyboard and large text', (tester) async {
    await mount(tester, width: 320, scale: 2);
    await tester.scrollUntilVisible(find.text('Receive'), 100);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Receive'));
    await tester.pumpAndSettle();
    expect(find.text('Receive USDT'), findsOneWidget);
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '10.000001');
    await tester.scrollUntilVisible(
      find.text('Create deposit address'),
      80,
      scrollable: find.byType(Scrollable).last,
    );
    await capture(tester, 'receive-keyboard-320-2');
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'one active withdrawal waits for quote and explicit authorization',
    (tester) async {
      final wallet = DeferredWallet();
      await mount(tester, width: 320, scale: 2, controller: () => wallet);
      await tester.scrollUntilVisible(find.text('Withdraw'), 100);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Withdraw'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '10.000001');
      await tester.enterText(find.byType(TextField).last, 'fixture-recipient');
      await tester.scrollUntilVisible(
        find.text('Review fee'),
        100,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Review fee'));
      await tester.pumpAndSettle();
      expect(wallet.quoteCalls, 1);
      expect(wallet.executions, 0);
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (w) => w is IconButton && w.tooltip == 'Refresh wallet',
              ),
            )
            .onPressed,
        isNull,
      );
      for (final title in ['Buy', 'Receive', 'Convert', 'Withdraw']) {
        final button = find.ancestor(
          of: find.text(title),
          matching: find.byWidgetPredicate((w) => w is OutlinedButton),
        );
        expect(tester.widget<OutlinedButton>(button).onPressed, isNull);
      }
      wallet.quote.complete(
        CryptoWithdrawalQuote.fromJson({
          'providerCode': 'USDTTRC20',
          'amount': '10.000001',
          'destinationAddress': 'fixture-recipient',
          'minimumAmount': '1',
          'networkFee': '0.1',
          'estimatedReceiveAmount': '9.900001',
          'quotedAt': '2026-10-12T12:00:00Z',
        }),
      );
      await tester.pumpAndSettle();
      expect(find.text('Confirm withdrawal'), findsOneWidget);
      expect(find.text('USDT · tron'), findsWidgets);
      expect(find.text('0.1 USDTTRC20'), findsOneWidget);
      expect(find.text('fixture-recipient'), findsOneWidget);
      await capture(tester, 'withdraw-review-320-2');
      expect(wallet.executions, 0);
      await tester.tap(find.text('Withdraw').last);
      await tester.pumpAndSettle();
      expect(wallet.executions, 1);
      expect(
        find.textContaining(
          'submitted. It will update after provider confirmation.',
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Buy input remains usable with keyboard and large text', (
    tester,
  ) async {
    await mount(tester, width: 320, scale: 2);
    await tester.scrollUntilVisible(find.text('Buy'), 100);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Buy'));
    await tester.pumpAndSettle();
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '100.50');
    await tester.scrollUntilVisible(
      find.text('Continue to secure checkout'),
      80,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.pumpAndSettle();
    await capture(tester, 'buy-keyboard-320-2');
    expect(tester.takeException(), isNull);
    // Input alone never starts a purchase.
  });
  testWidgets(
    'Convert keyboard and review retain estimate and cancel without spending',
    (tester) async {
      final wallet = ConversionWallet();
      await mount(
        tester,
        width: 320,
        scale: 2,
        direction: TextDirection.rtl,
        controller: () => wallet,
      );
      await tester.scrollUntilVisible(find.text('Convert'), 100);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Convert'));
      await tester.pumpAndSettle();
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '10.000001');
      await tester.scrollUntilVisible(
        find.text('Review quote'),
        80,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.pumpAndSettle();
      await capture(tester, 'convert-keyboard-320-2-rtl');
      await tester.tap(find.text('Review quote'));
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      expect(find.text('Confirm conversion'), findsOneWidget);
      expect(find.text('0.000000123456789123 BTC'), findsOneWidget);
      expect(
        tester
            .widget<EditableText>(find.text('0.000000123456789123 BTC'))
            .textDirection,
        TextDirection.ltr,
      );
      expect(
        find.textContaining(
          'final credited amount comes from provider settlement evidence',
        ),
        findsOneWidget,
      );
      await capture(tester, 'convert-review-320-2-rtl');
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(wallet.executions, 0);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('outage remains distinct from empty history and retry recovers', (
    tester,
  ) async {
    final wallet = UnavailableWallet();
    await mount(tester, width: 320, scale: 2, controller: () => wallet);
    expect(find.text('Wallet unavailable'), findsOneWidget);
    expect(find.text('No crypto activity yet'), findsNothing);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(wallet.refreshes, 1);
    expect(find.text('Available balance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

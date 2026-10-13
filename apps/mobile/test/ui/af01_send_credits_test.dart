import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/wallet/send_credits_sheet.dart';
import 'package:masanawa/src/screens/wallet/wallet_receipt_sheet.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

final _receipt = CreditTransferReceipt(
  transferId: 'canonical-ledger-ref',
  recipientUserId: 'fan-b',
  amountCredits: 25,
  completedAt: DateTime.utc(2026, 10, 13),
);
final _wallet = WalletView(
  spendableCredits: 100,
  pendingEarningsCredits: 0,
  availableEarningsCredits: 0,
  ngnBalanceKobo: 0,
  entries: const [],
);

class _Wallet extends WalletController {
  int sends = 0;
  CreditTransferReceipt? next = _receipt;

  @override
  Future<WalletView?> build() async => _wallet;

  @override
  Future<CreditTransferReceipt?> sendCredits({
    required String recipient,
    required int amountCredits,
  }) async {
    sends++;
    expect(recipient, 'fan-b@example.test');
    expect(amountCredits, 25);
    return next;
  }
}

class _Session extends SessionController {
  @override
  SessionState build() => _session('fan-a');
}

class _SignedOutSession extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

SessionSignedIn _session(String id) {
  final user = AuthUser(
    id: id,
    name: 'Test fan',
    status: 'ACTIVE',
    role: 'USER',
    locale: 'en',
    isNewUser: false,
    createdAt: '2026-10-13T00:00:00Z',
  );
  return SessionSignedIn(user, AuthTokens(
    accessToken: 'test-$id', refreshToken: 'test-$id',
    accessExpiresIn: 900, user: user,
  ));
}

void main() {
  Future<void> mountSheet(
    WidgetTester tester, {
    required Future<CreditTransferReceipt?> Function(String, int) send,
    String? Function()? account,
    int spendable = 100,
  }) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: Scaffold(body: SendCreditsSheet(
        expectedAccountId: 'fan-a',
        currentAccountId: account ?? () => 'fan-a',
        spendableCredits: spendable,
        onSend: send,
      )),
    ));
  }

  Future<void> enterDetails(WidgetTester tester,
      {String recipient = 'fan-b@example.test', String amount = '25'}) async {
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), recipient);
    await tester.enterText(fields.at(1), amount);
    await tester.tap(find.text('Review transfer'));
    await tester.pump();
  }

  testWidgets('review never debits until explicit second confirmation', (tester) async {
    var calls = 0;
    await mountSheet(tester, send: (_, _) async { calls++; return null; });
    await enterDetails(tester);
    expect(calls, 0);
    expect(find.text('Confirm and send'), findsOneWidget);
    expect(find.textContaining('cannot be reversed'), findsOneWidget);
    expect(find.text('fan-b@example.test'), findsNothing);
    await tester.tap(find.text('Confirm and send'));
    await tester.pump();
    expect(calls, 1);
  });

  testWidgets('invalid, zero and insufficient amount never call transport', (tester) async {
    var calls = 0;
    await mountSheet(tester, spendable: 20,
      send: (_, _) async { calls++; return _receipt; });
    await enterDetails(tester, recipient: '', amount: '1');
    expect(find.textContaining('valid whole Credit'), findsOneWidget);
    await enterDetails(tester, amount: '25');
    expect(find.text('Not enough spendable Credits.'), findsOneWidget);
    await enterDetails(tester, amount: '0');
    expect(find.textContaining('valid whole Credit'), findsOneWidget);
    expect(calls, 0);
    expect(find.text('Confirm and send'), findsNothing);
  });

  testWidgets('fan switch before confirmation does not send', (tester) async {
    var account = 'fan-a';
    var calls = 0;
    await mountSheet(tester, account: () => account,
      send: (_, _) async { calls++; return _receipt; });
    await enterDetails(tester);
    account = 'fan-b';
    await tester.tap(find.text('Confirm and send'));
    await tester.pump();
    expect(calls, 0);
    expect(find.textContaining('Account changed'), findsOneWidget);
  });

  testWidgets('pending request allows no duplicate confirm taps', (tester) async {
    final deferred = Completer<CreditTransferReceipt?>();
    var calls = 0;
    await mountSheet(tester, send: (_, _) {
      calls++;
      return deferred.future;
    });
    await enterDetails(tester);
    await tester.tap(find.text('Confirm and send'));
    await tester.pump();
    expect(find.text('Sending…'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull);
    expect(calls, 1);
    deferred.complete(null);
    await tester.pump();
    expect(find.textContaining('not confirmed'), findsOneWidget);
  });

  testWidgets('response after account replacement never displays a success',
      (tester) async {
    var account = 'fan-a';
    final deferred = Completer<CreditTransferReceipt?>();
    await mountSheet(tester, account: () => account,
      send: (_, _) => deferred.future);
    await enterDetails(tester);
    await tester.tap(find.text('Confirm and send'));
    await tester.pump();
    account = 'fan-b';
    deferred.complete(_receipt);
    await tester.pump();
    expect(find.textContaining('Account changed'), findsOneWidget);
  });

  testWidgets('mounted Wallet connects Send to existing controller, then receipt',
      (tester) async {
    final wallet = _Wallet();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(() => wallet),
        sessionProvider.overrideWith(_Session.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const WalletScreen(walletCreditSendEnabled: true),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Send'));
    await tester.tap(find.text('Send'));
    await tester.pumpAndSettle();
    await enterDetails(tester);
    expect(wallet.sends, 0);
    await tester.tap(find.text('Confirm and send'));
    await tester.pumpAndSettle();
    expect(wallet.sends, 1);
    expect(find.byType(WalletReceiptSheet), findsOneWidget);
    expect(find.text('Reference: canonical-ledger-ref'), findsOneWidget);
    expect(find.text('Sent to fan-b.'), findsOneWidget);
  });

  testWidgets('disabled and signed-out mounted wallets never expose Send',
      (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        walletProvider.overrideWith(() => _Wallet()),
        sessionProvider.overrideWith(_Session.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const WalletScreen(walletCreditSendEnabled: false),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Send'), findsNothing);

    // Different provider container: signed-out account, enabled build flag.
    await tester.pumpWidget(ProviderScope(
      key: UniqueKey(),
      overrides: [
        walletProvider.overrideWith(() => _Wallet()),
        sessionProvider.overrideWith(_SignedOutSession.new),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const WalletScreen(walletCreditSendEnabled: true),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Send'), findsNothing);
  });
}

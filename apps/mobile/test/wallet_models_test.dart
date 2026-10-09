import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';

void main() {
  test('parses simple wallet projection', () {
    final wallet = WalletView.fromJson({
      'spendableCredits': 5000,
      'pendingEarningsCredits': 800,
      'availableEarningsCredits': 1200,
      'entries': [
        {
          'id': 'entry-1',
          'kind': 'gift',
          'title': 'Gift received',
          'amountCredits': 200,
          'incoming': true,
          'createdAt': '2026-10-05T09:00:00Z',
        },
      ],
    });

    expect(wallet.spendableCredits, 5000);
    expect(wallet.availableEarningsCredits, 1200);
    expect(wallet.entries.single.kind, WalletEntryKind.gift);
  });

  test('wallet model has no Agent Float balance', () {
    final wallet = WalletView.fromJson({
      'spendableCredits': 1,
      'pendingEarningsCredits': 2,
      'availableEarningsCredits': 3,
      'agentFloatCredits': 9999,
      'entries': [],
    });

    expect(wallet.spendableCredits, 1);
  });

  Map<String, dynamic> balances({Object? native, bool includeNative = false}) => {
    'spendableCredits': 50,
    'pendingEarningsCredits': 10,
    'availableEarningsCredits': 20,
    'entries': [],
    if (includeNative) 'ngnBalanceKobo': native,
  };

  test('missing native NGN response is unavailable, never a verified zero', () {
    final view = WalletView.fromJson(balances());
    expect(view.ngnBalanceVerified, isFalse);
    expect(view.ngnBalanceLabel, 'NGN balance unavailable');
    expect(view.spendableCredits, 50);
  });

  test('a real exact zero is verified and distinct from unavailable', () {
    final view = WalletView.fromJson(balances(native: 0, includeNative: true));
    expect(view.ngnBalanceVerified, isTrue);
    expect(view.ngnBalanceKobo, 0);
    expect(view.ngnBalanceLabel, '₦0.00');
  });

  test('native minor units retain exact kobo and never become Credits', () {
    final view = WalletView.fromJson(
      balances(native: 1234567, includeNative: true),
    );
    expect(view.ngnBalanceVerified, isTrue);
    expect(view.ngnBalanceKobo, 1234567);
    expect(view.ngnBalanceLabel, '₦12345.67');
    expect(view.spendableCredits, 50);
  });

  test('rejects malformed, negative, fractional and unsafe native amounts', () {
    for (final invalid in [null, -1, 1.4, '500', 9007199254740992]) {
      expect(
        () => WalletView.fromJson(balances(native: invalid, includeNative: true)),
        throwsFormatException,
        reason: 'Invalid NGN amount: $invalid',
      );
    }
  });

  test('rejects fractional Credits rather than truncating financial balances', () {
    for (final key in [
      'spendableCredits',
      'pendingEarningsCredits',
      'availableEarningsCredits',
    ]) {
      final json = balances()..[key] = 1.5;
      expect(() => WalletView.fromJson(json), throwsFormatException);
    }
    final history = balances()
      ..['entries'] = [
        {
          'id': 'entry-1',
          'kind': 'purchase',
          'title': 'Credit purchase',
          'amountCredits': 2.5,
          'incoming': false,
          'createdAt': '2026-10-05T09:00:00Z',
        },
      ];
    expect(() => WalletView.fromJson(history), throwsFormatException);
  });

}


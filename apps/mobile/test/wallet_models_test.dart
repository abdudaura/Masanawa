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
}

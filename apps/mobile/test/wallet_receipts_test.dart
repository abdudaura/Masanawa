import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';

void main() {
  test('parses Credit transfer receipt', () {
    final receipt = CreditTransferReceipt.fromJson({
      'transferId': 'transfer-1',
      'recipientUserId': 'user-b',
      'amountCredits': 250,
      'completedAt': '2026-10-05T10:00:00Z',
    });

    expect(receipt.transferId, 'transfer-1');
    expect(receipt.amountCredits, 250);
  });

  test('parses Gift receipt', () {
    final receipt = GiftReceipt.fromJson({
      'giftId': 'gift-1',
      'recipientUserId': 'user-b',
      'characterId': 'character-b',
      'amountCredits': 100,
      'completedAt': '2026-10-05T10:00:00Z',
    });

    expect(receipt.giftId, 'gift-1');
    expect(receipt.characterId, 'character-b');
  });
}

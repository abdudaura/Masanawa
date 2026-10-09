import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_gift.dart';

Map<String, dynamic> option({
  String id = 'heart',
  int amount = 100,
  bool available = true,
}) => {
  'id': id,
  'name': 'Heart',
  'visual': 'heart',
  'amountCredits': amount,
  'available': available,
};

Map<String, dynamic> catalog(List<Map<String, dynamic>> items) => {
  'talkId': 'talk-1',
  'currency': 'Credits',
  'items': items,
};

void main() {
  test('only available, distinct server-priced gift items are shown', () {
    final parsed = TalkGiftCatalog.fromJson(catalog([
      option(),
      option(id: 'other', amount: 500, available: false),
    ]));
    expect(parsed.items, hasLength(1));
    expect(parsed.items.single.amountCredits, 100);
  });

  test('invalid currency, duplicate ID, fractional price and unknown visual fail closed', () {
    expect(() => TalkGiftCatalog.fromJson({
      ...catalog([option()]), 'currency': 'NGN',
    }), throwsFormatException);
    expect(() => TalkGiftCatalog.fromJson(catalog([
      option(), option(),
    ])), throwsFormatException);
    expect(() => TalkGiftCatalog.fromJson(catalog([
      {...option(), 'amountCredits': 1.5},
    ])), throwsFormatException);
    expect(() => TalkGiftCatalog.fromJson(catalog([
      {...option(), 'visual': 'remote-code'},
    ])), throwsFormatException);
    // No enabled options is a valid, server-qualified response, not a parser error.
  });

  test('empty server catalog is a valid unavailable state', () {
    expect(TalkGiftCatalog.fromJson(catalog([])).items, isEmpty);
    expect(TalkGiftCatalog.fromJson(catalog([
      option(available: false),
    ])).items, isEmpty);
    expect(() => TalkGiftCatalog.fromJson({
      ...catalog([]), 'items': null,
    }), throwsFormatException);
    expect(() => TalkGiftCatalog.fromJson({
      ...catalog([]), 'items': List.generate(25, (_) => option()),
    }), throwsFormatException);
  });

  test('only a completed receipt may trigger settlement feedback', () {
    final completed = {
      'giftId': 'ledger-1',
      'talkId': 'talk-1',
      'recipientUserId': 'host-1',
      'recipientName': 'Amina',
      'amountCredits': 100,
      'catalogItemId': 'heart',
      'status': 'completed',
      'completedAt': '2026-10-08T00:00:00Z',
    };
    final receipt = TalkGiftReceipt.fromJson(completed);
    expect(receipt.catalogItemId, 'heart');
    expect(() => TalkGiftReceipt.fromJson({
      ...completed, 'status': 'pending',
    }), throwsFormatException);
    expect(() => TalkGiftReceipt.fromJson({
      ...completed, 'amountCredits': 100.5,
    }), throwsFormatException);
    expect(() => TalkGiftReceipt.fromJson({
      ...completed, 'giftId': '',
    }), throwsFormatException);
  });
}

/// Server-owned catalog and settled gift responses. Credits are integer units;
/// the mobile client may select an option but cannot price it.
class TalkGiftCatalog {
  const TalkGiftCatalog({
    required this.talkId,
    required this.items,
  });

  final String talkId;
  final List<TalkGiftCatalogItem> items;

  factory TalkGiftCatalog.fromJson(Map<String, dynamic> json) {
    final talkId = json['talkId'];
    final currency = json['currency'];
    final rawItems = json['items'];
    if (talkId is! String || talkId.trim().isEmpty ||
        currency != 'Credits' || rawItems is! List ||
        rawItems.length > 24) {
      throw const FormatException('Invalid Talk gift catalog');
    }
    final seen = <String>{};
    final items = <TalkGiftCatalogItem>[];
    for (final value in rawItems) {
      if (value is! Map) throw const FormatException('Invalid gift catalog item');
      final item = TalkGiftCatalogItem.fromJson(value.cast<String, dynamic>());
      if (!seen.add(item.id)) {
        throw const FormatException('Duplicate gift catalog item');
      }
      if (item.available) items.add(item);
    }
    return TalkGiftCatalog(talkId: talkId, items: List.unmodifiable(items));
  }
}

class TalkGiftCatalogItem {
  const TalkGiftCatalogItem({
    required this.id,
    required this.name,
    required this.visual,
    required this.amountCredits,
    required this.available,
  });

  final String id;
  final String name;
  final String visual;
  final int amountCredits;
  final bool available;

  factory TalkGiftCatalogItem.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    final visual = json['visual'];
    final amount = json['amountCredits'];
    final available = json['available'];
    if (id is! String || !RegExp(r'^[a-z][a-z0-9_-]{0,47}$').hasMatch(id) ||
        name is! String || name.trim().isEmpty || name.length > 80 ||
        visual is! String ||
        !const {'applause', 'heart', 'flower', 'spark', 'crown', 'celebration'}.contains(visual) ||
        amount is! int || amount < 1 || amount > 1000000000000 ||
        available is! bool) {
      throw const FormatException('Invalid gift catalog item');
    }
    return TalkGiftCatalogItem(
      id: id, name: name.trim(), visual: visual,
      amountCredits: amount, available: available,
    );
  }
}

class TalkGiftReceipt {
  const TalkGiftReceipt({
    required this.giftId,
    required this.talkId,
    required this.recipientUserId,
    required this.recipientName,
    required this.amountCredits,
    required this.completedAt,
    this.catalogItemId,
  });

  final String giftId;
  final String talkId;
  final String recipientUserId;
  final String recipientName;
  final int amountCredits;
  final DateTime completedAt;
  final String? catalogItemId;

  factory TalkGiftReceipt.fromJson(Map<String, dynamic> json) {
    final giftId = json['giftId'];
    final talkId = json['talkId'];
    final recipientUserId = json['recipientUserId'];
    final recipientName = json['recipientName'];
    final amountCredits = json['amountCredits'];
    final completedAt = json['completedAt'];
    final itemId = json['catalogItemId'];

    if (giftId is! String || giftId.isEmpty ||
        talkId is! String || talkId.isEmpty ||
        recipientUserId is! String || recipientUserId.isEmpty ||
        recipientName is! String || recipientName.isEmpty ||
        amountCredits is! int || amountCredits < 1 ||
        completedAt is! String ||
        json['status'] != 'completed' ||
        (itemId != null && (itemId is! String || itemId.isEmpty))) {
      throw const FormatException('Invalid settled Talk gift receipt');
    }

    return TalkGiftReceipt(
      giftId: giftId,
      talkId: talkId,
      recipientUserId: recipientUserId,
      recipientName: recipientName,
      amountCredits: amountCredits,
      completedAt: DateTime.parse(completedAt).toLocal(),
      catalogItemId: itemId as String?,
    );
  }
}

abstract interface class TalkGiftTransport {
  Future<TalkGiftCatalog> loadCatalog({required String talkId});

  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  });
}

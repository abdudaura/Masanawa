class TalkGiftReceipt {
  const TalkGiftReceipt({
    required this.giftId,
    required this.talkId,
    required this.recipientUserId,
    required this.recipientName,
    required this.amountCredits,
    required this.completedAt,
  });

  final String giftId;
  final String talkId;
  final String recipientUserId;
  final String recipientName;
  final int amountCredits;
  final DateTime completedAt;

  factory TalkGiftReceipt.fromJson(Map<String, dynamic> json) {
    final giftId = json['giftId'];
    final talkId = json['talkId'];
    final recipientUserId = json['recipientUserId'];
    final recipientName = json['recipientName'];
    final amountCredits = json['amountCredits'];
    final completedAt = json['completedAt'];

    if (giftId is! String ||
        talkId is! String ||
        recipientUserId is! String ||
        recipientName is! String ||
        amountCredits is! num ||
        amountCredits < 1 ||
        completedAt is! String) {
      throw const FormatException('Invalid Talk gift receipt');
    }

    return TalkGiftReceipt(
      giftId: giftId,
      talkId: talkId,
      recipientUserId: recipientUserId,
      recipientName: recipientName,
      amountCredits: amountCredits.toInt(),
      completedAt: DateTime.parse(completedAt).toLocal(),
    );
  }
}

abstract interface class TalkGiftTransport {
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
  });
}

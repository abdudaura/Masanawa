enum WalletEntryKind {
  funding,
  transferSent,
  transferReceived,
  purchase,
  commission,
  gift,
  voice,
  ownerSession,
  refund,
  withdrawal,
}

WalletEntryKind _kind(String value) {
  switch (value) {
    case 'funding': return WalletEntryKind.funding;
    case 'transfer-sent': return WalletEntryKind.transferSent;
    case 'transfer-received': return WalletEntryKind.transferReceived;
    case 'purchase': return WalletEntryKind.purchase;
    case 'commission': return WalletEntryKind.commission;
    case 'gift': return WalletEntryKind.gift;
    case 'voice': return WalletEntryKind.voice;
    case 'owner-session': return WalletEntryKind.ownerSession;
    case 'refund': return WalletEntryKind.refund;
    case 'withdrawal': return WalletEntryKind.withdrawal;
    default: throw FormatException('Unknown wallet entry kind: $value');
  }
}

class WalletEntry {
  const WalletEntry({
    required this.id,
    required this.kind,
    required this.title,
    required this.amountCredits,
    required this.incoming,
    required this.createdAt,
  });

  final String id;
  final WalletEntryKind kind;
  final String title;
  final int amountCredits;
  final bool incoming;
  final DateTime createdAt;

  factory WalletEntry.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final kind = json['kind'];
    final title = json['title'];
    final amount = json['amountCredits'];
    final createdAt = json['createdAt'];
    if (id is! String ||
        kind is! String ||
        title is! String ||
        amount is! num ||
        amount < 0 ||
        createdAt is! String) {
      throw const FormatException('Invalid wallet entry');
    }
    return WalletEntry(
      id: id,
      kind: _kind(kind),
      title: title,
      amountCredits: amount.toInt(),
      incoming: json['incoming'] == true,
      createdAt: DateTime.parse(createdAt).toLocal(),
    );
  }
}

class WalletView {
  const WalletView({
    required this.spendableCredits,
    required this.pendingEarningsCredits,
    required this.availableEarningsCredits,
    required this.ngnBalanceKobo,
    this.ngnBalanceAvailable = true,
    required this.entries,
  });

  final int spendableCredits;
  final int pendingEarningsCredits;
  final int availableEarningsCredits;
  final int ngnBalanceKobo;
  final bool ngnBalanceAvailable;
  final List<WalletEntry> entries;

  String get ngnBalanceLabel {
    if (!ngnBalanceAvailable) return 'Balance unavailable';
    final naira = ngnBalanceKobo ~/ 100;
    final kobo = (ngnBalanceKobo % 100).toString().padLeft(2, '0');
    return '₦$naira.$kobo';
  }

  factory WalletView.fromJson(Map<String, dynamic> json) {
    int credits(String key) {
      final value = json[key];
      if (value is! num || value < 0) {
        throw FormatException('Invalid wallet balance: $key');
      }
      return value.toInt();
    }
    final entries = json['entries'];
    if (entries is! List) throw const FormatException('Invalid wallet history');
    return WalletView(
      spendableCredits: credits('spendableCredits'),
      pendingEarningsCredits: credits('pendingEarningsCredits'),
      availableEarningsCredits: credits('availableEarningsCredits'),
      ngnBalanceAvailable: json['ngnBalanceKobo'] is num &&
          (json['ngnBalanceKobo'] as num) >= 0,
      ngnBalanceKobo: (json['ngnBalanceKobo'] is num &&
              (json['ngnBalanceKobo'] as num) >= 0)
          ? (json['ngnBalanceKobo'] as num).toInt()
          : 0,
      entries: [
        for (final item in entries)
          if (item is Map)
            WalletEntry.fromJson(item.cast<String, dynamic>()),
      ],
    );
  }
}

abstract class WalletTransport {
  Future<WalletView> load();

  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  });

  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  });
}

class UnavailableWalletTransport implements WalletTransport {
  const UnavailableWalletTransport();

  @override
  Future<WalletView> load() {
    throw StateError('Wallet is not connected to the Gateway yet');
  }

  @override
  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  }) {
    throw StateError('Wallet is not connected to the Gateway yet');
  }

  @override
  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) {
    throw StateError('Wallet is not connected to the Gateway yet');
  }
}


class CreditTransferReceipt {
  const CreditTransferReceipt({
    required this.transferId,
    required this.recipientUserId,
    required this.amountCredits,
    required this.completedAt,
  });

  final String transferId;
  final String recipientUserId;
  final int amountCredits;
  final DateTime completedAt;

  factory CreditTransferReceipt.fromJson(Map<String, dynamic> json) {
    final transferId = json['transferId'];
    final recipientUserId = json['recipientUserId'];
    final amount = json['amountCredits'];
    final completedAt = json['completedAt'];
    if (transferId is! String ||
        recipientUserId is! String ||
        amount is! num ||
        amount < 1 ||
        completedAt is! String) {
      throw const FormatException('Invalid Credit transfer receipt');
    }
    return CreditTransferReceipt(
      transferId: transferId,
      recipientUserId: recipientUserId,
      amountCredits: amount.toInt(),
      completedAt: DateTime.parse(completedAt).toLocal(),
    );
  }
}

class GiftReceipt {
  const GiftReceipt({
    required this.giftId,
    required this.recipientUserId,
    required this.characterId,
    required this.amountCredits,
    required this.completedAt,
  });

  final String giftId;
  final String recipientUserId;
  final String characterId;
  final int amountCredits;
  final DateTime completedAt;

  factory GiftReceipt.fromJson(Map<String, dynamic> json) {
    final giftId = json['giftId'];
    final recipientUserId = json['recipientUserId'];
    final characterId = json['characterId'];
    final amount = json['amountCredits'];
    final completedAt = json['completedAt'];
    if (giftId is! String ||
        recipientUserId is! String ||
        characterId is! String ||
        amount is! num ||
        amount < 1 ||
        completedAt is! String) {
      throw const FormatException('Invalid gift receipt');
    }
    return GiftReceipt(
      giftId: giftId,
      recipientUserId: recipientUserId,
      characterId: characterId,
      amountCredits: amount.toInt(),
      completedAt: DateTime.parse(completedAt).toLocal(),
    );
  }
}

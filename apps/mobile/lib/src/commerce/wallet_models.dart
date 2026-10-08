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
        amount is! int ||
        amount < 0 ||
        amount > 9007199254740991 ||
        createdAt is! String) {
      throw const FormatException('Invalid wallet entry');
    }
    return WalletEntry(
      id: id,
      kind: _kind(kind),
      title: title,
      amountCredits: amount,
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
    this.ngnBalanceVerified = false,
    required this.entries,
  });

  final int spendableCredits;
  final int pendingEarningsCredits;
  final int availableEarningsCredits;
  /// Only the authenticated native NGN ledger can verify this balance.
  /// Zero must not stand in for an unreachable/unsupported balance endpoint.
  final int ngnBalanceKobo;
  final bool ngnBalanceVerified;
  final List<WalletEntry> entries;

  String get ngnBalanceLabel {
    if (!ngnBalanceVerified) return 'NGN balance unavailable';
    final naira = ngnBalanceKobo ~/ 100;
    final kobo = (ngnBalanceKobo % 100).toString().padLeft(2, '0');
    return '₦$naira.$kobo';
  }

  factory WalletView.fromJson(Map<String, dynamic> json) {
    int credits(String key) {
      final value = json[key];
      if (value is! int || value < 0 || value > 9007199254740991) {
        throw FormatException('Invalid wallet balance: $key');
      }
      return value;
    }
    final entries = json['entries'];
    if (entries is! List) throw const FormatException('Invalid wallet history');
    final nativeNgn = json['ngnBalanceKobo'];
    final nativeNgnPresent = json.containsKey('ngnBalanceKobo');
    if (nativeNgnPresent &&
        (nativeNgn is! int || nativeNgn < 0 ||
            nativeNgn > 9007199254740991)) {
      // Never coerce a fractional, negative or malformed monetary balance to 0.
      throw const FormatException('Invalid native NGN balance');
    }
    return WalletView(
      spendableCredits: credits('spendableCredits'),
      pendingEarningsCredits: credits('pendingEarningsCredits'),
      availableEarningsCredits: credits('availableEarningsCredits'),
      ngnBalanceKobo: nativeNgnPresent ? nativeNgn as int : 0,
      ngnBalanceVerified: nativeNgnPresent,
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
        amount is! int ||
        amount < 1 ||
        amount > 9007199254740991 ||
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
        amount is! int ||
        amount < 1 ||
        amount > 9007199254740991 ||
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


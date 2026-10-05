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
    required this.entries,
  });

  final int spendableCredits;
  final int pendingEarningsCredits;
  final int availableEarningsCredits;
  final List<WalletEntry> entries;

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

  Future<void> sendCredits({
    required String recipient,
    required int amountCredits,
  });

  Future<void> sendGift({
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
  Future<void> sendCredits({
    required String recipient,
    required int amountCredits,
  }) {
    throw StateError('Wallet is not connected to the Gateway yet');
  }

  @override
  Future<void> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) {
    throw StateError('Wallet is not connected to the Gateway yet');
  }
}

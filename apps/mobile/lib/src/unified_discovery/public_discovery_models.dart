enum PublicDiscoveryFilter { all, talks, people, experts, twins }
enum PublicDiscoveryKind { talk, person, expert, twin }

class PublicDiscoveryItem {
  const PublicDiscoveryItem({
    required this.kind, required this.id, required this.title,
    required this.subtitle, required this.isLive,
    this.listenerCount = 0, this.available = false,
    this.verified = false, this.seatFeeLabel = '', this.avatarUrl,
  });

  final PublicDiscoveryKind kind;
  final String id;
  final String title;
  final String subtitle;
  final bool isLive;
  final int listenerCount;
  final bool available;
  final bool verified;
  final String seatFeeLabel;
  final String? avatarUrl;

  /// Refuse an unknown type or malformed target rather than navigating an
  /// untrusted server-provided ID to a sensitive app route.
  factory PublicDiscoveryItem.fromJson(dynamic raw) {
    if (raw is! Map) throw const FormatException('Invalid public search item');
    final value = raw.cast<String, dynamic>();
    final kind = switch (value['kind']) {
      'talk' => PublicDiscoveryKind.talk,
      'person' => PublicDiscoveryKind.person,
      'expert' => PublicDiscoveryKind.expert,
      'twin' => PublicDiscoveryKind.twin,
      _ => throw const FormatException('Unknown public search type'),
    };
    final id = value['id'];
    final title = value['title'];
    final subtitle = value['subtitle'];
    if (id is! String || title is! String || subtitle is! String ||
        title.trim().isEmpty || title.length > 300 || subtitle.length > 300) {
      throw const FormatException('Invalid public search identity');
    }
    final allowed = kind == PublicDiscoveryKind.person
        ? RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$')
        : RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,159}$');
    if (!allowed.hasMatch(id)) {
      throw const FormatException('Unsafe public search route');
    }
    final live = value['isLive'];
    final available = value['available'];
    final verified = value['verified'];
    final listenerCount = value['listenerCount'];
    final seatFeeLabel = value['seatFeeLabel'];
    final rawAvatar = value['avatarUrl'];
    final avatar = rawAvatar is String ? Uri.tryParse(rawAvatar) : null;
    final avatarUrl = avatar?.scheme == 'https' && avatar?.host.isNotEmpty == true &&
        avatar?.userInfo.isEmpty == true ? rawAvatar as String? : null;
    if (kind == PublicDiscoveryKind.talk || kind == PublicDiscoveryKind.person) {
      if (live is! bool) throw const FormatException('Invalid live state');
    } else if (available is! bool || verified is! bool ||
        seatFeeLabel is! String || seatFeeLabel.length > 80) {
      throw const FormatException('Invalid persona status');
    }
    if (kind == PublicDiscoveryKind.talk &&
        (listenerCount is! int || listenerCount < 0)) {
      throw const FormatException('Invalid Talk listener count');
    }
    return PublicDiscoveryItem(
      kind: kind, id: id, title: title, subtitle: subtitle,
      isLive: live == true,
      listenerCount: listenerCount is int ? listenerCount : 0,
      available: available == true, verified: verified == true,
      seatFeeLabel: seatFeeLabel is String ? seatFeeLabel : '',
      avatarUrl: avatarUrl,
    );
  }

  String get route => switch (kind) {
    PublicDiscoveryKind.talk => '/talk/${Uri.encodeComponent(id)}',
    PublicDiscoveryKind.person => '/u/${Uri.encodeComponent(id)}',
    PublicDiscoveryKind.expert || PublicDiscoveryKind.twin =>
      '/persona/${Uri.encodeComponent(id)}',
  };
}

class PublicDiscoveryPage {
  const PublicDiscoveryPage({
    required this.items, this.nextOffset, required this.searchWindowSaturated,
  });
  final List<PublicDiscoveryItem> items;
  final int? nextOffset;
  final bool searchWindowSaturated;

  factory PublicDiscoveryPage.fromJson(dynamic raw) {
    if (raw is! Map) throw const FormatException('Invalid public search response');
    final value = raw.cast<String, dynamic>();
    final items = value['items'];
    final offset = value['nextOffset'];
    final saturated = value['searchWindowSaturated'];
    if (items is! List || items.length > 20 ||
        (offset != null && (offset is! int || offset < 1 || offset > 49)) ||
        saturated is! bool) {
      throw const FormatException('Invalid public search page');
    }
    return PublicDiscoveryPage(
      items: List.unmodifiable(items.map(PublicDiscoveryItem.fromJson)),
      nextOffset: offset as int?,
      searchWindowSaturated: saturated,
    );
  }
}

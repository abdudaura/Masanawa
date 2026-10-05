enum TwinActivityKind {
  visit,
  conversation,
  purchase,
  gift,
  voice,
  ownerRequest,
  earning,
}

enum TwinActivityStatus {
  observed,
  pending,
  completed,
  refunded,
  expired,
  failed,
}

TwinActivityKind _kind(String value) {
  switch (value) {
    case 'visit': return TwinActivityKind.visit;
    case 'conversation': return TwinActivityKind.conversation;
    case 'purchase': return TwinActivityKind.purchase;
    case 'gift': return TwinActivityKind.gift;
    case 'voice': return TwinActivityKind.voice;
    case 'owner-request': return TwinActivityKind.ownerRequest;
    case 'earning': return TwinActivityKind.earning;
    default: throw FormatException('Unknown twin activity kind: $value');
  }
}

TwinActivityStatus _status(String value) {
  switch (value) {
    case 'observed': return TwinActivityStatus.observed;
    case 'pending': return TwinActivityStatus.pending;
    case 'completed': return TwinActivityStatus.completed;
    case 'refunded': return TwinActivityStatus.refunded;
    case 'expired': return TwinActivityStatus.expired;
    case 'failed': return TwinActivityStatus.failed;
    default: throw FormatException('Unknown twin activity status: $value');
  }
}

class TwinActivitySummary {
  const TwinActivitySummary({
    required this.visitors,
    required this.conversations,
    required this.earningsCredits,
    required this.pendingOwnerRequests,
  });

  final int visitors;
  final int conversations;
  final int earningsCredits;
  final int pendingOwnerRequests;

  factory TwinActivitySummary.fromJson(Map<String, dynamic> json) {
    int count(String key) {
      final value = json[key];
      if (value is! num || value < 0) {
        throw FormatException('Invalid twin activity summary: $key');
      }
      return value.toInt();
    }
    return TwinActivitySummary(
      visitors: count('visitors'),
      conversations: count('conversations'),
      earningsCredits: count('earningsCredits'),
      pendingOwnerRequests: count('pendingOwnerRequests'),
    );
  }
}

class TwinActivityItem {
  const TwinActivityItem({
    required this.eventId,
    required this.kind,
    required this.status,
    required this.occurredAt,
    required this.amountCredits,
    required this.title,
    required this.detail,
  });

  final String eventId;
  final TwinActivityKind kind;
  final TwinActivityStatus status;
  final DateTime occurredAt;
  final int? amountCredits;
  final String title;
  final String detail;

  factory TwinActivityItem.fromJson(Map<String, dynamic> json) {
    final eventId = json['eventId'];
    final kind = json['kind'];
    final status = json['status'];
    final occurredAt = json['occurredAt'];
    final amount = json['amountCredits'];
    final title = json['title'];
    final detail = json['detail'];
    if (eventId is! String ||
        kind is! String ||
        status is! String ||
        occurredAt is! String ||
        title is! String ||
        detail is! String ||
        (amount != null && (amount is! num || amount < 0))) {
      throw const FormatException('Invalid twin activity item');
    }
    return TwinActivityItem(
      eventId: eventId,
      kind: _kind(kind),
      status: _status(status),
      occurredAt: DateTime.parse(occurredAt).toLocal(),
      amountCredits: amount == null ? null : (amount as num).toInt(),
      title: title,
      detail: detail,
    );
  }
}

class TwinActivityView {
  const TwinActivityView({
    required this.hasTwin,
    required this.characterId,
    required this.summary,
    required this.items,
  });

  final bool hasTwin;
  final String? characterId;
  final TwinActivitySummary summary;
  final List<TwinActivityItem> items;

  factory TwinActivityView.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'];
    final items = json['items'];
    if (summary is! Map || items is! List) {
      throw const FormatException('Invalid twin activity response');
    }
    return TwinActivityView(
      hasTwin: json['hasTwin'] == true,
      characterId: json['characterId'] as String?,
      summary: TwinActivitySummary.fromJson(summary.cast<String, dynamic>()),
      items: [
        for (final item in items)
          if (item is Map)
            TwinActivityItem.fromJson(item.cast<String, dynamic>()),
      ],
    );
  }
}

abstract class TwinActivityTransport {
  Future<TwinActivityView> load({int limit = 50});
}

class UnavailableTwinActivityTransport implements TwinActivityTransport {
  const UnavailableTwinActivityTransport();

  @override
  Future<TwinActivityView> load({int limit = 50}) {
    throw StateError('Twin Activity is not connected to the Gateway yet');
  }
}

/// Server-verified owner economy; never infer earnings from event amount.
class TwinQualityReport {
  const TwinQualityReport({
    required this.hasTwin, required this.characterId,
    required this.pendingCredits, required this.availableCredits,
    required this.floatCredits, required this.floatExhausted,
    required this.sampledEvents, required this.sampledLimit,
    required this.completed, required this.unsuccessful, required this.recent,
  });
  final bool hasTwin;
  final String? characterId;
  final int pendingCredits, availableCredits, floatCredits;
  final bool floatExhausted;
  final int? sampledEvents, sampledLimit, completed, unsuccessful;
  final List<TwinQualityEvent> recent;

  static Map<String, dynamic> object(dynamic value) {
    if (value is! Map) throw const FormatException('Invalid Twin quality response');
    return value.cast<String, dynamic>();
  }
  static int whole(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value is! int || value < 0 || value > 1000000000000) {
      throw FormatException('Invalid Twin quality amount: $key');
    }
    return value;
  }
  factory TwinQualityReport.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != 1 || json['qualification'] != 'ledger-balances-with-sampled-activity') {
      throw const FormatException('Unsupported Twin quality evidence');
    }
    final earnings = object(json['earnings']);
    final float = object(json['float']);
    final hasTwin = json['hasTwin'];
    final characterId = json['characterId'];
    if (hasTwin is! bool ||
        (hasTwin && (characterId is! String || characterId.isEmpty)) ||
        (!hasTwin && characterId != null) ||
        earnings['source'] != 'commerce-ledger' ||
        earnings['payoutGuaranteed'] != false ||
        float['exhausted'] is! bool ||
        float['taskQuotaRemaining'] != null ||
        float['providerCostCredits'] != null ||
        json['recent'] is! List) {
      throw const FormatException('Unqualified Twin economy report');
    }
    final pending = whole(earnings,'pendingCredits');
    final available = whole(earnings,'availableCredits');
    final remaining = whole(float,'remainingCredits');
    if (float['exhausted'] != (hasTwin && remaining == 0) ||
        (!hasTwin && (pending != 0 || available != 0 || remaining != 0))) {
      throw const FormatException('Inconsistent Twin economy report');
    }
    final evidence = json['evidence'];
    if (hasTwin != (evidence != null)) {
      throw const FormatException('Missing Twin activity qualification');
    }
    final e = evidence == null ? null : object(evidence);
    if (e != null && (e['characterId'] != characterId ||
        e['totalResultsKnown'] != false ||
        whole(e,'sampledLimit') > 100 ||
        whole(e,'sampledLimit') < 1)) {
      throw const FormatException('Inconsistent Twin activity evidence');
    }
    final events = <TwinQualityEvent>[
      for (final row in (json['recent'] as List))
        TwinQualityEvent.fromJson(object(row)),
    ];
    if ((!hasTwin && events.isNotEmpty) ||
        (e != null && events.length != whole(e,'sampledEvents')) ||
        (e != null && events.length > whole(e,'sampledLimit'))) {
      throw const FormatException('Unqualified activity sample');
    }
    return TwinQualityReport(
      hasTwin:hasTwin, characterId:characterId as String?,
      pendingCredits:pending, availableCredits:available,
      floatCredits:remaining, floatExhausted:float['exhausted'] as bool,
      sampledEvents:e == null ? null : whole(e,'sampledEvents'),
      sampledLimit:e == null ? null : whole(e,'sampledLimit'),
      completed:e == null ? null : whole(e,'completed'),
      unsuccessful:e == null ? null : whole(e,'unsuccessful'),
      recent:List.unmodifiable(events),
    );
  }
}
class TwinQualityEvent {
  const TwinQualityEvent({required this.kind, required this.status, required this.occurredAt});
  final String kind, status;
  final DateTime occurredAt;
  static const kinds = {'visit','conversation','purchase','gift','voice','owner-request','earning'};
  static const statuses = {'observed','pending','completed','refunded','expired','failed'};
  factory TwinQualityEvent.fromJson(Map<String, dynamic> json) {
    final kind = json['kind'], status = json['status'], at = json['occurredAt'];
    if (kind is! String || !kinds.contains(kind) ||
        status is! String || !statuses.contains(status) || at is! String) {
      throw const FormatException('Invalid Twin activity event');
    }
    final time = DateTime.tryParse(at);
    if (time == null) throw const FormatException('Invalid Twin event date');
    return TwinQualityEvent(kind:kind,status:status,occurredAt:time);
  }
}
abstract class TwinQualityTransport {
  Future<TwinQualityReport> load();
}

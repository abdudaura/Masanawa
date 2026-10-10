
enum SupportOperationKind { billingQuote, cryptoIntent }

extension SupportOperationCode on SupportOperationKind {
  String get code => switch (this) {
    SupportOperationKind.billingQuote => 'billing_quote',
    SupportOperationKind.cryptoIntent => 'crypto_intent',
  };
  String get title => switch (this) {
    SupportOperationKind.billingQuote => 'Bill payment',
    SupportOperationKind.cryptoIntent => 'Crypto transaction',
  };
}

class SupportOperationStatus {
  const SupportOperationStatus({
    required this.kind,
    required this.referenceMask,
    required this.phase,
    required this.observedAt,
    required this.message,
  });
  final SupportOperationKind kind;
  final String referenceMask;
  final String phase;
  final DateTime observedAt;
  final String message;
  bool get isUncertain => phase == 'pending' || phase == 'unknown';

  factory SupportOperationStatus.fromJson(Map<String, dynamic> json) {
    final kind = SupportOperationKind.values.singleWhere(
      (item) => item.code == json['kind'],
    );
    final phase = json['phase'];
    if (phase is! String ||
        !const ['pending', 'succeeded', 'failed', 'refunded', 'unknown']
            .contains(phase)) {
      throw const FormatException('Unsupported support operation status');
    }
    final mask = json['referenceMask'];
    final message = json['message'];
    final observed = json['observedAt'];
    if (mask is! String || message is! String || observed is! String) {
      throw const FormatException('Invalid support status');
    }
    return SupportOperationStatus(
      kind: kind,
      referenceMask: mask,
      phase: phase,
      observedAt: DateTime.parse(observed),
      message: message,
    );
  }
}

class CustomerSupportTicket {
  const CustomerSupportTicket({
    required this.id,
    required this.kind,
    required this.referenceMask,
    required this.operationPhase,
    required this.summary,
    required this.status,
    required this.resolution,
    required this.createdAt,
  });

  final String id;
  final String kind;
  final String? referenceMask;
  final String? operationPhase;
  final String summary;
  final String status;
  final String? resolution;
  final DateTime createdAt;

  factory CustomerSupportTicket.fromJson(Map<String, dynamic> json) {
    String requiredString(String field) {
      final value = json[field];
      if (value is! String) throw FormatException('Invalid support $field');
      return value;
    }
    final kind = requiredString('kind');
    if (!const ['general', 'billing_quote', 'crypto_intent'].contains(kind)) {
      throw const FormatException('Unknown ticket type');
    }
    final status = requiredString('status');
    if (!const ['queued', 'reviewing', 'resolved', 'closed'].contains(status)) {
      throw const FormatException('Unknown ticket state');
    }
    final summary = requiredString('summary');
    final mask = json['referenceMask'];
    final phase = json['operationPhase'];
    final resolution = json['resolution'];
    if ((mask != null && mask is! String) ||
        (phase != null && phase is! String) ||
        (resolution != null && resolution is! String)) {
      throw const FormatException('Invalid ticket fields');
    }
    return CustomerSupportTicket(
      id: requiredString('id'),
      kind: kind,
      referenceMask: mask as String?,
      operationPhase: phase as String?,
      summary: summary,
      status: status,
      resolution: resolution as String?,
      createdAt: DateTime.parse(requiredString('createdAt')),
    );
  }
}

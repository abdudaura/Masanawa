enum TwinReportReason {
  impersonation,
  fraud,
  harassment,
  sexualContent,
  hate,
  selfHarm,
  spam,
  other,
}

String twinReportReasonWire(TwinReportReason value) {
  switch (value) {
    case TwinReportReason.impersonation: return 'impersonation';
    case TwinReportReason.fraud: return 'fraud';
    case TwinReportReason.harassment: return 'harassment';
    case TwinReportReason.sexualContent: return 'sexual-content';
    case TwinReportReason.hate: return 'hate';
    case TwinReportReason.selfHarm: return 'self-harm';
    case TwinReportReason.spam: return 'spam';
    case TwinReportReason.other: return 'other';
  }
}

String twinReportReasonLabel(TwinReportReason value) {
  switch (value) {
    case TwinReportReason.impersonation: return 'Impersonation';
    case TwinReportReason.fraud: return 'Fraud or scam';
    case TwinReportReason.harassment: return 'Harassment';
    case TwinReportReason.sexualContent: return 'Sexual content';
    case TwinReportReason.hate: return 'Hate or abuse';
    case TwinReportReason.selfHarm: return 'Self-harm concern';
    case TwinReportReason.spam: return 'Spam';
    case TwinReportReason.other: return 'Something else';
  }
}

abstract class TwinSafetyTransport {
  Future<void> block({
    required String characterId,
  });

  Future<void> unblock({
    required String characterId,
  });

  Future<void> report({
    required String characterId,
    required TwinReportReason reason,
    String? detail,
  });
}

class UnavailableTwinSafetyTransport implements TwinSafetyTransport {
  const UnavailableTwinSafetyTransport();

  @override
  Future<void> block({required String characterId}) {
    throw StateError('Twin safety is not connected to the Gateway yet');
  }

  @override
  Future<void> unblock({required String characterId}) {
    throw StateError('Twin safety is not connected to the Gateway yet');
  }

  @override
  Future<void> report({
    required String characterId,
    required TwinReportReason reason,
    String? detail,
  }) {
    throw StateError('Twin safety is not connected to the Gateway yet');
  }
}

enum TalkSafetyTargetKind { profile, persona }

extension TalkSafetyTargetKindWire on TalkSafetyTargetKind {
  String get wire => switch (this) {
        TalkSafetyTargetKind.profile => 'profile',
        TalkSafetyTargetKind.persona => 'persona',
      };
}

enum TalkSafetyReportReason {
  spam,
  harassment,
  hate,
  sexual,
  violence,
  selfHarm,
  fraud,
  impersonation,
  privacy,
  other,
}

extension TalkSafetyReportReasonWire on TalkSafetyReportReason {
  String get wire => switch (this) {
        TalkSafetyReportReason.spam => 'spam',
        TalkSafetyReportReason.harassment => 'harassment',
        TalkSafetyReportReason.hate => 'hate',
        TalkSafetyReportReason.sexual => 'sexual',
        TalkSafetyReportReason.violence => 'violence',
        TalkSafetyReportReason.selfHarm => 'self-harm',
        TalkSafetyReportReason.fraud => 'fraud',
        TalkSafetyReportReason.impersonation => 'impersonation',
        TalkSafetyReportReason.privacy => 'privacy',
        TalkSafetyReportReason.other => 'other',
      };

  String get label => switch (this) {
        TalkSafetyReportReason.spam => 'Spam',
        TalkSafetyReportReason.harassment => 'Harassment',
        TalkSafetyReportReason.hate => 'Hate',
        TalkSafetyReportReason.sexual => 'Sexual content',
        TalkSafetyReportReason.violence => 'Violence',
        TalkSafetyReportReason.selfHarm => 'Self-harm',
        TalkSafetyReportReason.fraud => 'Fraud or scam',
        TalkSafetyReportReason.impersonation => 'Impersonation',
        TalkSafetyReportReason.privacy => 'Privacy',
        TalkSafetyReportReason.other => 'Other',
      };
}

class TalkSafetyPreference {
  const TalkSafetyPreference({
    required this.blocked,
    required this.muted,
  });

  final bool blocked;
  final bool muted;

  factory TalkSafetyPreference.fromJson(Map<String, dynamic> json) {
    return TalkSafetyPreference(
      blocked: json['blocked'] == true,
      muted: json['muted'] == true,
    );
  }
}

abstract interface class TalkSafetyTransport {
  Future<TalkSafetyPreference> loadUserPreference(String userId);

  Future<TalkSafetyPreference> setUserPreference({
    required String userId,
    required bool blocked,
    required bool muted,
  });

  Future<void> reportTalk({
    required String talkId,
    required bool isReplay,
    required TalkSafetyReportReason reason,
    String? detail,
  });

  Future<void> reportTarget({
    required TalkSafetyTargetKind targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
    /// Stable across an uncertain response so retry reuses the Postgres key.
    String? clientRequestId,
  });
}


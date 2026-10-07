enum TalkSafetyReason {
  spam, harassment, hate, sexual, violence, selfHarm, fraud, impersonation, privacy, other,
}

extension TalkSafetyReasonWire on TalkSafetyReason {
  String get wire => switch (this) {
    TalkSafetyReason.selfHarm => 'self-harm',
    _ => name,
  };
  String get label => switch (this) {
    TalkSafetyReason.spam => 'Spam',
    TalkSafetyReason.harassment => 'Harassment',
    TalkSafetyReason.hate => 'Hate or abusive content',
    TalkSafetyReason.sexual => 'Sexual content',
    TalkSafetyReason.violence => 'Violence',
    TalkSafetyReason.selfHarm => 'Self-harm',
    TalkSafetyReason.fraud => 'Fraud or scam',
    TalkSafetyReason.impersonation => 'Impersonation',
    TalkSafetyReason.privacy => 'Privacy violation',
    TalkSafetyReason.other => 'Something else',
  };
}

class TalkSafetyPreference {
  const TalkSafetyPreference({required this.blocked, required this.muted});
  final bool blocked;
  final bool muted;
  factory TalkSafetyPreference.fromJson(Map<String,dynamic> json) =>
      TalkSafetyPreference(blocked: json['blocked'] == true, muted: json['muted'] == true);
}

abstract interface class TalkSafetyTransport {
  Future<void> report({
    required String targetKind,
    required String targetId,
    required TalkSafetyReason reason,
    String? detail,
  });
  Future<TalkSafetyPreference> loadPreference(String handle);
  Future<TalkSafetyPreference> setPreference({
    required String handle,
    required bool blocked,
    required bool muted,
  });
}

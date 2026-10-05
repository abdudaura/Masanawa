enum PaidVoiceChargeMode { trial, paid }

class PaidVoiceQuote {
  const PaidVoiceQuote({
    required this.quoteId,
    required this.characterId,
    required this.policyRevision,
    required this.trialPolicyRevision,
    required this.chargeMode,
    required this.trialDurationDays,
    required this.trialStartsAt,
    required this.trialExpiresAt,
    required this.estimatedSeconds,
    required this.estimatedPriceCredits,
    required this.spendCapCredits,
    required this.ownerShareBasisPoints,
    required this.quoteExpiresAt,
  });

  final String quoteId;
  final String characterId;
  final int policyRevision;
  final int trialPolicyRevision;
  final PaidVoiceChargeMode chargeMode;
  final int trialDurationDays;
  final DateTime? trialStartsAt;
  final DateTime? trialExpiresAt;
  final int estimatedSeconds;
  final int estimatedPriceCredits;
  final int spendCapCredits;
  final int ownerShareBasisPoints;
  final DateTime quoteExpiresAt;

  bool get isTrial => chargeMode == PaidVoiceChargeMode.trial;

  factory PaidVoiceQuote.fromJson(Map<String, dynamic> json) {
    int integer(String key, {int min = 0}) {
      final value = json[key];
      if (value is! num || value.toInt() < min) {
        throw FormatException('Invalid paid voice quote: $key');
      }
      return value.toInt();
    }

    DateTime? optionalTime(String key) {
      final value = json[key];
      if (value == null) return null;
      if (value is! String) throw FormatException('Invalid paid voice quote: $key');
      return DateTime.parse(value).toLocal();
    }

    final quoteId = json['quoteId'];
    final characterId = json['characterId'];
    final mode = json['chargeMode'];
    final expires = json['quoteExpiresAt'];
    if (quoteId is! String ||
        characterId is! String ||
        expires is! String ||
        (mode != 'trial' && mode != 'paid')) {
      throw const FormatException('Invalid paid voice quote');
    }

    return PaidVoiceQuote(
      quoteId: quoteId,
      characterId: characterId,
      policyRevision: integer('policyRevision', min: 1),
      trialPolicyRevision: integer('trialPolicyRevision', min: 1),
      chargeMode: mode == 'trial'
          ? PaidVoiceChargeMode.trial
          : PaidVoiceChargeMode.paid,
      trialDurationDays: integer('trialDurationDays', min: 1),
      trialStartsAt: optionalTime('trialStartsAt'),
      trialExpiresAt: optionalTime('trialExpiresAt'),
      estimatedSeconds: integer('estimatedSeconds', min: 1),
      estimatedPriceCredits: integer('estimatedPriceCredits'),
      spendCapCredits: integer('spendCapCredits'),
      ownerShareBasisPoints: integer('ownerShareBasisPoints'),
      quoteExpiresAt: DateTime.parse(expires).toLocal(),
    );
  }
}

class PaidVoiceAdmission {
  const PaidVoiceAdmission({
    required this.admissionId,
    required this.quoteId,
    required this.characterId,
    required this.chargeMode,
    required this.admittedAt,
    required this.expiresAt,
    required this.spendCapCredits,
  });

  final String admissionId;
  final String quoteId;
  final String characterId;
  final PaidVoiceChargeMode chargeMode;
  final DateTime admittedAt;
  final DateTime expiresAt;
  final int spendCapCredits;

  factory PaidVoiceAdmission.fromJson(Map<String, dynamic> json) {
    final admissionId = json['admissionId'];
    final quoteId = json['quoteId'];
    final characterId = json['characterId'];
    final mode = json['chargeMode'];
    final admittedAt = json['admittedAt'];
    final expiresAt = json['expiresAt'];
    final cap = json['spendCapCredits'];
    if (admissionId is! String ||
        quoteId is! String ||
        characterId is! String ||
        admittedAt is! String ||
        expiresAt is! String ||
        cap is! num ||
        cap < 0 ||
        (mode != 'trial' && mode != 'paid')) {
      throw const FormatException('Invalid paid voice admission');
    }
    return PaidVoiceAdmission(
      admissionId: admissionId,
      quoteId: quoteId,
      characterId: characterId,
      chargeMode: mode == 'trial'
          ? PaidVoiceChargeMode.trial
          : PaidVoiceChargeMode.paid,
      admittedAt: DateTime.parse(admittedAt).toLocal(),
      expiresAt: DateTime.parse(expiresAt).toLocal(),
      spendCapCredits: cap.toInt(),
    );
  }
}

abstract class PaidVoiceTransport {
  Future<PaidVoiceQuote> quote({
    required String characterId,
    required int expectedSeconds,
  });

  Future<PaidVoiceAdmission> start({
    required String characterId,
    required String quoteId,
  });

  Future<void> complete({
    required String admissionId,
    required String outcome,
  });
}

class UnavailablePaidVoiceTransport implements PaidVoiceTransport {
  const UnavailablePaidVoiceTransport();

  @override
  Future<PaidVoiceQuote> quote({
    required String characterId,
    required int expectedSeconds,
  }) {
    throw StateError('Paid voice is not connected to the Gateway yet');
  }

  @override
  Future<PaidVoiceAdmission> start({
    required String characterId,
    required String quoteId,
  }) {
    throw StateError('Paid voice is not connected to the Gateway yet');
  }

  @override
  Future<void> complete({
    required String admissionId,
    required String outcome,
  }) {
    throw StateError('Paid voice is not connected to the Gateway yet');
  }
}

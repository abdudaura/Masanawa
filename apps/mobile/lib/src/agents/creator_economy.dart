class CreatorEconomySnapshot {
  const CreatorEconomySnapshot({
    required this.hasClone,
    required this.characterId,
    required this.customerCredits,
    required this.agentFloatCredits,
    required this.pendingEarningsCredits,
    required this.availableEarningsCredits,
  });

  final bool hasClone;
  final String? characterId;
  final int customerCredits;
  final int agentFloatCredits;
  final int pendingEarningsCredits;
  final int availableEarningsCredits;

  factory CreatorEconomySnapshot.fromJson(Map<String, dynamic> json) {
    int credits(String key) {
      final value = json[key];
      if (value is! num || value < 0) {
        throw FormatException('Creator economy response is missing $key');
      }
      return value.round();
    }

    return CreatorEconomySnapshot(
      hasClone: json['hasClone'] == true,
      characterId: json['characterId'] as String?,
      customerCredits: credits('customerCredits'),
      agentFloatCredits: credits('agentFloatCredits'),
      pendingEarningsCredits: credits('pendingEarningsCredits'),
      availableEarningsCredits: credits('availableEarningsCredits'),
    );
  }
}

abstract class CreatorEconomyTransport {
  Future<CreatorEconomySnapshot> load();
  Future<CreatorEconomySnapshot> allocateFloat(int amountCredits);
}

class UnavailableCreatorEconomyTransport implements CreatorEconomyTransport {
  const UnavailableCreatorEconomyTransport();

  @override
  Future<CreatorEconomySnapshot> load() {
    throw StateError('Agent runtime is not configured');
  }

  @override
  Future<CreatorEconomySnapshot> allocateFloat(int amountCredits) {
    throw StateError('Agent runtime is not configured');
  }
}

class CreatorCloneResult {
  const CreatorCloneResult({
    required this.created,
    required this.characterId,
    required this.characterVersionId,
    required this.relationshipId,
    required this.displayName,
  });

  final bool created;
  final String characterId;
  final String characterVersionId;
  final String relationshipId;
  final String displayName;

  factory CreatorCloneResult.fromJson(Map<String, dynamic> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('Clone response is missing $key');
      }
      return value.trim();
    }

    return CreatorCloneResult(
      created: json['created'] == true,
      characterId: requiredString('characterId'),
      characterVersionId: requiredString('characterVersionId'),
      relationshipId: requiredString('relationshipId'),
      displayName: requiredString('displayName'),
    );
  }
}

abstract class CreatorCloneTransport {
  Future<CreatorCloneResult> create({
    required String displayName,
    required String biography,
    required List<String> languages,
    required List<String> personality,
    required List<String> expertise,
  });
}

class UnavailableCreatorCloneTransport implements CreatorCloneTransport {
  const UnavailableCreatorCloneTransport();

  @override
  Future<CreatorCloneResult> create({
    required String displayName,
    required String biography,
    required List<String> languages,
    required List<String> personality,
    required List<String> expertise,
  }) {
    throw StateError('Agent runtime is not configured');
  }
}

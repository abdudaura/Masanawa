class CreatorSkillEntry {
  const CreatorSkillEntry({
    required this.skillVersionId,
    required this.key,
    required this.displayName,
    required this.description,
    required this.triggerDescription,
    required this.category,
    required this.enabled,
  });

  final String skillVersionId;
  final String key;
  final String displayName;
  final String description;
  final String triggerDescription;
  final String category;
  final bool enabled;

  factory CreatorSkillEntry.fromJson(Map<String, dynamic> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('Creator Skill response is missing $key');
      }
      return value.trim();
    }

    return CreatorSkillEntry(
      skillVersionId: requiredString('skillVersionId'),
      key: requiredString('key'),
      displayName: requiredString('displayName'),
      description: requiredString('description'),
      triggerDescription: requiredString('triggerDescription'),
      category: requiredString('category'),
      enabled: json['enabled'] == true,
    );
  }
}

abstract class CreatorSkillTransport {
  Future<List<CreatorSkillEntry>> load();
  Future<List<CreatorSkillEntry>> setEnabled(
    String skillVersionId,
    bool enabled,
  );
}

class UnavailableCreatorSkillTransport implements CreatorSkillTransport {
  const UnavailableCreatorSkillTransport();

  @override
  Future<List<CreatorSkillEntry>> load() {
    throw StateError('Agent runtime is not configured');
  }

  @override
  Future<List<CreatorSkillEntry>> setEnabled(
    String skillVersionId,
    bool enabled,
  ) {
    throw StateError('Agent runtime is not configured');
  }
}

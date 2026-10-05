class TwinPerformanceSummary {
  const TwinPerformanceSummary({
    required this.visitors,
    required this.conversations,
    required this.earningsCredits,
    required this.pendingOwnerRequests,
  });

  final int visitors;
  final int conversations;
  final int earningsCredits;
  final int pendingOwnerRequests;

  factory TwinPerformanceSummary.fromJson(Map<String, dynamic> json) {
    int value(String key) {
      final raw = json[key];
      if (raw is! num || raw < 0) {
        throw FormatException('Invalid twin summary: $key');
      }
      return raw.toInt();
    }

    return TwinPerformanceSummary(
      visitors: value('visitors'),
      conversations: value('conversations'),
      earningsCredits: value('earningsCredits'),
      pendingOwnerRequests: value('pendingOwnerRequests'),
    );
  }
}

class TwinProfile {
  const TwinProfile({
    required this.hasTwin,
    required this.characterId,
    required this.displayName,
    required this.bio,
    required this.publicUrl,
    required this.discoverable,
    required this.voiceEnabled,
    required this.ownerAccessEnabled,
    required this.languages,
    required this.summary,
  });

  final bool hasTwin;
  final String? characterId;
  final String displayName;
  final String bio;
  final String? publicUrl;
  final bool discoverable;
  final bool voiceEnabled;
  final bool ownerAccessEnabled;
  final List<String> languages;
  final TwinPerformanceSummary summary;

  String get initials {
    final parts = displayName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .toList();
    if (parts.isEmpty) return 'AI';
    return parts.map((part) => part.characters.first.toUpperCase()).join();
  }

  factory TwinProfile.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'];
    final languages = json['languages'];
    final displayName = json['displayName'];
    final bio = json['bio'];
    if (summary is! Map ||
        languages is! List ||
        displayName is! String ||
        bio is! String) {
      throw const FormatException('Invalid twin profile');
    }

    return TwinProfile(
      hasTwin: json['hasTwin'] == true,
      characterId: json['characterId'] as String?,
      displayName: displayName,
      bio: bio,
      publicUrl: json['publicUrl'] as String?,
      discoverable: json['discoverable'] == true,
      voiceEnabled: json['voiceEnabled'] == true,
      ownerAccessEnabled: json['ownerAccessEnabled'] == true,
      languages: [
        for (final item in languages)
          if (item is String && item.trim().isNotEmpty) item.trim(),
      ],
      summary:
          TwinPerformanceSummary.fromJson(summary.cast<String, dynamic>()),
    );
  }
}

abstract class TwinProfileTransport {
  Future<TwinProfile> load();

  Future<TwinProfile> setDiscoverable(bool discoverable);
}

class UnavailableTwinProfileTransport implements TwinProfileTransport {
  const UnavailableTwinProfileTransport();

  @override
  Future<TwinProfile> load() {
    throw StateError('My Twin is not connected to the Gateway yet');
  }

  @override
  Future<TwinProfile> setDiscoverable(bool discoverable) {
    throw StateError('My Twin is not connected to the Gateway yet');
  }
}

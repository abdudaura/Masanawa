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
    return parts.map((part) => String.fromCharCode(part.runes.first).toUpperCase()).join();
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


class TwinProfileCustomizationPatch {
  const TwinProfileCustomizationPatch({
    this.displayName,
    this.bio,
    this.interests,
    this.languages,
    this.discoverable,
  });

  final String? displayName;
  final String? bio;
  final List<String>? interests;
  final List<String>? languages;
  final bool? discoverable;

  Map<String, dynamic> toJson() => {
        if (displayName != null) 'displayName': displayName,
        if (bio != null) 'bio': bio,
        if (interests != null) 'interests': interests,
        if (languages != null) 'languages': languages,
        if (discoverable != null) 'discoverable': discoverable,
      };
}

class TwinProfileCustomizationPreview {
  const TwinProfileCustomizationPreview({
    required this.currentRevision,
    required this.patch,
    required this.requiresConfirmation,
    required this.standingChanges,
  });

  final int currentRevision;
  final TwinProfileCustomizationPatch patch;
  final bool requiresConfirmation;
  final List<String> standingChanges;

  factory TwinProfileCustomizationPreview.fromJson(Map<String, dynamic> json) {
    final revision = json['currentRevision'];
    final patch = json['patch'];
    final changes = json['standingChanges'];
    if (revision is! num ||
        revision.toInt() < 1 ||
        patch is! Map ||
        changes is! List ||
        changes.any((item) => item is! String)) {
      throw const FormatException('Invalid Twin customization preview');
    }
    final p = patch.cast<String, dynamic>();
    List<String>? strings(String key) {
      final value = p[key];
      if (value == null) return null;
      if (value is! List || value.any((item) => item is! String)) {
        throw FormatException('Invalid Twin customization field: $key');
      }
      return value.cast<String>().toList(growable: false);
    }

    return TwinProfileCustomizationPreview(
      currentRevision: revision.toInt(),
      patch: TwinProfileCustomizationPatch(
        displayName: p['displayName'] as String?,
        bio: p['bio'] as String?,
        interests: strings('interests'),
        languages: strings('languages'),
        discoverable: p['discoverable'] as bool?,
      ),
      requiresConfirmation: json['requiresConfirmation'] == true,
      standingChanges: changes.cast<String>().toList(growable: false),
    );
  }
}

abstract class TwinProfileTransport {
  Future<TwinProfile> load();

  Future<TwinProfile> setDiscoverable(bool discoverable);

  Future<TwinProfileCustomizationPreview> previewCustomization(
    TwinProfileCustomizationPatch patch,
  );

  Future<TwinProfile> applyCustomization({
    required TwinProfileCustomizationPreview preview,
    required bool confirmed,
  });
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

  @override
  Future<TwinProfileCustomizationPreview> previewCustomization(
    TwinProfileCustomizationPatch patch,
  ) {
    throw StateError('My Twin customization is not connected to the Gateway yet');
  }

  @override
  Future<TwinProfile> applyCustomization({
    required TwinProfileCustomizationPreview preview,
    required bool confirmed,
  }) {
    throw StateError('My Twin customization is not connected to the Gateway yet');
  }
}

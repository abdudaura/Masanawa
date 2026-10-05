class TwinDirectoryEntry {
  const TwinDirectoryEntry({
    required this.publicId,
    required this.characterId,
    required this.displayName,
    required this.bio,
    required this.languages,
    required this.voiceEnabled,
    required this.ownerAccessEnabled,
    required this.publicUrl,
  });

  final String publicId;
  final String characterId;
  final String displayName;
  final String bio;
  final List<String> languages;
  final bool voiceEnabled;
  final bool ownerAccessEnabled;
  final String? publicUrl;

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

  factory TwinDirectoryEntry.fromJson(Map<String, dynamic> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('Twin directory entry is missing $key');
      }
      return value.trim();
    }

    final languages = json['languages'];
    if (languages is! List) {
      throw const FormatException('Twin directory entry is missing languages');
    }

    return TwinDirectoryEntry(
      publicId: requiredString('publicId'),
      characterId: requiredString('characterId'),
      displayName: requiredString('displayName'),
      bio: (json['bio'] as String?)?.trim() ?? '',
      languages: [
        for (final value in languages)
          if (value is String && value.trim().isNotEmpty) value.trim(),
      ],
      voiceEnabled: json['voiceEnabled'] == true,
      ownerAccessEnabled: json['ownerAccessEnabled'] == true,
      publicUrl: json['publicUrl'] as String?,
    );
  }
}

class TwinDirectoryPage {
  const TwinDirectoryPage({
    required this.items,
    required this.nextCursor,
  });

  final List<TwinDirectoryEntry> items;
  final String? nextCursor;

  factory TwinDirectoryPage.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    if (items is! List) {
      throw const FormatException('Invalid twin directory page');
    }
    return TwinDirectoryPage(
      items: [
        for (final item in items)
          if (item is Map)
            TwinDirectoryEntry.fromJson(item.cast<String, dynamic>()),
      ],
      nextCursor: json['nextCursor'] as String?,
    );
  }
}

abstract class TwinDirectoryTransport {
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  });
}

class UnavailableTwinDirectoryTransport implements TwinDirectoryTransport {
  const UnavailableTwinDirectoryTransport();

  @override
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  }) {
    throw StateError('Explore is not connected to the Gateway yet');
  }
}

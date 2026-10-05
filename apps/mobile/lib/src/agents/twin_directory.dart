class TwinDirectoryEntry {
  const TwinDirectoryEntry({
    required this.characterId,
    required this.publicId,
    required this.displayName,
    required this.headline,
    required this.representationLabel,
    required this.ownerPresent,
    required this.freeTextChat,
    this.avatarUrl,
  });

  final String characterId;
  final String publicId;
  final String displayName;
  final String headline;
  final String representationLabel;
  final bool ownerPresent;
  final bool freeTextChat;
  final String? avatarUrl;

  String get initial =>
      displayName.trim().isEmpty ? 'M' : displayName.trim()[0].toUpperCase();

  factory TwinDirectoryEntry.fromJson(Map<String, dynamic> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('Twin directory entry is missing $key');
      }
      return value.trim();
    }

    final representation = requiredString('representationLabel');
    final ownerPresence = requiredString('ownerPresence');
    final textMode = requiredString('textChatMode');
    if (representation != 'AI twin' ||
        ownerPresence != 'not-present' ||
        textMode != 'free') {
      throw const FormatException('Unsafe twin directory presentation contract');
    }

    final avatar = json['avatarUrl'];
    if (avatar != null && avatar is! String) {
      throw const FormatException('Invalid twin avatar');
    }

    return TwinDirectoryEntry(
      characterId: requiredString('characterId'),
      publicId: requiredString('publicId'),
      displayName: requiredString('displayName'),
      headline: (json['headline'] as String? ?? '').trim(),
      representationLabel: representation,
      ownerPresent: false,
      freeTextChat: true,
      avatarUrl: (avatar as String?)?.trim(),
    );
  }
}

abstract class TwinDirectoryTransport {
  Future<List<TwinDirectoryEntry>> search({String query = '', int limit = 30});
  Future<TwinDirectoryEntry?> resolvePublicId(String publicId);
}

class UnavailableTwinDirectoryTransport implements TwinDirectoryTransport {
  const UnavailableTwinDirectoryTransport();

  @override
  Future<List<TwinDirectoryEntry>> search({
    String query = '',
    int limit = 30,
  }) {
    throw StateError('Explore is not connected to the Gateway yet');
  }

  @override
  Future<TwinDirectoryEntry?> resolvePublicId(String publicId) {
    throw StateError('Explore is not connected to the Gateway yet');
  }
}

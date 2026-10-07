import '../talks/talk_models.dart';

enum TalkSearchFilter { all, talks, people, experts, twins }

enum TalkSearchPersonaKind { expert, twin }

class TalkSearchPerson {
  const TalkSearchPerson({
    required this.handle,
    required this.displayName,
    this.bio = '',
    this.avatarUrl,
    this.isLive = false,
    this.liveTalkId,
  });

  final String handle;
  final String displayName;
  final String bio;
  final String? avatarUrl;
  final bool isLive;
  final String? liveTalkId;

  factory TalkSearchPerson.fromJson(Map<String, dynamic> json) {
    return TalkSearchPerson(
      handle: json['handle'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      isLive: json['isLive'] == true,
      liveTalkId: json['liveTalkId'] as String?,
    );
  }
}

class TalkSearchPersona {
  const TalkSearchPersona({
    required this.publicId,
    required this.displayName,
    required this.kind,
    required this.seatFeeLabel,
    required this.isAvailable,
    this.role = '',
    this.avatarUrl,
    this.isVerified = false,
  });

  final String publicId;
  final String displayName;
  final TalkSearchPersonaKind kind;
  final String seatFeeLabel;
  final bool isAvailable;
  final String role;
  final String? avatarUrl;
  final bool isVerified;

  factory TalkSearchPersona.fromJson(Map<String, dynamic> json) {
    return TalkSearchPersona(
      publicId: json['publicId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      kind: json['kind'] == 'twin'
          ? TalkSearchPersonaKind.twin
          : TalkSearchPersonaKind.expert,
      seatFeeLabel: json['seatFeeLabel'] as String? ?? '',
      isAvailable: json['isAvailable'] != false,
      role: json['role'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      isVerified: json['isVerified'] == true,
    );
  }
}

class TalkSearchResults {
  const TalkSearchResults({
    this.talks = const [],
    this.people = const [],
    this.personas = const [],
  });

  final List<TalkDiscoveryItem> talks;
  final List<TalkSearchPerson> people;
  final List<TalkSearchPersona> personas;

  bool get isEmpty => talks.isEmpty && people.isEmpty && personas.isEmpty;

  factory TalkSearchResults.fromJson(Map<String, dynamic> json) {
    final rawTalks = json['talks'];
    final rawPeople = json['people'];
    final rawPersonas = json['personas'];
    return TalkSearchResults(
      talks: rawTalks is List
          ? [
              for (final item in rawTalks)
                if (item is Map)
                  TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
      people: rawPeople is List
          ? [
              for (final item in rawPeople)
                if (item is Map)
                  TalkSearchPerson.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
      personas: rawPersonas is List
          ? [
              for (final item in rawPersonas)
                if (item is Map)
                  TalkSearchPersona.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

abstract interface class TalkSearchTransport {
  Future<TalkSearchResults> search({
    required String query,
    required TalkSearchFilter filter,
    int limit = 30,
  });
}

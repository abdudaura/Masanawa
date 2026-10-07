import '../talks/talk_models.dart';

enum PersonaProfileKind { expert, twin }

class HumanProfile {
  const HumanProfile({
    required this.handle,
    required this.displayName,
    required this.followerCount,
    required this.followingCount,
    required this.isFollowing,
    this.bio = '',
    this.avatarUrl,
    this.isLive = false,
    this.liveTalkId,
    this.twinPublicId,
    this.twinDisplayName,
    this.talks = const [],
  });

  final String handle;
  final String displayName;
  final String bio;
  final String? avatarUrl;
  final int followerCount;
  final int followingCount;
  final bool isFollowing;
  final bool isLive;
  final String? liveTalkId;
  final String? twinPublicId;
  final String? twinDisplayName;
  final List<TalkDiscoveryItem> talks;

  factory HumanProfile.fromJson(Map<String, dynamic> json) {
    final rawTalks = json['talks'];
    return HumanProfile(
      handle: json['handle'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
      followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
      isFollowing: json['isFollowing'] == true,
      isLive: json['isLive'] == true,
      liveTalkId: json['liveTalkId'] as String?,
      twinPublicId: json['twinPublicId'] as String?,
      twinDisplayName: json['twinDisplayName'] as String?,
      talks: rawTalks is List
          ? [
              for (final item in rawTalks)
                if (item is Map)
                  TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

class PersonaProfile {
  const PersonaProfile({
    required this.publicId,
    required this.displayName,
    required this.kind,
    required this.seatFeeLabel,
    required this.isAvailable,
    this.role = '',
    this.bio = '',
    this.avatarUrl,
    this.ownerHandle,
    this.ownerDisplayName,
    this.topics = const [],
    this.appearances = const [],
    this.isVerified = false,
  });

  final String publicId;
  final String displayName;
  final PersonaProfileKind kind;
  final String seatFeeLabel;
  final bool isAvailable;
  final String role;
  final String bio;
  final String? avatarUrl;
  final String? ownerHandle;
  final String? ownerDisplayName;
  final List<String> topics;
  final List<TalkDiscoveryItem> appearances;
  final bool isVerified;

  factory PersonaProfile.fromJson(Map<String, dynamic> json) {
    final rawTopics = json['topics'];
    final rawAppearances = json['appearances'];
    return PersonaProfile(
      publicId: json['publicId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      kind: json['kind'] == 'expert'
          ? PersonaProfileKind.expert
          : PersonaProfileKind.twin,
      seatFeeLabel: json['seatFeeLabel'] as String? ?? '',
      isAvailable: json['isAvailable'] != false,
      role: json['role'] as String? ?? '',
      bio: json['bio'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      ownerHandle: json['ownerHandle'] as String?,
      ownerDisplayName: json['ownerDisplayName'] as String?,
      topics: rawTopics is List
          ? [
              for (final topic in rawTopics)
                if (topic is String && topic.trim().isNotEmpty) topic.trim(),
            ]
          : const [],
      appearances: rawAppearances is List
          ? [
              for (final item in rawAppearances)
                if (item is Map)
                  TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
      isVerified: json['isVerified'] == true,
    );
  }
}

abstract interface class TalkSocialProfileTransport {
  Future<HumanProfile?> loadHuman(String handle);

  Future<HumanProfile> setFollowing({
    required String handle,
    required bool following,
  });

  Future<PersonaProfile?> loadPersona(String publicId);
}

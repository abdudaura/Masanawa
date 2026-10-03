// GENERATED FILE — DO NOT EDIT.
// Source: packages/contracts/src/schemas/discussion.ts

import 'civic_models.dart';

enum DiscussionThreadMode {
  COMMUNITY_ROOM,
  OBJECT_THREAD,
}

enum DiscussionPermission {
  PUBLIC_READ,
  MEMBER_READ,
  MEMBER_WRITE,
  OBJECT_ELIGIBLE_WRITE,
  MODERATOR_WRITE,
}

T _discussionEnumByName<T extends Enum>(List<T> values, Object? raw, String field) {
  if (raw is! String) throw FormatException('Missing or invalid $field');
  for (final value in values) {
    if (value.name == raw) return value;
  }
  throw FormatException('Unknown $field: $raw');
}

class DiscussionThread {
  const DiscussionThread({required this.id, required this.mode, required this.communityId, this.objectType, this.objectId, required this.readPermission, required this.writePermission, required this.createdAt, this.closedAt});
  final String id;
  final DiscussionThreadMode mode;
  final String communityId;
  final CivicObjectType? objectType;
  final String? objectId;
  final DiscussionPermission readPermission;
  final DiscussionPermission writePermission;
  final DateTime createdAt;
  final DateTime? closedAt;

  factory DiscussionThread.fromJson(Map<String, dynamic> json) {
    final id = json['id']; final communityId = json['communityId']; final createdRaw = json['createdAt'];
    if (id is! String || communityId is! String || createdRaw is! String) throw const FormatException('Invalid discussion thread identity');
    final createdAt = DateTime.tryParse(createdRaw);
    if (createdAt == null) throw const FormatException('Invalid discussion createdAt');
    final objectTypeRaw = json['objectType'];
    final objectType = objectTypeRaw == null ? null : _discussionEnumByName(CivicObjectType.values, objectTypeRaw, 'objectType');
    final closedRaw = json['closedAt'];
    return DiscussionThread(
      id: id, mode: _discussionEnumByName(DiscussionThreadMode.values, json['mode'], 'mode'), communityId: communityId,
      objectType: objectType, objectId: json['objectId'] is String ? json['objectId'] as String : null,
      readPermission: _discussionEnumByName(DiscussionPermission.values, json['readPermission'], 'readPermission'),
      writePermission: _discussionEnumByName(DiscussionPermission.values, json['writePermission'], 'writePermission'),
      createdAt: createdAt, closedAt: closedRaw is String ? DateTime.tryParse(closedRaw) : null,
    );
  }
}

class CanonicalCivicDetailRef {
  const CanonicalCivicDetailRef({required this.objectType, required this.objectId, required this.canonicalPath, this.discussionThreadId});
  final CivicObjectType objectType;
  final String objectId;
  final String canonicalPath;
  final String? discussionThreadId;

  factory CanonicalCivicDetailRef.fromJson(Map<String, dynamic> json) {
    final objectId = json['objectId']; final canonicalPath = json['canonicalPath'];
    if (objectId is! String || canonicalPath is! String || canonicalPath.isEmpty) throw const FormatException('Invalid canonical civic detail reference');
    return CanonicalCivicDetailRef(
      objectType: _discussionEnumByName(CivicObjectType.values, json['objectType'], 'objectType'), objectId: objectId, canonicalPath: canonicalPath,
      discussionThreadId: json['discussionThreadId'] is String ? json['discussionThreadId'] as String : null,
    );
  }
}

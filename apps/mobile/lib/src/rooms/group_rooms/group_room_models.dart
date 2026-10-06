enum GroupParticipantKind {
  human,
  character,
  twin,
}

GroupParticipantKind _participantKindFromWire(String value) {
  switch (value) {
    case 'human':
      return GroupParticipantKind.human;
    case 'character':
      return GroupParticipantKind.character;
    case 'twin':
      return GroupParticipantKind.twin;
    default:
      throw FormatException('Unknown group participant kind: $value');
  }
}

enum GroupParticipantRole {
  owner,
  moderator,
  member,
}

GroupParticipantRole _participantRoleFromWire(String value) {
  switch (value) {
    case 'owner':
      return GroupParticipantRole.owner;
    case 'moderator':
      return GroupParticipantRole.moderator;
    case 'member':
      return GroupParticipantRole.member;
    default:
      throw FormatException('Unknown group participant role: $value');
  }
}

class GroupRoomPrivacy {
  const GroupRoomPrivacy({
    required this.memoryScope,
    required this.privateRelationshipMemoryEligible,
    required this.membershipRequired,
  });

  final String memoryScope;
  final bool privateRelationshipMemoryEligible;
  final bool membershipRequired;

  factory GroupRoomPrivacy.fromJson(Map<String, dynamic> json) {
    final memoryScope = json['memoryScope'];
    final privateRelationshipMemoryEligible =
        json['privateRelationshipMemoryEligible'];
    final membershipRequired = json['membershipRequired'];
    if (memoryScope != 'group-room' ||
        privateRelationshipMemoryEligible is! bool ||
        membershipRequired is! bool ||
        privateRelationshipMemoryEligible ||
        !membershipRequired) {
      throw const FormatException('Invalid Group Room privacy boundary');
    }
    return GroupRoomPrivacy(
      memoryScope: memoryScope as String,
      privateRelationshipMemoryEligible: privateRelationshipMemoryEligible,
      membershipRequired: membershipRequired,
    );
  }
}

class GroupParticipant {
  const GroupParticipant({
    required this.participantId,
    required this.displayName,
    required this.kind,
    required this.role,
    required this.bindingRef,
    this.avatarUrl,
  });

  final String participantId;
  final String displayName;
  final GroupParticipantKind kind;
  final GroupParticipantRole role;

  /// Opaque server-owned identity/presentation binding. The client must never
  /// interpret this as execution authority or a Relationship identifier.
  final String bindingRef;
  final Uri? avatarUrl;

  factory GroupParticipant.fromJson(Map<String, dynamic> json) {
    final participantId = json['participantId'];
    final displayName = json['displayName'];
    final kind = json['kind'];
    final role = json['role'];
    final bindingRef = json['bindingRef'];
    final rawAvatarUrl = json['avatarUrl'];
    if (participantId is! String ||
        participantId.trim().isEmpty ||
        displayName is! String ||
        displayName.trim().isEmpty ||
        kind is! String ||
        role is! String ||
        bindingRef is! String ||
        bindingRef.trim().isEmpty ||
        (rawAvatarUrl != null && rawAvatarUrl is! String)) {
      throw const FormatException('Invalid Group Room participant');
    }

    Uri? avatarUrl;
    if (rawAvatarUrl is String) {
      avatarUrl = Uri.tryParse(rawAvatarUrl);
      if (avatarUrl == null || avatarUrl.scheme != 'https') {
        throw const FormatException('Group participant avatar must be HTTPS');
      }
    }

    return GroupParticipant(
      participantId: participantId,
      displayName: displayName,
      kind: _participantKindFromWire(kind),
      role: _participantRoleFromWire(role),
      bindingRef: bindingRef,
      avatarUrl: avatarUrl,
    );
  }
}

class GroupMessageProjection {
  const GroupMessageProjection({
    required this.messageId,
    required this.authorParticipantId,
    required this.text,
    required this.sentAt,
  });

  final String messageId;
  final String authorParticipantId;
  final String text;
  final DateTime sentAt;

  factory GroupMessageProjection.fromJson(Map<String, dynamic> json) {
    final messageId = json['messageId'];
    final authorParticipantId = json['authorParticipantId'];
    final text = json['text'];
    final rawSentAt = json['sentAt'];
    if (messageId is! String ||
        messageId.trim().isEmpty ||
        authorParticipantId is! String ||
        authorParticipantId.trim().isEmpty ||
        text is! String ||
        text.trim().isEmpty ||
        rawSentAt is! String) {
      throw const FormatException('Invalid Group Room message');
    }
    final sentAt = DateTime.tryParse(rawSentAt);
    if (sentAt == null) {
      throw const FormatException('Invalid Group Room message timestamp');
    }
    return GroupMessageProjection(
      messageId: messageId,
      authorParticipantId: authorParticipantId,
      text: text,
      sentAt: sentAt.toLocal(),
    );
  }
}

class GroupRoomProjection {
  const GroupRoomProjection({
    required this.roomId,
    required this.title,
    required this.description,
    required this.privacy,
    required this.participants,
    required this.messages,
  });

  final String roomId;
  final String title;
  final String description;
  final GroupRoomPrivacy privacy;
  final List<GroupParticipant> participants;
  final List<GroupMessageProjection> messages;

  GroupParticipant participantFor(String participantId) =>
      participants.firstWhere((item) => item.participantId == participantId);

  factory GroupRoomProjection.fromJson(Map<String, dynamic> json) {
    final roomId = json['roomId'];
    final title = json['title'];
    final description = json['description'];
    final rawPrivacy = json['privacy'];
    final rawParticipants = json['participants'];
    final rawMessages = json['messages'];

    if (roomId is! String ||
        roomId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        description is! String ||
        rawPrivacy is! Map ||
        rawParticipants is! List ||
        rawMessages is! List) {
      throw const FormatException('Invalid Group Room projection');
    }

    final participants = <GroupParticipant>[
      for (final item in rawParticipants)
        if (item is Map)
          GroupParticipant.fromJson(item.cast<String, dynamic>()),
    ];
    if (participants.length != rawParticipants.length || participants.isEmpty) {
      throw const FormatException('Group Room requires valid participants');
    }

    final participantIds = <String>{};
    for (final participant in participants) {
      if (!participantIds.add(participant.participantId)) {
        throw const FormatException('Duplicate Group Room participant');
      }
    }

    final messages = <GroupMessageProjection>[
      for (final item in rawMessages)
        if (item is Map)
          GroupMessageProjection.fromJson(item.cast<String, dynamic>()),
    ];
    if (messages.length != rawMessages.length) {
      throw const FormatException('Invalid Group Room messages');
    }
    for (final message in messages) {
      if (!participantIds.contains(message.authorParticipantId)) {
        throw const FormatException(
          'Group Room message author must be an explicit member',
        );
      }
    }

    return GroupRoomProjection(
      roomId: roomId,
      title: title,
      description: description,
      privacy: GroupRoomPrivacy.fromJson(rawPrivacy.cast<String, dynamic>()),
      participants: List.unmodifiable(participants),
      messages: List.unmodifiable(messages),
    );
  }
}

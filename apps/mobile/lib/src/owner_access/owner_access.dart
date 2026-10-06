enum OwnerAccessModality { text, voice, video }

enum OwnerAccessState {
  requested,
  accepted,
  scheduled,
  active,
  completed,
  settled,
  declined,
  expired,
  cancelled,
  noShow,
  refunded,
  disputed,
}

OwnerAccessModality _modality(String value) {
  switch (value) {
    case 'text': return OwnerAccessModality.text;
    case 'voice': return OwnerAccessModality.voice;
    case 'video': return OwnerAccessModality.video;
    default: throw FormatException('Unknown owner access modality: $value');
  }
}

OwnerAccessState _state(String value) {
  switch (value) {
    case 'requested': return OwnerAccessState.requested;
    case 'accepted': return OwnerAccessState.accepted;
    case 'scheduled': return OwnerAccessState.scheduled;
    case 'active': return OwnerAccessState.active;
    case 'completed': return OwnerAccessState.completed;
    case 'settled': return OwnerAccessState.settled;
    case 'declined': return OwnerAccessState.declined;
    case 'expired': return OwnerAccessState.expired;
    case 'cancelled': return OwnerAccessState.cancelled;
    case 'no-show': return OwnerAccessState.noShow;
    case 'refunded': return OwnerAccessState.refunded;
    case 'disputed': return OwnerAccessState.disputed;
    default: throw FormatException('Unknown owner access state: $value');
  }
}

class OwnerAccessQuote {
  const OwnerAccessQuote({
    required this.requestId,
    required this.ownerUserId,
    required this.originatingCharacterId,
    required this.modality,
    required this.durationMinutes,
    required this.priceCredits,
    required this.platformFeeCredits,
    required this.ownerEarningCredits,
    required this.chargeMode,
    required this.trialDurationDays,
    required this.policyRevision,
    required this.trialPolicyRevision,
    required this.quoteExpiresAt,
  });

  final String requestId;
  final String ownerUserId;
  final String originatingCharacterId;
  final OwnerAccessModality modality;
  final int durationMinutes;
  final int priceCredits;
  final int platformFeeCredits;
  final int ownerEarningCredits;
  final String chargeMode;
  final int trialDurationDays;
  final int policyRevision;
  final int trialPolicyRevision;
  final DateTime quoteExpiresAt;

  bool get isTrial => chargeMode == 'trial';

  factory OwnerAccessQuote.fromJson(Map<String, dynamic> json) {
    int integer(String key, {int min = 0}) {
      final value = json[key];
      if (value is! num || value.toInt() < min) {
        throw FormatException('Invalid owner access quote: $key');
      }
      return value.toInt();
    }

    final requestId = json['requestId'];
    final ownerUserId = json['ownerUserId'];
    final characterId = json['originatingCharacterId'];
    final modality = json['modality'];
    final chargeMode = json['chargeMode'];
    final expiresAt = json['quoteExpiresAt'];
    if (requestId is! String ||
        ownerUserId is! String ||
        characterId is! String ||
        modality is! String ||
        expiresAt is! String ||
        (chargeMode != 'trial' && chargeMode != 'paid')) {
      throw const FormatException('Invalid owner access quote');
    }
    return OwnerAccessQuote(
      requestId: requestId,
      ownerUserId: ownerUserId,
      originatingCharacterId: characterId,
      modality: _modality(modality),
      durationMinutes: integer('durationMinutes', min: 1),
      priceCredits: integer('priceCredits'),
      platformFeeCredits: integer('platformFeeCredits'),
      ownerEarningCredits: integer('ownerEarningCredits'),
      chargeMode: chargeMode as String,
      trialDurationDays: integer('trialDurationDays', min: 1),
      policyRevision: integer('policyRevision', min: 1),
      trialPolicyRevision: integer('trialPolicyRevision'),
      quoteExpiresAt: DateTime.parse(expiresAt).toLocal(),
    );
  }
}

class OwnerAccessRequest {
  const OwnerAccessRequest({
    required this.requestId,
    required this.requesterUserId,
    required this.ownerUserId,
    required this.originatingCharacterId,
    required this.modality,
    required this.durationMinutes,
    required this.priceCredits,
    required this.chargeMode,
    required this.state,
    required this.requestedAt,
    required this.acceptBy,
    required this.scheduledFor,
    this.completedAt,
    this.disputeBy,
    this.disputedAt,
    this.disputeReason,
    this.earningsReleasedAt,
    this.disputeResolvedAt,
    this.disputeResolution,
  });

  final String requestId;
  final String requesterUserId;
  final String ownerUserId;
  final String originatingCharacterId;
  final OwnerAccessModality modality;
  final int durationMinutes;
  final int priceCredits;
  final String chargeMode;
  final OwnerAccessState state;
  final DateTime requestedAt;
  final DateTime acceptBy;
  final DateTime? scheduledFor;
  final DateTime? completedAt;
  final DateTime? disputeBy;
  final DateTime? disputedAt;
  final String? disputeReason;
  final DateTime? earningsReleasedAt;
  final DateTime? disputeResolvedAt;
  final String? disputeResolution;

  factory OwnerAccessRequest.fromJson(Map<String, dynamic> json) {
    final requestId = json['requestId'];
    final requesterUserId = json['requesterUserId'];
    final ownerUserId = json['ownerUserId'];
    final characterId = json['originatingCharacterId'];
    final modality = json['modality'];
    final chargeMode = json['chargeMode'];
    final state = json['state'];
    final requestedAt = json['requestedAt'];
    final acceptBy = json['acceptBy'];
    final scheduledFor = json['scheduledFor'];
    final completedAt = json['completedAt'];
    final disputeBy = json['disputeBy'];
    final disputedAt = json['disputedAt'];
    final disputeReason = json['disputeReason'];
    final earningsReleasedAt = json['earningsReleasedAt'];
    final disputeResolvedAt = json['disputeResolvedAt'];
    final disputeResolution = json['disputeResolution'];
    final duration = json['durationMinutes'];
    final price = json['priceCredits'];
    if (requestId is! String ||
        requesterUserId is! String ||
        ownerUserId is! String ||
        characterId is! String ||
        modality is! String ||
        chargeMode is! String ||
        state is! String ||
        requestedAt is! String ||
        acceptBy is! String ||
        duration is! num ||
        price is! num ||
        (scheduledFor != null && scheduledFor is! String) ||
        (completedAt != null && completedAt is! String) ||
        (disputeBy != null && disputeBy is! String) ||
        (disputedAt != null && disputedAt is! String) ||
        (disputeReason != null && disputeReason is! String) ||
        (earningsReleasedAt != null && earningsReleasedAt is! String) ||
        (disputeResolvedAt != null && disputeResolvedAt is! String) ||
        (disputeResolution != null && disputeResolution is! String)) {
      throw const FormatException('Invalid owner access request');
    }
    return OwnerAccessRequest(
      requestId: requestId,
      requesterUserId: requesterUserId,
      ownerUserId: ownerUserId,
      originatingCharacterId: characterId,
      modality: _modality(modality),
      durationMinutes: duration.toInt(),
      priceCredits: price.toInt(),
      chargeMode: chargeMode,
      state: _state(state),
      requestedAt: DateTime.parse(requestedAt).toLocal(),
      acceptBy: DateTime.parse(acceptBy).toLocal(),
      scheduledFor:
          scheduledFor == null ? null : DateTime.parse(scheduledFor).toLocal(),
      completedAt:
          completedAt == null ? null : DateTime.parse(completedAt).toLocal(),
      disputeBy:
          disputeBy == null ? null : DateTime.parse(disputeBy).toLocal(),
      disputedAt:
          disputedAt == null ? null : DateTime.parse(disputedAt).toLocal(),
      disputeReason: disputeReason as String?,
      earningsReleasedAt: earningsReleasedAt == null
          ? null
          : DateTime.parse(earningsReleasedAt).toLocal(),
      disputeResolvedAt: disputeResolvedAt == null
          ? null
          : DateTime.parse(disputeResolvedAt).toLocal(),
      disputeResolution: disputeResolution as String?,
    );
  }
}

class OwnerAccessRoomMessage {
  const OwnerAccessRoomMessage({
    required this.requestId,
    required this.messageId,
    required this.senderUserId,
    required this.body,
    required this.sentAt,
  });

  final String requestId;
  final String messageId;
  final String senderUserId;
  final String body;
  final DateTime sentAt;

  factory OwnerAccessRoomMessage.fromJson(Map<String, dynamic> json) {
    final requestId = json['requestId'];
    final messageId = json['messageId'];
    final senderUserId = json['senderUserId'];
    final body = json['body'];
    final sentAt = json['sentAt'];
    if (requestId is! String ||
        messageId is! String ||
        senderUserId is! String ||
        body is! String ||
        sentAt is! String) {
      throw const FormatException('Invalid owner access room message');
    }
    return OwnerAccessRoomMessage(
      requestId: requestId,
      messageId: messageId,
      senderUserId: senderUserId,
      body: body,
      sentAt: DateTime.parse(sentAt).toLocal(),
    );
  }
}

class OwnerAccessRoomPresence {
  const OwnerAccessRoomPresence({
    required this.userId,
    required this.firstSeenAt,
    required this.lastSeenAt,
    required this.heartbeatCount,
  });

  final String userId;
  final DateTime firstSeenAt;
  final DateTime lastSeenAt;
  final int heartbeatCount;

  factory OwnerAccessRoomPresence.fromJson(Map<String, dynamic> json) {
    final userId = json['userId'];
    final firstSeenAt = json['firstSeenAt'];
    final lastSeenAt = json['lastSeenAt'];
    final heartbeatCount = json['heartbeatCount'];
    if (userId is! String ||
        firstSeenAt is! String ||
        lastSeenAt is! String ||
        heartbeatCount is! num) {
      throw const FormatException('Invalid owner access room presence');
    }
    return OwnerAccessRoomPresence(
      userId: userId,
      firstSeenAt: DateTime.parse(firstSeenAt).toLocal(),
      lastSeenAt: DateTime.parse(lastSeenAt).toLocal(),
      heartbeatCount: heartbeatCount.toInt(),
    );
  }
}

class OwnerAccessRoomStatus {
  const OwnerAccessRoomStatus({
    required this.attendanceVerified,
    required this.verifiedSeconds,
    required this.sessionEndsAt,
    required this.presence,
  });

  final bool attendanceVerified;
  final int verifiedSeconds;
  final DateTime? sessionEndsAt;
  final List<OwnerAccessRoomPresence> presence;

  factory OwnerAccessRoomStatus.fromJson(Map<String, dynamic> json) {
    final verified = json['attendanceVerified'];
    final seconds = json['verifiedSeconds'];
    final sessionEndsAt = json['sessionEndsAt'];
    final presence = json['presence'];
    if (verified is! bool ||
        seconds is! num ||
        (sessionEndsAt != null && sessionEndsAt is! String) ||
        presence is! List) {
      throw const FormatException('Invalid owner access room status');
    }
    return OwnerAccessRoomStatus(
      attendanceVerified: verified,
      verifiedSeconds: seconds.toInt(),
      sessionEndsAt: sessionEndsAt is String
          ? DateTime.parse(sessionEndsAt).toLocal()
          : null,
      presence: List.unmodifiable(
        presence.map(
          (item) => OwnerAccessRoomPresence.fromJson(
            (item as Map).cast<String, dynamic>(),
          ),
        ),
      ),
    );
  }
}

abstract class OwnerAccessTransport {
  Future<OwnerAccessQuote> quote({
    required String characterId,
    required OwnerAccessModality modality,
    required int durationMinutes,
  });

  Future<OwnerAccessRequest> request({
    required String characterId,
    required String quoteId,
  });

  Future<OwnerAccessRequest?> read({
    required String characterId,
    required String requestId,
  });

  Future<OwnerAccessRequest?> latest({
    required String characterId,
  });

  Future<OwnerAccessRequest> act({
    required String characterId,
    required String requestId,
    required String action,
    DateTime? scheduledFor,
    String? disputeReason,
  });

  Future<OwnerAccessRoomStatus> heartbeat({
    required String characterId,
    required String requestId,
  });

  Future<List<OwnerAccessRoomMessage>> messages({
    required String characterId,
    required String requestId,
    int limit = 100,
  });

  Future<OwnerAccessRoomMessage> sendMessage({
    required String characterId,
    required String requestId,
    required String messageId,
    required String body,
  });
}

class UnavailableOwnerAccessTransport implements OwnerAccessTransport {
  const UnavailableOwnerAccessTransport();

  @override
  Future<OwnerAccessQuote> quote({
    required String characterId,
    required OwnerAccessModality modality,
    required int durationMinutes,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRequest> request({
    required String characterId,
    required String quoteId,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRequest?> read({
    required String characterId,
    required String requestId,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRequest?> latest({
    required String characterId,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRequest> act({
    required String characterId,
    required String requestId,
    required String action,
    DateTime? scheduledFor,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRoomStatus> heartbeat({
    required String characterId,
    required String requestId,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<List<OwnerAccessRoomMessage>> messages({
    required String characterId,
    required String requestId,
    int limit = 100,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }

  @override
  Future<OwnerAccessRoomMessage> sendMessage({
    required String characterId,
    required String requestId,
    required String messageId,
    required String body,
  }) {
    throw StateError('Owner access is not connected to the Gateway yet');
  }
}


class OwnerAccessOffering {
  const OwnerAccessOffering({
    required this.enabled,
    required this.modalities,
    required this.durationOptionsMinutes,
    required this.priceCreditsPerMinute,
  });

  final bool enabled;
  final Set<OwnerAccessModality> modalities;
  final List<int> durationOptionsMinutes;
  final int priceCreditsPerMinute;

  OwnerAccessOffering copyWith({
    bool? enabled,
    Set<OwnerAccessModality>? modalities,
    List<int>? durationOptionsMinutes,
    int? priceCreditsPerMinute,
  }) {
    return OwnerAccessOffering(
      enabled: enabled ?? this.enabled,
      modalities: modalities ?? this.modalities,
      durationOptionsMinutes:
          durationOptionsMinutes ?? this.durationOptionsMinutes,
      priceCreditsPerMinute:
          priceCreditsPerMinute ?? this.priceCreditsPerMinute,
    );
  }
}

enum TalkAiPersonaKind { expert, twin }

enum TalkAiSeatMode { hostAdd, sponsor }

enum TalkAiSeatRequestStatus {
  pendingHost,
  admitted,
  declined,
  expired,
  unknown,
}

class TalkAiSeatCandidate {
  const TalkAiSeatCandidate({
    required this.personaId,
    required this.displayName,
    required this.kind,
    required this.seatFeeLabel,
    this.subtitle = '',
    this.avatarUrl,
    this.topics = const [],
    this.isAvailable = true,
  });

  final String personaId;
  final String displayName;
  final TalkAiPersonaKind kind;
  final String seatFeeLabel;
  final String subtitle;
  final String? avatarUrl;
  final List<String> topics;
  final bool isAvailable;

  factory TalkAiSeatCandidate.fromJson(Map<String, dynamic> json) {
    final rawTopics = json['topics'];
    return TalkAiSeatCandidate(
      personaId: json['personaId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      kind: json['kind'] == 'twin'
          ? TalkAiPersonaKind.twin
          : TalkAiPersonaKind.expert,
      seatFeeLabel: json['seatFeeLabel'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      topics: rawTopics is List
          ? [
              for (final topic in rawTopics)
                if (topic is String && topic.trim().isNotEmpty) topic.trim(),
            ]
          : const [],
      isAvailable: json['isAvailable'] != false,
    );
  }
}

class TalkAiSeatQuote {
  const TalkAiSeatQuote({
    required this.quoteId,
    required this.personaId,
    required this.displayName,
    required this.kind,
    required this.mode,
    required this.totalLabel,
    required this.expiresAt,
    required this.requiresHostApproval,
  });

  final String quoteId;
  final String personaId;
  final String displayName;
  final TalkAiPersonaKind kind;
  final TalkAiSeatMode mode;
  final String totalLabel;
  final DateTime expiresAt;
  final bool requiresHostApproval;

  factory TalkAiSeatQuote.fromJson(Map<String, dynamic> json) {
    final mode = json['mode'] == 'host_add'
        ? TalkAiSeatMode.hostAdd
        : TalkAiSeatMode.sponsor;
    return TalkAiSeatQuote(
      quoteId: json['quoteId'] as String? ?? '',
      personaId: json['personaId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      kind: json['kind'] == 'twin'
          ? TalkAiPersonaKind.twin
          : TalkAiPersonaKind.expert,
      mode: mode,
      totalLabel: json['totalLabel'] as String? ?? '',
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      requiresHostApproval: json['requiresHostApproval'] == true,
    );
  }
}

class TalkAiSeatRequest {
  const TalkAiSeatRequest({
    required this.requestId,
    required this.status,
    required this.message,
  });

  final String requestId;
  final TalkAiSeatRequestStatus status;
  final String message;

  factory TalkAiSeatRequest.fromJson(Map<String, dynamic> json) {
    final status = switch (json['status']) {
      'pending_host' => TalkAiSeatRequestStatus.pendingHost,
      'admitted' => TalkAiSeatRequestStatus.admitted,
      'declined' => TalkAiSeatRequestStatus.declined,
      'expired' => TalkAiSeatRequestStatus.expired,
      _ => TalkAiSeatRequestStatus.unknown,
    };
    return TalkAiSeatRequest(
      requestId: json['requestId'] as String? ?? '',
      status: status,
      message: json['message'] as String? ?? '',
    );
  }
}

abstract interface class TalkAiSeatTransport {
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  });

  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  });

  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  });
}

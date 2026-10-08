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
    this.isAvailable = false,
    this.isOwnedByViewer = false,
  });

  final String personaId;
  final String displayName;
  final TalkAiPersonaKind kind;
  final String seatFeeLabel;
  final String subtitle;
  final String? avatarUrl;
  final List<String> topics;
  final bool isAvailable;
  /// Set only by the authenticated server's owner resolution.
  final bool isOwnedByViewer;

  factory TalkAiSeatCandidate.fromJson(Map<String, dynamic> json) {
    final personaId = json['personaId'];
    final displayName = json['displayName'];
    if (personaId is! String || personaId.trim().isEmpty ||
        displayName is! String || displayName.trim().isEmpty) {
      throw const FormatException('AI Seat candidate identity is missing');
    }
    if (json['kind'] != 'expert' && json['kind'] != 'twin') {
      throw const FormatException('AI Seat candidate kind is invalid');
    }
    final rawTopics = json['topics'];
    return TalkAiSeatCandidate(
      personaId: personaId.trim(),
      displayName: displayName.trim(),
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
      // An omitted/non-boolean flag is not proof a paid AI Seat is ready.
      isAvailable: json['isAvailable'] == true,
      isOwnedByViewer: json['kind'] == 'twin' &&
          json['isOwnedByViewer'] == true,
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

  bool isExpiredAt(DateTime instant) => !instant.isBefore(expiresAt);

  factory TalkAiSeatQuote.fromJson(Map<String, dynamic> json) {
    for (final key in ['quoteId', 'personaId', 'displayName', 'totalLabel']) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('AI Seat quote is missing $key');
      }
    }
    final expiryValue = json['expiresAt'];
    final expiry = expiryValue is String ? DateTime.tryParse(expiryValue) : null;
    if (expiry == null) {
      throw const FormatException('AI Seat quote expiry is missing');
    }
    if (json['mode'] != 'host_add' && json['mode'] != 'sponsor') {
      throw const FormatException('AI Seat quote mode is invalid');
    }
    if (json['kind'] != 'expert' && json['kind'] != 'twin') {
      throw const FormatException('AI Seat quote persona kind is invalid');
    }
    if (json['requiresHostApproval'] is! bool ||
        (json['requiresHostApproval'] == true) != (json['mode'] == 'sponsor')) {
      throw const FormatException('AI Seat host approval requirements conflict');
    }
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
      expiresAt: expiry,
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
    final requestId = json['requestId'];
    if (requestId is! String || requestId.trim().isEmpty) {
      throw const FormatException('AI Seat confirmation ID is missing');
    }
    final status = switch (json['status']) {
      'pending_host' => TalkAiSeatRequestStatus.pendingHost,
      'admitted' => TalkAiSeatRequestStatus.admitted,
      'declined' => TalkAiSeatRequestStatus.declined,
      'expired' => TalkAiSeatRequestStatus.expired,
      _ => TalkAiSeatRequestStatus.unknown,
    };
    return TalkAiSeatRequest(
      requestId: requestId.trim(),
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


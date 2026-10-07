import 'talk_models.dart';

enum TalkHostRequestKind { humanSpeaker, sponsoredExpert, sponsoredTwin }

enum TalkHostRequestAction { accept, decline }

enum TalkHostParticipantAction { mute, unmute, remove }

class TalkHostRequest {
  const TalkHostRequest({
    required this.requestId,
    required this.kind,
    required this.displayName,
    this.detail = '',
    this.avatarUrl,
    this.amountLabel,
  });

  final String requestId;
  final TalkHostRequestKind kind;
  final String displayName;
  final String detail;
  final String? avatarUrl;
  final String? amountLabel;

  factory TalkHostRequest.fromJson(Map<String, dynamic> json) {
    final kind = switch (json['kind']) {
      'sponsored_expert' => TalkHostRequestKind.sponsoredExpert,
      'sponsored_twin' => TalkHostRequestKind.sponsoredTwin,
      _ => TalkHostRequestKind.humanSpeaker,
    };
    return TalkHostRequest(
      requestId: json['requestId'] as String? ?? '',
      kind: kind,
      displayName: json['displayName'] as String? ?? '',
      detail: json['detail'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      amountLabel: json['amountLabel'] as String?,
    );
  }
}

class TalkHostParticipant {
  const TalkHostParticipant({
    required this.participantId,
    required this.displayName,
    required this.kind,
    required this.isHost,
    required this.isMuted,
    this.userId,
    this.profileHandle,
    this.personaId,
    this.avatarUrl,
  });

  final String participantId;
  final String displayName;
  final TalkParticipantKind kind;
  final bool isHost;
  final bool isMuted;
  final String? userId;
  final String? profileHandle;
  final String? personaId;
  final String? avatarUrl;

  factory TalkHostParticipant.fromJson(Map<String, dynamic> json) {
    final kind = switch (json['kind']) {
      'expert' => TalkParticipantKind.expert,
      'twin' => TalkParticipantKind.twin,
      _ => TalkParticipantKind.human,
    };
    return TalkHostParticipant(
      participantId: json['participantId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      kind: kind,
      isHost: json['isHost'] == true,
      isMuted: json['isMuted'] == true,
      userId: json['userId'] as String?,
      profileHandle: json['profileHandle'] as String?,
      personaId: json['personaId'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
    );
  }
}

class TalkHostControlsView {
  const TalkHostControlsView({
    this.requests = const [],
    this.participants = const [],
  });

  final List<TalkHostRequest> requests;
  final List<TalkHostParticipant> participants;

  factory TalkHostControlsView.fromJson(Map<String, dynamic> json) {
    final rawRequests = json['requests'];
    final rawParticipants = json['participants'];
    return TalkHostControlsView(
      requests: rawRequests is List
          ? [
              for (final item in rawRequests)
                if (item is Map)
                  TalkHostRequest.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
      participants: rawParticipants is List
          ? [
              for (final item in rawParticipants)
                if (item is Map)
                  TalkHostParticipant.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

abstract interface class TalkHostControlsTransport {
  Future<TalkHostControlsView> load(String talkId);

  Future<TalkHostControlsView> actOnRequest({
    required String talkId,
    required String requestId,
    required TalkHostRequestAction action,
  });

  Future<TalkHostControlsView> actOnParticipant({
    required String talkId,
    required String participantId,
    required TalkHostParticipantAction action,
  });

  Future<void> endTalk(String talkId);
}

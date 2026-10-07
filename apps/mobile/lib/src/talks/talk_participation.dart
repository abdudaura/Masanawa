enum TalkHandStatus { idle, raised, accepted, declined }

class TalkParticipationState {
  const TalkParticipationState({
    this.handStatus = TalkHandStatus.idle,
    this.reaction,
  });

  final TalkHandStatus handStatus;
  final String? reaction;

  factory TalkParticipationState.fromJson(Map<String, dynamic> json) {
    final handStatus = switch (json['handStatus']) {
      'raised' => TalkHandStatus.raised,
      'accepted' => TalkHandStatus.accepted,
      'declined' => TalkHandStatus.declined,
      _ => TalkHandStatus.idle,
    };
    return TalkParticipationState(
      handStatus: handStatus,
      reaction: json['reaction'] as String?,
    );
  }
}

abstract interface class TalkParticipationTransport {
  Future<TalkParticipationState> load(String talkId);

  Future<TalkParticipationState> react({
    required String talkId,
    required String reaction,
  });

  Future<TalkParticipationState> setHandRaised({
    required String talkId,
    required bool raised,
  });
}

enum TalkActivityFilter { all, talks, money, social }

enum TalkActivityKind {
  talkInvitation,
  raiseHandAccepted,
  raiseHandDeclined,
  aiSeatSponsored,
  aiSeatAccepted,
  aiSeatDeclined,
  follow,
  gift,
  twinHired,
  earning,
  replayMilestone,
  platform,
}

class TalkActivityItem {
  const TalkActivityItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.detail,
    required this.createdAt,
    this.talkId,
    this.profilePublicId,
    this.personaId,
    this.transactionId,
    this.amountLabel,
    this.requiresAction = false,
    this.actionLabel,
    this.unread = false,
  });

  final String id;
  final TalkActivityKind kind;
  final String title;
  final String detail;
  final DateTime createdAt;
  final String? talkId;
  final String? profilePublicId;
  final String? personaId;
  final String? transactionId;
  final String? amountLabel;
  final bool requiresAction;
  final String? actionLabel;
  final bool unread;

  factory TalkActivityItem.fromJson(Map<String, dynamic> json) {
    final kind = switch (json['kind']) {
      'talk_invitation' => TalkActivityKind.talkInvitation,
      'raise_hand_accepted' => TalkActivityKind.raiseHandAccepted,
      'raise_hand_declined' => TalkActivityKind.raiseHandDeclined,
      'ai_seat_sponsored' => TalkActivityKind.aiSeatSponsored,
      'ai_seat_accepted' => TalkActivityKind.aiSeatAccepted,
      'ai_seat_declined' => TalkActivityKind.aiSeatDeclined,
      'follow' => TalkActivityKind.follow,
      'gift' => TalkActivityKind.gift,
      'twin_hired' => TalkActivityKind.twinHired,
      'earning' => TalkActivityKind.earning,
      'replay_milestone' => TalkActivityKind.replayMilestone,
      _ => TalkActivityKind.platform,
    };

    return TalkActivityItem(
      id: json['id'] as String? ?? '',
      kind: kind,
      title: json['title'] as String? ?? '',
      detail: json['detail'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      talkId: json['talkId'] as String?,
      profilePublicId: json['profilePublicId'] as String?,
      personaId: json['personaId'] as String?,
      transactionId: json['transactionId'] as String?,
      amountLabel: json['amountLabel'] as String?,
      requiresAction: json['requiresAction'] == true,
      actionLabel: json['actionLabel'] as String?,
      unread: json['unread'] == true,
    );
  }
}

abstract interface class TalkActivityTransport {
  Future<void> markRead({required String activityId});

  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  });

  Future<void> respondToInvitation({
    required String talkId,
    required bool accept,
  });
}

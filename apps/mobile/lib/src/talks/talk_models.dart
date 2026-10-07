enum TalkFeedKind { explore, live }

enum TalkParticipantKind { human, expert, twin }

class TalkParticipantPreview {
  const TalkParticipantPreview({
    required this.id,
    required this.name,
    required this.kind,
    this.avatarUrl,
    this.isHost = false,
  });

  final String id;
  final String name;
  final TalkParticipantKind kind;
  final String? avatarUrl;
  final bool isHost;

  factory TalkParticipantPreview.fromJson(Map<String, dynamic> json) {
    final kind = switch (json['kind']) {
      'expert' => TalkParticipantKind.expert,
      'twin' => TalkParticipantKind.twin,
      _ => TalkParticipantKind.human,
    };
    return TalkParticipantPreview(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      kind: kind,
      avatarUrl: json['avatarUrl'] as String?,
      isHost: json['isHost'] == true,
    );
  }
}

class TalkDiscoveryItem {
  const TalkDiscoveryItem({
    required this.id,
    required this.title,
    required this.hostName,
    required this.isLive,
    required this.listenerCount,
    this.summary = '',
    this.topic,
    this.heroImageUrl,
    this.hostAvatarUrl,
    this.commentCount = 0,
    this.durationSeconds,
    this.viewerIsHost = false,
    this.participants = const [],
  });

  final String id;
  final String title;
  final String summary;
  final String hostName;
  final String? topic;
  final String? heroImageUrl;
  final String? hostAvatarUrl;
  final bool isLive;
  final int listenerCount;
  final int commentCount;
  final int? durationSeconds;
  final bool viewerIsHost;
  final List<TalkParticipantPreview> participants;

  factory TalkDiscoveryItem.fromJson(Map<String, dynamic> json) {
    final rawParticipants = json['participants'];
    return TalkDiscoveryItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      hostName: json['hostName'] as String? ?? '',
      topic: json['topic'] as String?,
      heroImageUrl: json['heroImageUrl'] as String?,
      hostAvatarUrl: json['hostAvatarUrl'] as String?,
      isLive: json['isLive'] == true,
      listenerCount: (json['listenerCount'] as num?)?.toInt() ?? 0,
      commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      viewerIsHost: json['viewerIsHost'] == true,
      participants: rawParticipants is List
          ? [
              for (final item in rawParticipants)
                if (item is Map)
                  TalkParticipantPreview.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

class TalkComment {
  const TalkComment({
    required this.id,
    required this.authorName,
    required this.body,
    required this.createdAt,
    this.authorAvatarUrl,
    this.likeCount = 0,
  });

  final String id;
  final String authorName;
  final String body;
  final DateTime createdAt;
  final String? authorAvatarUrl;
  final int likeCount;

  factory TalkComment.fromJson(Map<String, dynamic> json) {
    return TalkComment(
      id: json['id'] as String? ?? '',
      authorName: json['authorName'] as String? ?? '',
      body: json['body'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      authorAvatarUrl: json['authorAvatarUrl'] as String?,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class TalkDetail {
  const TalkDetail({
    required this.talk,
    this.comments = const [],
  });

  final TalkDiscoveryItem talk;
  final List<TalkComment> comments;

  factory TalkDetail.fromJson(Map<String, dynamic> json) {
    final rawTalk = json['talk'];
    final rawComments = json['comments'];
    if (rawTalk is! Map) {
      throw const FormatException('Invalid Talk detail response');
    }
    return TalkDetail(
      talk: TalkDiscoveryItem.fromJson(rawTalk.cast<String, dynamic>()),
      comments: rawComments is List
          ? [
              for (final item in rawComments)
                if (item is Map)
                  TalkComment.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

abstract interface class TalkTransport {
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed);
  Future<TalkDetail> loadTalk(String talkId);
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  });
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  });
}

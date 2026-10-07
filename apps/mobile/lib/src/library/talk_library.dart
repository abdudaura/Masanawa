import '../talks/talk_models.dart';

class TalkDraftPreview {
  const TalkDraftPreview({
    required this.id,
    required this.topic,
    required this.updatedAt,
    this.title = '',
  });

  final String id;
  final String topic;
  final String title;
  final DateTime updatedAt;

  factory TalkDraftPreview.fromJson(Map<String, dynamic> json) {
    return TalkDraftPreview(
      id: json['id'] as String? ?? '',
      topic: json['topic'] as String? ?? '',
      title: json['title'] as String? ?? '',
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class MyTalksView {
  const MyTalksView({
    this.live = const [],
    this.replays = const [],
    this.drafts = const [],
  });

  final List<TalkDiscoveryItem> live;
  final List<TalkDiscoveryItem> replays;
  final List<TalkDraftPreview> drafts;

  factory MyTalksView.fromJson(Map<String, dynamic> json) {
    List<TalkDiscoveryItem> talks(dynamic raw) => raw is List
        ? [
            for (final item in raw)
              if (item is Map)
                TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
          ]
        : const [];

    final rawDrafts = json['drafts'];
    return MyTalksView(
      live: talks(json['live']),
      replays: talks(json['replays']),
      drafts: rawDrafts is List
          ? [
              for (final item in rawDrafts)
                if (item is Map)
                  TalkDraftPreview.fromJson(item.cast<String, dynamic>()),
            ]
          : const [],
    );
  }
}

class TalkSavedState {
  const TalkSavedState({
    required this.talkId,
    required this.saved,
  });

  final String talkId;
  final bool saved;

  factory TalkSavedState.fromJson(Map<String, dynamic> json) {
    return TalkSavedState(
      talkId: json['talkId'] as String? ?? '',
      saved: json['saved'] == true,
    );
  }
}

abstract interface class TalkLibraryTransport {
  Future<MyTalksView> loadMyTalks();
  Future<List<TalkDiscoveryItem>> loadSavedTalks();
  Future<TalkSavedState> loadSavedState(String talkId);
  Future<TalkSavedState> setSaved({
    required String talkId,
    required bool saved,
  });
}

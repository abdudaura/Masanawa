enum TalkReplayStatus {
  recording,
  processing,
  privateReplay,
  published,
  blocked,
  unavailable,
}

class TalkReplayView {
  const TalkReplayView({
    required this.talkId,
    required this.status,
    required this.published,
    this.durationSeconds,
    this.playbackUrl,
    this.playbackExpiresAt,
  });

  final String talkId;
  final TalkReplayStatus status;
  final bool published;
  final int? durationSeconds;
  final String? playbackUrl;
  final DateTime? playbackExpiresAt;

  bool get canPlay =>
      status == TalkReplayStatus.published &&
      playbackUrl != null &&
      playbackUrl!.isNotEmpty;

  factory TalkReplayView.fromJson(Map<String, dynamic> json) {
    final status = switch (json['status']) {
      'recording' => TalkReplayStatus.recording,
      'processing' => TalkReplayStatus.processing,
      'private' => TalkReplayStatus.privateReplay,
      'published' => TalkReplayStatus.published,
      'blocked' => TalkReplayStatus.blocked,
      _ => TalkReplayStatus.unavailable,
    };
    return TalkReplayView(
      talkId: json['talkId'] as String? ?? '',
      status: status,
      published: json['published'] == true,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      playbackUrl: json['playbackUrl'] as String?,
      playbackExpiresAt:
          DateTime.tryParse(json['playbackExpiresAt'] as String? ?? ''),
    );
  }
}

abstract interface class TalkReplayTransport {
  Future<TalkReplayView> load(String talkId);
  Future<TalkReplayView> setPublished({
    required String talkId,
    required bool published,
  });
}

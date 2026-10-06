enum StoryReaction {
  like,
  love,
  funny,
  thoughtful;

  static StoryReaction fromWire(String value) {
    switch (value) {
      case 'like':
        return StoryReaction.like;
      case 'love':
        return StoryReaction.love;
      case 'funny':
        return StoryReaction.funny;
      case 'thoughtful':
        return StoryReaction.thoughtful;
      default:
        throw FormatException('Unknown story reaction: ' + value);
    }
  }

  String get wireName => name;
}

class StoryRadioEpisode {
  const StoryRadioEpisode({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.episodeNumber,
    required this.durationSeconds,
    required this.audioUrl,
    required this.publishedAt,
    this.description = '',
    this.artworkUrl,
    this.nextEpisodeId,
  });

  final String id;
  final String seriesId;
  final String title;
  final int episodeNumber;
  final int durationSeconds;
  final String audioUrl;
  final DateTime publishedAt;
  final String description;
  final String? artworkUrl;
  final String? nextEpisodeId;

  factory StoryRadioEpisode.fromJson(Map<String, dynamic> json) {
    final episodeNumber = json['episodeNumber'];
    final durationSeconds = json['durationSeconds'];
    if (episodeNumber is! int || episodeNumber < 1) {
      throw const FormatException('Invalid Story Radio episode number');
    }
    if (durationSeconds is! int || durationSeconds < 1) {
      throw const FormatException('Invalid Story Radio episode duration');
    }

    final audioUrl = _requiredString(json, 'audioUrl');
    _requireHttps(audioUrl, 'Story Radio audioUrl must use HTTPS');

    return StoryRadioEpisode(
      id: _requiredString(json, 'id'),
      seriesId: _requiredString(json, 'seriesId'),
      title: _requiredString(json, 'title'),
      episodeNumber: episodeNumber,
      durationSeconds: durationSeconds,
      audioUrl: audioUrl,
      publishedAt: DateTime.parse(_requiredString(json, 'publishedAt')).toUtc(),
      description: (json['description'] as String?)?.trim() ?? '',
      artworkUrl: _optionalHttpsUrl(json['artworkUrl']),
      nextEpisodeId: _optionalString(json['nextEpisodeId']),
    );
  }
}

class StoryRadioSeries {
  const StoryRadioSeries({
    required this.id,
    required this.title,
    required this.language,
    required this.description,
    required this.episodes,
    this.artworkUrl,
    this.audienceLabel,
  });

  final String id;
  final String title;
  final String language;
  final String description;
  final List<StoryRadioEpisode> episodes;
  final String? artworkUrl;
  final String? audienceLabel;

  StoryRadioEpisode? episodeById(String id) {
    for (final episode in episodes) {
      if (episode.id == id) return episode;
    }
    return null;
  }

  factory StoryRadioSeries.fromJson(Map<String, dynamic> json) {
    final rawEpisodes = json['episodes'];
    if (rawEpisodes is! List) {
      throw const FormatException('Story Radio series episodes are invalid');
    }

    final episodes = <StoryRadioEpisode>[
      for (final raw in rawEpisodes)
        if (raw is Map)
          StoryRadioEpisode.fromJson(raw.cast<String, dynamic>()),
    ]..sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));

    if (episodes.isEmpty) {
      throw const FormatException('Published Story Radio series has no episodes');
    }

    final id = _requiredString(json, 'id');
    if (episodes.any((episode) => episode.seriesId != id)) {
      throw const FormatException('Story Radio episode belongs to another series');
    }

    return StoryRadioSeries(
      id: id,
      title: _requiredString(json, 'title'),
      language: _requiredString(json, 'language'),
      description: (json['description'] as String?)?.trim() ?? '',
      episodes: List.unmodifiable(episodes),
      artworkUrl: _optionalHttpsUrl(json['artworkUrl']),
      audienceLabel: _optionalString(json['audienceLabel']),
    );
  }
}

class StoryListeningProgress {
  const StoryListeningProgress({
    required this.seriesId,
    required this.episodeId,
    required this.positionSeconds,
    required this.durationSeconds,
    required this.completed,
    required this.updatedAt,
  });

  final String seriesId;
  final String episodeId;
  final int positionSeconds;
  final int durationSeconds;
  final bool completed;
  final DateTime updatedAt;

  double get fraction {
    if (durationSeconds <= 0) return 0;
    return (positionSeconds / durationSeconds).clamp(0, 1).toDouble();
  }

  factory StoryListeningProgress.fromJson(Map<String, dynamic> json) {
    final position = json['positionSeconds'];
    final duration = json['durationSeconds'];
    if (position is! int || position < 0 || duration is! int || duration < 1) {
      throw const FormatException('Invalid Story Radio listening progress');
    }
    if (position > duration) {
      throw const FormatException('Story Radio progress exceeds duration');
    }
    return StoryListeningProgress(
      seriesId: _requiredString(json, 'seriesId'),
      episodeId: _requiredString(json, 'episodeId'),
      positionSeconds: position,
      durationSeconds: duration,
      completed: json['completed'] == true,
      updatedAt: DateTime.parse(_requiredString(json, 'updatedAt')).toUtc(),
    );
  }
}

class StoryReactionSummary {
  const StoryReactionSummary({
    required this.counts,
    this.mine,
  });

  final Map<StoryReaction, int> counts;
  final StoryReaction? mine;

  factory StoryReactionSummary.fromJson(Map<String, dynamic> json) {
    final rawCounts = json['counts'];
    final counts = <StoryReaction, int>{};
    if (rawCounts is Map) {
      for (final entry in rawCounts.entries) {
        if (entry.key is! String || entry.value is! int || entry.value < 0) {
          throw const FormatException('Invalid Story Radio reaction counts');
        }
        counts[StoryReaction.fromWire(entry.key as String)] = entry.value as int;
      }
    }

    final mine = json['mine'];
    return StoryReactionSummary(
      counts: Map.unmodifiable(counts),
      mine: mine is String ? StoryReaction.fromWire(mine) : null,
    );
  }
}

class StoryRadioSeriesCard {
  const StoryRadioSeriesCard({
    required this.id,
    required this.title,
    required this.language,
    required this.description,
    required this.episodeCount,
    this.artworkUrl,
  });

  final String id;
  final String title;
  final String language;
  final String description;
  final int episodeCount;
  final String? artworkUrl;

  factory StoryRadioSeriesCard.fromJson(Map<String, dynamic> json) {
    final episodeCount = json['episodeCount'];
    if (episodeCount is! int || episodeCount < 1) {
      throw const FormatException('Invalid Story Radio episode count');
    }
    return StoryRadioSeriesCard(
      id: _requiredString(json, 'id'),
      title: _requiredString(json, 'title'),
      language: _requiredString(json, 'language'),
      description: (json['description'] as String?)?.trim() ?? '',
      episodeCount: episodeCount,
      artworkUrl: _optionalHttpsUrl(json['artworkUrl']),
    );
  }
}

class StoryRadioHome {
  const StoryRadioHome({
    required this.series,
    this.featured,
    this.continueProgress,
  });

  final StoryRadioSeriesCard? featured;
  final List<StoryRadioSeriesCard> series;
  final StoryListeningProgress? continueProgress;

  factory StoryRadioHome.fromJson(Map<String, dynamic> json) {
    final rawSeries = json['series'];
    if (rawSeries is! List) {
      throw const FormatException('Invalid Story Radio home series');
    }
    final rawFeatured = json['featured'];
    final rawProgress = json['continueProgress'];
    return StoryRadioHome(
      featured: rawFeatured is Map
          ? StoryRadioSeriesCard.fromJson(rawFeatured.cast<String, dynamic>())
          : null,
      series: List.unmodifiable([
        for (final raw in rawSeries)
          if (raw is Map)
            StoryRadioSeriesCard.fromJson(raw.cast<String, dynamic>()),
      ]),
      continueProgress: rawProgress is Map
          ? StoryListeningProgress.fromJson(rawProgress.cast<String, dynamic>())
          : null,
    );
  }
}

abstract class StoryRadioTransport {
  Future<StoryRadioHome> loadHome();

  Future<StoryRadioSeries> loadSeries(String seriesId);

  Future<StoryListeningProgress> saveProgress({
    required String seriesId,
    required String episodeId,
    required int positionSeconds,
    required int durationSeconds,
    required bool completed,
  });

  Future<StoryReactionSummary> loadReactions(String episodeId);

  Future<StoryReactionSummary> react({
    required String episodeId,
    required StoryReaction reaction,
  });
}

class UnavailableStoryRadioTransport implements StoryRadioTransport {
  const UnavailableStoryRadioTransport();

  Never _unavailable() {
    throw StateError('Story Radio is not connected to the Gateway yet');
  }

  @override
  Future<StoryRadioHome> loadHome() async => _unavailable();

  @override
  Future<StoryRadioSeries> loadSeries(String seriesId) async => _unavailable();

  @override
  Future<StoryListeningProgress> saveProgress({
    required String seriesId,
    required String episodeId,
    required int positionSeconds,
    required int durationSeconds,
    required bool completed,
  }) async => _unavailable();

  @override
  Future<StoryReactionSummary> loadReactions(String episodeId) async =>
      _unavailable();

  @override
  Future<StoryReactionSummary> react({
    required String episodeId,
    required StoryReaction reaction,
  }) async => _unavailable();
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Story Radio value is missing ' + key);
  }
  return value.trim();
}

String? _optionalString(dynamic value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

String? _optionalHttpsUrl(dynamic value) {
  final raw = _optionalString(value);
  if (raw == null) return null;
  _requireHttps(raw, 'Story Radio media URL must use HTTPS');
  return raw;
}

void _requireHttps(String value, String message) {
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
    throw FormatException(message);
  }
}

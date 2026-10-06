import 'package:dio/dio.dart';

import 'admin_auth_api.dart';

class StoryAdminEpisode {
  const StoryAdminEpisode({
    required this.episodeId,
    required this.seriesId,
    required this.seasonNumber,
    required this.episodeNumber,
    required this.title,
    required this.description,
    required this.durationSeconds,
    required this.audioUrl,
    required this.state,
    this.artworkUrl,
  });

  final String episodeId;
  final String seriesId;
  final int seasonNumber;
  final int episodeNumber;
  final String title;
  final String description;
  final int durationSeconds;
  final String audioUrl;
  final String state;
  final String? artworkUrl;

  bool get published => state == 'published';

  factory StoryAdminEpisode.fromJson(Map<String, dynamic> json) =>
      StoryAdminEpisode(
        episodeId: json['episodeId'] as String,
        seriesId: json['seriesId'] as String,
        seasonNumber: json['seasonNumber'] as int? ?? 1,
        episodeNumber: json['episodeNumber'] as int? ?? 1,
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        durationSeconds: json['durationSeconds'] as int? ?? 1,
        audioUrl: json['audioUrl'] as String? ?? '',
        artworkUrl: json['artworkUrl'] as String?,
        state: json['state'] as String? ?? 'draft',
      );
}

class StoryAdminSeries {
  const StoryAdminSeries({
    required this.seriesId,
    required this.title,
    required this.description,
    required this.language,
    required this.state,
    required this.episodes,
    this.audienceLabel,
    this.artworkUrl,
  });

  final String seriesId;
  final String title;
  final String description;
  final String language;
  final String state;
  final String? audienceLabel;
  final String? artworkUrl;
  final List<StoryAdminEpisode> episodes;

  bool get published => state == 'published';

  factory StoryAdminSeries.fromJson(Map<String, dynamic> json) =>
      StoryAdminSeries(
        seriesId: json['seriesId'] as String,
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        language: json['language'] as String? ?? 'English',
        audienceLabel: json['audienceLabel'] as String?,
        artworkUrl: json['artworkUrl'] as String?,
        state: json['state'] as String? ?? 'draft',
        episodes: (json['episodes'] as List<dynamic>? ?? const [])
            .map((item) => StoryAdminEpisode.fromJson(
                  Map<String, dynamic>.from(item as Map),
                ))
            .toList(growable: false),
      );
}

class StoryRadioAdminApi {
  StoryRadioAdminApi({
    required String token,
    required this.refreshAccessToken,
    Dio? dio,
  })  : _token = token.trim(),
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: requireAdminAuthBaseUrl(),
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 20),
                headers: {'Accept': 'application/json'},
              ),
            );

  String _token;
  final Future<String?> Function()? refreshAccessToken;
  final Dio _dio;

  Options get _auth => Options(
        headers: {'Authorization': 'Bearer $_token'},
      );

  Map<String, dynamic> _map(dynamic value) =>
      Map<String, dynamic>.from(value as Map);

  Future<Response<dynamic>> _request(
    Future<Response<dynamic>> Function() send, {
    bool allowRefresh = true,
  }) async {
    try {
      return await send();
    } on DioException catch (error) {
      if (allowRefresh && error.response?.statusCode == 401) {
        final refreshed = await refreshAccessToken?.call();
        if (refreshed != null && refreshed.trim().isNotEmpty) {
          _token = refreshed.trim();
          return _request(send, allowRefresh: false);
        }
      }
      final data = error.response?.data;
      final code = data is Map && data['error'] is Map
          ? (data['error'] as Map)['code']?.toString()
          : null;
      final message = switch (code) {
        'story_radio.series.requires_published_episode' =>
          'Publish at least one episode before publishing this series.',
        'story_radio.episode.last_published_in_live_series' =>
          'Unpublish the series before unpublishing its last live episode.',
        'story_radio.admin.forbidden' =>
          'This admin account is not allowed to publish Story Radio.',
        _ => data is Map
            ? (data['error'] is Map
                ? (data['error'] as Map)['message']?.toString()
                : data['message']?.toString())
            : null,
      };
      throw Exception(message ?? 'Story Radio administration failed.');
    }
  }

  Future<List<StoryAdminSeries>> listSeries() async {
    final response = await _request(
      () => _dio.get<dynamic>('/admin/story-radio', options: _auth),
    );
    final data = _map(response.data);
    return (data['series'] as List<dynamic>? ?? const [])
        .map((item) => StoryAdminSeries.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<StoryAdminSeries> createSeries({
    required String title,
    required String description,
    required String language,
    String? audienceLabel,
    String? artworkUrl,
  }) async {
    final response = await _request(
      () => _dio.post<dynamic>(
        '/admin/story-radio/series',
        options: _auth,
        data: {
          'title': title.trim(),
          'description': description.trim(),
          'language': language.trim(),
          'audienceLabel': _nullable(audienceLabel),
          'artworkUrl': _nullable(artworkUrl),
        },
      ),
    );
    return StoryAdminSeries.fromJson({..._map(response.data), 'episodes': const []});
  }

  Future<StoryAdminSeries> updateSeries(
    StoryAdminSeries current, {
    required String title,
    required String description,
    required String language,
    String? audienceLabel,
    String? artworkUrl,
  }) async {
    final response = await _request(
      () => _dio.put<dynamic>(
        '/admin/story-radio/series/' + Uri.encodeComponent(current.seriesId),
        options: _auth,
        data: {
          'title': title.trim(),
          'description': description.trim(),
          'language': language.trim(),
          'audienceLabel': _nullable(audienceLabel),
          'artworkUrl': _nullable(artworkUrl),
        },
      ),
    );
    return StoryAdminSeries.fromJson({
      ..._map(response.data),
      'episodes': [
        for (final episode in current.episodes)
          {
            'episodeId': episode.episodeId,
            'seriesId': episode.seriesId,
            'seasonNumber': episode.seasonNumber,
            'episodeNumber': episode.episodeNumber,
            'title': episode.title,
            'description': episode.description,
            'durationSeconds': episode.durationSeconds,
            'audioUrl': episode.audioUrl,
            'artworkUrl': episode.artworkUrl,
            'state': episode.state,
          },
      ],
    });
  }

  Future<void> setSeriesPublished(
    String seriesId, {
    required bool published,
  }) async {
    await _request(
      () => _dio.post<dynamic>(
        '/admin/story-radio/series/' +
            Uri.encodeComponent(seriesId) +
            '/publication',
        options: _auth,
        data: {'published': published},
      ),
    );
  }

  Future<StoryAdminEpisode> createEpisode({
    required String seriesId,
    required int seasonNumber,
    required int episodeNumber,
    required String title,
    required String description,
    required int durationSeconds,
    required String audioUrl,
    String? artworkUrl,
  }) async {
    final response = await _request(
      () => _dio.post<dynamic>(
        '/admin/story-radio/series/' +
            Uri.encodeComponent(seriesId) +
            '/episodes',
        options: _auth,
        data: {
          'seasonNumber': seasonNumber,
          'episodeNumber': episodeNumber,
          'title': title.trim(),
          'description': description.trim(),
          'durationSeconds': durationSeconds,
          'audioUrl': audioUrl.trim(),
          'artworkUrl': _nullable(artworkUrl),
        },
      ),
    );
    return StoryAdminEpisode.fromJson(_map(response.data));
  }

  Future<StoryAdminEpisode> updateEpisode(
    StoryAdminEpisode current, {
    required int seasonNumber,
    required int episodeNumber,
    required String title,
    required String description,
    required int durationSeconds,
    required String audioUrl,
    String? artworkUrl,
  }) async {
    final response = await _request(
      () => _dio.put<dynamic>(
        '/admin/story-radio/episodes/' +
            Uri.encodeComponent(current.episodeId),
        options: _auth,
        data: {
          'seasonNumber': seasonNumber,
          'episodeNumber': episodeNumber,
          'title': title.trim(),
          'description': description.trim(),
          'durationSeconds': durationSeconds,
          'audioUrl': audioUrl.trim(),
          'artworkUrl': _nullable(artworkUrl),
        },
      ),
    );
    return StoryAdminEpisode.fromJson(_map(response.data));
  }

  Future<void> setEpisodePublished(
    String episodeId, {
    required bool published,
  }) async {
    await _request(
      () => _dio.post<dynamic>(
        '/admin/story-radio/episodes/' +
            Uri.encodeComponent(episodeId) +
            '/publication',
        options: _auth,
        data: {'published': published},
      ),
    );
  }

  String? _nullable(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

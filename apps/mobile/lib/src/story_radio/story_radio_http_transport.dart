import '../core/network/api_client.dart';
import '../story_radio/story_radio.dart';

class GatewayStoryRadioTransport implements StoryRadioTransport {
  GatewayStoryRadioTransport({required this.api});

  final ApiClient api;

  @override
  Future<StoryRadioHome> loadHome() async {
    final response = await api.dio.get<dynamic>('/story-radio/home');
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return StoryRadioHome.fromJson(data);
    }
    if (data is Map) {
      return StoryRadioHome.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Story Radio home response');
  }

  @override
  Future<StoryRadioSeries> loadSeries(String seriesId) async {
    final response = await api.dio.get<dynamic>(
      '/story-radio/series/' + Uri.encodeComponent(seriesId),
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return StoryRadioSeries.fromJson(data);
    }
    if (data is Map) {
      return StoryRadioSeries.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Story Radio series response');
  }

  @override
  Future<StoryListeningProgress> saveProgress({
    required String seriesId,
    required String episodeId,
    required int positionSeconds,
    required int durationSeconds,
    required bool completed,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/story-radio/progress',
      data: {
        'seriesId': seriesId,
        'episodeId': episodeId,
        'positionSeconds': positionSeconds,
        'durationSeconds': durationSeconds,
        'completed': completed,
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return StoryListeningProgress.fromJson(data);
    }
    if (data is Map) {
      return StoryListeningProgress.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Story Radio progress response');
  }

  @override
  Future<StoryReactionSummary> loadReactions(String episodeId) async {
    final response = await api.dio.get<dynamic>(
      '/story-radio/episodes/' +
          Uri.encodeComponent(episodeId) +
          '/reactions',
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return StoryReactionSummary.fromJson(data);
    }
    if (data is Map) {
      return StoryReactionSummary.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Story Radio reaction response');
  }

  @override
  Future<StoryReactionSummary> react({
    required String episodeId,
    required StoryReaction reaction,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/story-radio/episodes/' +
          Uri.encodeComponent(episodeId) +
          '/reaction',
      data: {'reaction': reaction.wireName},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) {
      return StoryReactionSummary.fromJson(data);
    }
    if (data is Map) {
      return StoryReactionSummary.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Story Radio reaction response');
  }
}

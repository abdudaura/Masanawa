import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../story_radio/story_radio.dart';

final storyRadioTransportProvider = Provider<StoryRadioTransport>(
  (ref) => const UnavailableStoryRadioTransport(),
);

class StoryRadioState {
  const StoryRadioState({
    this.home,
    this.seriesById = const {},
    this.reactionsByEpisodeId = const {},
    this.loadingHome = false,
    this.loadingSeriesId,
    this.error,
  });

  final StoryRadioHome? home;
  final Map<String, StoryRadioSeries> seriesById;
  final Map<String, StoryReactionSummary> reactionsByEpisodeId;
  final bool loadingHome;
  final String? loadingSeriesId;
  final String? error;

  StoryRadioState copyWith({
    StoryRadioHome? home,
    Map<String, StoryRadioSeries>? seriesById,
    Map<String, StoryReactionSummary>? reactionsByEpisodeId,
    bool? loadingHome,
    String? loadingSeriesId,
    bool clearLoadingSeries = false,
    String? error,
    bool clearError = false,
  }) {
    return StoryRadioState(
      home: home ?? this.home,
      seriesById: seriesById ?? this.seriesById,
      reactionsByEpisodeId:
          reactionsByEpisodeId ?? this.reactionsByEpisodeId,
      loadingHome: loadingHome ?? this.loadingHome,
      loadingSeriesId:
          clearLoadingSeries ? null : (loadingSeriesId ?? this.loadingSeriesId),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class StoryRadioController extends StateNotifier<StoryRadioState> {
  StoryRadioController(this._transport) : super(const StoryRadioState());

  final StoryRadioTransport _transport;

  Future<void> loadHome() async {
    state = state.copyWith(loadingHome: true, clearError: true);
    try {
      final home = await _transport.loadHome();
      state = state.copyWith(
        home: home,
        loadingHome: false,
        clearError: true,
      );
    } catch (_) {
      state = state.copyWith(
        loadingHome: false,
        error: 'Story Radio is not available right now.',
      );
    }
  }

  Future<StoryRadioSeries?> loadSeries(String seriesId) async {
    final cached = state.seriesById[seriesId];
    if (cached != null) return cached;

    state = state.copyWith(
      loadingSeriesId: seriesId,
      clearError: true,
    );
    try {
      final series = await _transport.loadSeries(seriesId);
      state = state.copyWith(
        seriesById: {
          ...state.seriesById,
          series.id: series,
        },
        clearLoadingSeries: true,
        clearError: true,
      );
      return series;
    } catch (_) {
      state = state.copyWith(
        clearLoadingSeries: true,
        error: 'Could not load this story series.',
      );
      return null;
    }
  }

  Future<StoryReactionSummary?> loadReactions(String episodeId) async {
    try {
      final summary = await _transport.loadReactions(episodeId);
      state = state.copyWith(
        reactionsByEpisodeId: {
          ...state.reactionsByEpisodeId,
          episodeId: summary,
        },
        clearError: true,
      );
      return summary;
    } catch (_) {
      state = state.copyWith(error: 'Could not load reactions.');
      return null;
    }
  }

  Future<StoryReactionSummary?> react({
    required String episodeId,
    required StoryReaction reaction,
  }) async {
    try {
      final summary = await _transport.react(
        episodeId: episodeId,
        reaction: reaction,
      );
      state = state.copyWith(
        reactionsByEpisodeId: {
          ...state.reactionsByEpisodeId,
          episodeId: summary,
        },
        clearError: true,
      );
      return summary;
    } catch (_) {
      state = state.copyWith(error: 'Could not save your reaction.');
      return null;
    }
  }

  Future<StoryListeningProgress?> saveProgress({
    required StoryRadioEpisode episode,
    required int positionSeconds,
    required bool completed,
  }) async {
    if (positionSeconds < 0 || positionSeconds > episode.durationSeconds) {
      state = state.copyWith(error: 'Invalid listening position.');
      return null;
    }
    try {
      final progress = await _transport.saveProgress(
        seriesId: episode.seriesId,
        episodeId: episode.id,
        positionSeconds: positionSeconds,
        durationSeconds: episode.durationSeconds,
        completed: completed,
      );
      final current = state.home;
      if (current != null) {
        state = state.copyWith(
          home: StoryRadioHome(
            featured: current.featured,
            series: current.series,
            continueProgress: progress,
          ),
          clearError: true,
        );
      }
      return progress;
    } catch (_) {
      state = state.copyWith(error: 'Could not save listening progress.');
      return null;
    }
  }
}

final storyRadioProvider =
    StateNotifierProvider<StoryRadioController, StoryRadioState>(
  (ref) => StoryRadioController(ref.watch(storyRadioTransportProvider)),
);

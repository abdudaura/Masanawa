import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/state/story_radio_state.dart';
import 'package:masanawa/src/story_radio/story_radio.dart';

class _FakeStoryRadioTransport implements StoryRadioTransport {
  StoryListeningProgress? lastProgress;
  StoryReaction? lastReaction;

  @override
  Future<StoryRadioHome> loadHome() async => StoryRadioHome(
        featured: const StoryRadioSeriesCard(
          id: 'series-1',
          title: 'Night Stories',
          language: 'Hausa',
          description: 'Serialized audio',
          episodeCount: 2,
        ),
        series: const [
          StoryRadioSeriesCard(
            id: 'series-1',
            title: 'Night Stories',
            language: 'Hausa',
            description: 'Serialized audio',
            episodeCount: 2,
          ),
        ],
      );

  @override
  Future<StoryRadioSeries> loadSeries(String seriesId) async =>
      StoryRadioSeries(
        id: seriesId,
        title: 'Night Stories',
        language: 'Hausa',
        description: 'Serialized audio',
        episodes: [
          StoryRadioEpisode(
            id: 'episode-1',
            seriesId: seriesId,
            title: 'First',
            seasonNumber: 1,
            episodeNumber: 1,
            durationSeconds: 120,
            audioUrl: 'https://media.example/first.mp3',
            publishedAt: DateTime.utc(2026, 10, 6),
            nextEpisodeId: 'episode-2',
          ),
          StoryRadioEpisode(
            id: 'episode-2',
            seriesId: seriesId,
            title: 'Second',
            seasonNumber: 1,
            episodeNumber: 2,
            durationSeconds: 180,
            audioUrl: 'https://media.example/second.mp3',
            publishedAt: DateTime.utc(2026, 10, 6),
          ),
        ],
      );

  @override
  Future<StoryListeningProgress> saveProgress({
    required String seriesId,
    required String episodeId,
    required int positionSeconds,
    required int durationSeconds,
    required bool completed,
  }) async {
    final progress = StoryListeningProgress(
      seriesId: seriesId,
      episodeId: episodeId,
      positionSeconds: positionSeconds,
      durationSeconds: durationSeconds,
      completed: completed,
      updatedAt: DateTime.utc(2026, 10, 6, 10),
    );
    lastProgress = progress;
    return progress;
  }

  @override
  Future<StoryReactionSummary> loadReactions(String episodeId) async =>
      const StoryReactionSummary(
        counts: {
          StoryReaction.like: 1,
          StoryReaction.love: 0,
          StoryReaction.funny: 0,
          StoryReaction.thoughtful: 0,
        },
        mine: StoryReaction.like,
      );

  @override
  Future<StoryReactionSummary> react({
    required String episodeId,
    required StoryReaction reaction,
  }) async {
    lastReaction = reaction;
    return StoryReactionSummary(
      counts: {
        StoryReaction.like: reaction == StoryReaction.like ? 1 : 0,
        StoryReaction.love: reaction == StoryReaction.love ? 1 : 0,
        StoryReaction.funny: reaction == StoryReaction.funny ? 1 : 0,
        StoryReaction.thoughtful:
            reaction == StoryReaction.thoughtful ? 1 : 0,
      },
      mine: reaction,
    );
  }
}

void main() {
  test('Story Radio controller loads home and persists resume progress', () async {
    final transport = _FakeStoryRadioTransport();
    final container = ProviderContainer(
      overrides: [
        storyRadioTransportProvider.overrideWithValue(transport),
      ],
    );
    addTearDown(container.dispose);

    await container.read(storyRadioProvider.notifier).loadHome();
    expect(container.read(storyRadioProvider).home?.series.single.id, 'series-1');

    final series =
        await container.read(storyRadioProvider.notifier).loadSeries('series-1');
    final episode = series!.episodes.first;

    await container.read(storyRadioProvider.notifier).saveProgress(
          episode: episode,
          positionSeconds: 45,
          completed: false,
        );

    expect(transport.lastProgress?.positionSeconds, 45);
    expect(
      container.read(storyRadioProvider).home?.continueProgress?.episodeId,
      'episode-1',
    );
  });

  test('Story Radio controller replaces the listener reaction summary', () async {
    final transport = _FakeStoryRadioTransport();
    final container = ProviderContainer(
      overrides: [
        storyRadioTransportProvider.overrideWithValue(transport),
      ],
    );
    addTearDown(container.dispose);

    await container.read(storyRadioProvider.notifier).react(
          episodeId: 'episode-1',
          reaction: StoryReaction.love,
        );

    expect(transport.lastReaction, StoryReaction.love);
    expect(
      container
          .read(storyRadioProvider)
          .reactionsByEpisodeId['episode-1']
          ?.mine,
      StoryReaction.love,
    );
  });
}

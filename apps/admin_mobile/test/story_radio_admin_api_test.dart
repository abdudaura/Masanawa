import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/core/story_radio_admin_api.dart';

void main() {
  test('parses Story Radio admin series with seasons and publication state', () {
    final series = StoryAdminSeries.fromJson({
      'seriesId': 'story_series_1',
      'title': 'Night Stories',
      'description': 'Serialized audio',
      'language': 'Hausa',
      'state': 'published',
      'episodes': [
        {
          'episodeId': 'story_episode_1',
          'seriesId': 'story_series_1',
          'seasonNumber': 2,
          'episodeNumber': 3,
          'title': 'The Journey',
          'description': '',
          'durationSeconds': 420,
          'audioUrl': 'https://media.example/story.mp3',
          'artworkUrl': null,
          'state': 'published',
        },
      ],
    });

    expect(series.published, isTrue);
    expect(series.episodes.single.seasonNumber, 2);
    expect(series.episodes.single.episodeNumber, 3);
    expect(series.episodes.single.published, isTrue);
  });

  test('draft state is never interpreted as published', () {
    final episode = StoryAdminEpisode.fromJson({
      'episodeId': 'story_episode_2',
      'seriesId': 'story_series_1',
      'seasonNumber': 1,
      'episodeNumber': 1,
      'title': 'Draft',
      'description': '',
      'durationSeconds': 120,
      'audioUrl': 'https://media.example/draft.mp3',
      'state': 'draft',
    });

    expect(episode.published, isFalse);
  });
}

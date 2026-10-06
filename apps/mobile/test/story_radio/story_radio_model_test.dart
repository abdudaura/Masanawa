import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/story_radio/story_radio.dart';

void main() {
  group('StoryRadioSeries', () {
    test('parses and sorts published episodes', () {
      final series = StoryRadioSeries.fromJson({
        'id': 'series-1',
        'title': 'The Long Road',
        'language': 'English',
        'description': 'A serialized story.',
        'episodes': [
          {
            'id': 'ep-2',
            'seriesId': 'series-1',
            'title': 'Second',
            'seasonNumber': 1,
            'episodeNumber': 2,
            'durationSeconds': 900,
            'audioUrl': 'https://media.example/ep-2.mp3',
            'publishedAt': '2026-10-06T08:00:00Z',
          },
          {
            'id': 'ep-1',
            'seriesId': 'series-1',
            'title': 'First',
            'seasonNumber': 1,
            'episodeNumber': 1,
            'durationSeconds': 600,
            'audioUrl': 'https://media.example/ep-1.mp3',
            'publishedAt': '2026-10-06T07:00:00Z',
            'nextEpisodeId': 'ep-2',
          },
        ],
      });

      expect(
        series.episodes.map((episode) => episode.id),
        ['ep-1', 'ep-2'],
      );
      expect(series.episodes.first.nextEpisodeId, 'ep-2');
    });

    test('rejects insecure episode audio URL', () {
      expect(
        () => StoryRadioEpisode.fromJson({
          'id': 'ep-1',
          'seriesId': 'series-1',
          'title': 'First',
          'seasonNumber': 1,
            'episodeNumber': 1,
          'durationSeconds': 600,
          'audioUrl': 'http://media.example/ep-1.mp3',
          'publishedAt': '2026-10-06T07:00:00Z',
        }),
        throwsFormatException,
      );
    });

    test('rejects cross-series episode binding', () {
      expect(
        () => StoryRadioSeries.fromJson({
          'id': 'series-1',
          'title': 'Series',
          'language': 'Hausa',
          'episodes': [
            {
              'id': 'ep-1',
              'seriesId': 'series-2',
              'title': 'Wrong',
              'seasonNumber': 1,
            'episodeNumber': 1,
              'durationSeconds': 60,
              'audioUrl': 'https://media.example/ep.mp3',
              'publishedAt': '2026-10-06T07:00:00Z',
            },
          ],
        }),
        throwsFormatException,
      );
    });
  });

  test('listening progress is bounded', () {
    expect(
      () => StoryListeningProgress.fromJson({
        'seriesId': 'series-1',
        'episodeId': 'ep-1',
        'positionSeconds': 101,
        'durationSeconds': 100,
        'completed': false,
        'updatedAt': '2026-10-06T07:00:00Z',
      }),
      throwsFormatException,
    );
  });

  test('reaction wire values are bounded', () {
    expect(StoryReaction.fromWire('love'), StoryReaction.love);
    expect(() => StoryReaction.fromWire('angry'), throwsFormatException);
  });
}

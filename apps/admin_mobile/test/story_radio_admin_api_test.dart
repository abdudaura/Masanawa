import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/core/story_radio_admin_api.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object value, {int statusCode = 200}) =>
    ResponseBody.fromString(
      jsonEncode(value),
      statusCode,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

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

  test('refreshes an expired admin session once and retries with the new token', () async {
    final seenAuthorization = <String?>[];
    var requests = 0;
    var refreshes = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      requests += 1;
      seenAuthorization.add(options.headers['Authorization']?.toString());
      if (requests == 1) {
        return _json({
          'error': {'code': 'customer_auth.session.invalid'},
        }, statusCode: 401);
      }
      return _json({'series': const []});
    });
    final api = StoryRadioAdminApi(
      token: 'expired-token',
      dio: dio,
      refreshAccessToken: () async {
        refreshes += 1;
        return 'fresh-token';
      },
    );

    final series = await api.listSeries();

    expect(series, isEmpty);
    expect(refreshes, 1);
    expect(requests, 2);
    expect(seenAuthorization, ['Bearer expired-token', 'Bearer fresh-token']);
  });


}

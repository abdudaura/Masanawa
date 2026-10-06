import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import 'news_models.dart';

class NewsRoomTransport {
  NewsRoomTransport(this._api);

  final ApiClient _api;

  Future<NewsRoomProjection> load() async {
    try {
      final response = await _api.dio.get<Map<String, dynamic>>('/rooms/news');
      final data = response.data;
      if (data == null) {
        throw const ApiException('News is unavailable right now.');
      }
      return NewsRoomProjection.fromJson(data);
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      throw ApiException(
        status == 503
            ? 'Current news is temporarily unavailable.'
            : 'Could not load current news.',
        statusCode: status,
        code: status == 503 ? 'NEWS_UNAVAILABLE' : 'NEWS_LOAD_FAILED',
      );
    } on FormatException {
      throw const ApiException(
        'News data could not be verified.',
        code: 'NEWS_INVALID_PROJECTION',
      );
    }
  }
}

final newsRoomTransportProvider = Provider<NewsRoomTransport>((ref) {
  return NewsRoomTransport(ref.watch(apiClientProvider));
});

class NewsRoomController extends AsyncNotifier<NewsRoomProjection> {
  @override
  Future<NewsRoomProjection> build() {
    return ref.read(newsRoomTransportProvider).load();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(newsRoomTransportProvider).load(),
    );
  }
}

final newsRoomProvider =
    AsyncNotifierProvider<NewsRoomController, NewsRoomProjection>(
  NewsRoomController.new,
);

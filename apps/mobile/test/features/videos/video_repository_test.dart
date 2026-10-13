import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_repository.dart';

void main() {
  const id = '11111111-1111-4111-8111-111111111111';
  const verified = {
    'id': id, 'title': 'Physics lesson', 'channelName': 'Official Teacher',
    'provider': 'youtube', 'providerVideoId': 'abcDE12_-34',
    'reviewState': 'approved', 'verifiedAt': '2026-10-11T07:00:00Z',
    'sourceUrl': 'https://www.youtube.com/watch?v=abcDE12_-34',
  };

  Dio fakeDio(Object? Function(RequestOptions) respond,
      List<RequestOptions> requests) {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.masanawa.com'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(options);
      final result = respond(options);
      if (result is DioException) {
        handler.reject(result);
        return;
      }
      handler.resolve(Response(requestOptions: options, statusCode: 200,
        data: result));
    }));
    return dio;
  }

  test('C27: canonical catalog, cursor and provider filter', () async {
    final requests = <RequestOptions>[];
    final repo = VideoRepository(fakeDio((_) => {
      'items': [verified], 'nextCursor': id,
    }, requests));
    final page = await repo.page(provider: 'youtube');
    expect(page.items.single.title, 'Physics lesson');
    expect(page.nextCursor, id);
    expect(requests.single.path, '/v1/videos');
    expect(requests.single.queryParameters, {'provider': 'youtube'});
    await expectLater(repo.page(provider: 'untrusted'), throwsFormatException);
    await expectLater(repo.page(before: '../foreign'), throwsFormatException);
    expect(requests, hasLength(1));
  });

  test('C29: every playback request observes immediate removal', () async {
    final requests = <RequestOptions>[];
    var allowed = true;
    final repo = VideoRepository(fakeDio((_) => {'available': allowed},
      requests));
    expect(await repo.isApproved(id), isTrue);
    allowed = false;
    expect(await repo.isApproved(id), isFalse);
    expect(requests.map((r) => r.path),
      everyElement('/v1/videos/$id/availability'));
    expect(requests, hasLength(2));
  });

  test('C29: forged response, foreign ID and 403 never approve', () async {
    final requests = <RequestOptions>[];
    final repo = VideoRepository(fakeDio((_) => {'available': 'true'},
      requests));
    await expectLater(repo.isApproved(id), throwsFormatException);
    await expectLater(repo.isApproved('foreign-id'), throwsFormatException);
    expect(requests, hasLength(1));
    final denied = VideoRepository(fakeDio((options) => DioException(
      requestOptions: options,
      response: Response(requestOptions: options, statusCode: 403),
      type: DioExceptionType.badResponse,
    ), <RequestOptions>[]));
    await expectLater(denied.isApproved(id), throwsA(isA<DioException>()));
  });

  test('C27: pending metadata cannot be rendered as approved video',
      () async {
    final repo = VideoRepository(fakeDio((_) => {
      'items': [{...verified, 'reviewState': 'pending'}],
      'nextCursor': null,
    }, <RequestOptions>[]));
    await expectLater(repo.page(), throwsFormatException);
  });
}

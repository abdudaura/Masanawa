import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';

Map<String, Object?> comment(String id, {String postId = 'talk1'}) => {
  'postId': postId,
  'commentId': id,
  'isMine': false,
  'body': 'Comment $id',
  'createdAt': '2026-10-10T00:00:00.123Z',
  'removed': false,
};

GatewayAudioPostTransport fakeGateway(
  Object? Function(RequestOptions) response,
  List<Uri> requests,
) {
  final dio = Dio(BaseOptions(baseUrl: 'https://test.example'));
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      requests.add(options.uri);
      handler.resolve(Response<dynamic>(
        requestOptions: options, statusCode: 200, data: response(options),
      ));
    },
  ));
  return GatewayAudioPostTransport(ApiClient(dio: dio));
}

void main() {
  test('Gateway paging sends a scoped cursor and returns bounded older comments', () async {
    final requests = <Uri>[];
    final gateway = fakeGateway((request) {
      if (request.uri.queryParameters['cursor'] == null) {
        return {
          'items': [for (var i = 0; i < 50; i++) comment('c$i')],
          'nextCursor': 'c49',
        };
      }
      return {
        'items': [comment('c50'), comment('c51')],
        'nextCursor': null,
      };
    }, requests);
    final first = await gateway.commentsPage(postId: 'talk1');
    expect(first.items.length, 50);
    expect(first.nextCursor, 'c49');
    final older = await gateway.commentsPage(
      postId: 'talk1', cursor: first.nextCursor);
    expect(older.items.map((item) => item.commentId), ['c50', 'c51']);
    expect(older.nextCursor, isNull);
    expect(requests.length, 2);
    expect(requests[0].path, '/v1/audio-posts/talk1/comments/page');
    expect(requests[1].queryParameters['cursor'], 'c49');
    expect(requests.every((request) => !request.queryParameters.containsKey('accountId')),
      isTrue);
  });

  test('rejects wrong-post, removed or repeated comment IDs', () async {
    for (final items in [
      [comment('c1', postId: 'other')],
      [const {
        'postId': 'talk1', 'commentId': 'c2', 'isMine': false, 'body': 'hidden',
        'createdAt': '2026-10-10T00:00:00.123Z', 'removed': true,
      }],
      [comment('c1'), comment('c1')],
    ]) {
      final gateway = fakeGateway((_) =>
        {'items': items, 'nextCursor': null}, <Uri>[]);
      await expectLater(gateway.commentsPage(postId: 'talk1'),
        throwsA(isA<FormatException>()));
    }
  });

  test('refuses untrusted next cursor and oversized page', () async {
    for (final body in [
      {'items': [comment('c1')], 'nextCursor': 'different'},
      {'items': const [], 'nextCursor': 'nonempty'},
      {'items': [for (var i = 0; i < 51; i++) comment('c$i')], 'nextCursor': null},
    ]) {
      final gateway = fakeGateway((_) => body, <Uri>[]);
      await expectLater(gateway.commentsPage(postId: 'talk1'),
        throwsA(isA<FormatException>()));
    }
  });
}

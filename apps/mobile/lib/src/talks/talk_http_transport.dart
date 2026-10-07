import '../core/network/api_client.dart';
import 'talk_models.dart';

class GatewayTalkTransport implements TalkTransport {
  GatewayTalkTransport({required this.api});

  final ApiClient api;

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async {
    final response = await api.dio.get<dynamic>(
      '/talks',
      queryParameters: {
        'feed': feed == TalkFeedKind.live ? 'live' : 'explore',
      },
    );
    final data = response.data;
    if (data is! List) {
      throw const FormatException('Invalid Talk feed response');
    }
    return [
      for (final item in data)
        if (item is Map)
          TalkDiscoveryItem.fromJson(item.cast<String, dynamic>()),
    ];
  }

  @override
  Future<TalkDetail> loadTalk(String talkId) async {
    final response = await api.dio.get<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId),
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkDetail.fromJson(data);
    if (data is Map) return TalkDetail.fromJson(data.cast<String, dynamic>());
    throw const FormatException('Invalid Talk detail response');
  }

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks',
      data: {
        'topic': topic.trim(),
        if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkDiscoveryItem.fromJson(data);
    if (data is Map) {
      return TalkDiscoveryItem.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk create response');
  }

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/comments',
      data: {'body': body.trim()},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkComment.fromJson(data);
    if (data is Map) return TalkComment.fromJson(data.cast<String, dynamic>());
    throw const FormatException('Invalid Talk comment response');
  }
}

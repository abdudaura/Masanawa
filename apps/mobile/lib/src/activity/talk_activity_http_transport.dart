import '../core/network/api_client.dart';
import 'talk_activity.dart';

class GatewayTalkActivityTransport implements TalkActivityTransport {
  GatewayTalkActivityTransport({required this.api});

  final ApiClient api;

  @override
  Future<void> respondToInvitation({
    required String talkId,
    required bool accept,
  }) async {
    await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/invitation-response',
      data: {'action': accept ? 'accept' : 'decline'},
    );
  }

  @override
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) async {
    final response = await api.dio.get<dynamic>(
      '/activity',
      queryParameters: {
        'filter': filter.name,
        'limit': limit,
      },
    );
    // 404 means the authenticated Activity route or resource is unavailable,
    // not that the customer has no notifications. An honest error permits
    // retry rather than silently concealing an integration failure.
    final data = response.data;
    if (data is! List) {
      throw const FormatException('Invalid Activity response');
    }
    final result = <TalkActivityItem>[];
    for (final item in data) {
      if (item is! Map) {
        throw const FormatException('Invalid Activity entry');
      }
      result.add(TalkActivityItem.fromJson(item.cast<String, dynamic>()));
    }
    return List<TalkActivityItem>.unmodifiable(result);
  }
}

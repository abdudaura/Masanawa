import '../core/network/api_client.dart';
import 'human_message_search_models.dart';

abstract class HumanMessageSearchTransport {
  Future<HumanMessageSearchPage> search({
    required String text, String? conversationId, String? after,
  });
}

/// Uses canonical Dio auth/refresh only. No token or account ID in URL or storage.
class GatewayHumanMessageSearchTransport implements HumanMessageSearchTransport {
  const GatewayHumanMessageSearchTransport(this.api);
  final ApiClient api;
  @override
  Future<HumanMessageSearchPage> search({
    required String text, String? conversationId, String? after,
  }) async {
    final response = await api.dio.get<dynamic>('/v1/human/messages/search',
      queryParameters: {
        'text': text, 'limit': 20,
        if (conversationId != null) 'conversationId': conversationId,
        if (after != null) 'after': after,
      },
      options: null,
    );
    final raw = response.data;
    if (raw is! Map) throw const FormatException('Invalid search response');
    return HumanMessageSearchPage.fromJson(Map<String, dynamic>.from(raw));
  }
}

import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_search.dart';

class GatewayTalkSearchTransport implements TalkSearchTransport {
  GatewayTalkSearchTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkSearchResults> search({
    required String query,
    required TalkSearchFilter filter,
    int limit = 30,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) return const TalkSearchResults();

    try {
      final response = await api.dio.get<dynamic>(
        '/search',
        queryParameters: {
          'q': trimmed,
          'type': filter.name,
          'limit': limit,
        },
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return TalkSearchResults.fromJson(data);
      }
      if (data is Map) {
        return TalkSearchResults.fromJson(data.cast<String, dynamic>());
      }
      throw const FormatException('Invalid search response');
    } on DioException catch (error) {
      // Safe rollout while the backend search projection lands separately.
      if (error.response?.statusCode == 404) {
        return const TalkSearchResults();
      }
      rethrow;
    }
  }
}

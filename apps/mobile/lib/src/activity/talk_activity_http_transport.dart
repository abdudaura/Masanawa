import 'package:dio/dio.dart';

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
    try {
      final response = await api.dio.get<dynamic>(
        '/activity',
        queryParameters: {
          'filter': filter.name,
          'limit': limit,
        },
      );
      final data = response.data;
      if (data is! List) {
        throw const FormatException('Invalid Activity response');
      }
      return [
        for (final item in data)
          if (item is Map)
            TalkActivityItem.fromJson(item.cast<String, dynamic>()),
      ];
    } on DioException catch (error) {
      // Safe rollout while the Talk activity projection lands independently.
      if (error.response?.statusCode == 404) return const [];
      rethrow;
    }
  }
}

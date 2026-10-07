import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_ai_seat.dart';

class GatewayTalkAiSeatTransport implements TalkAiSeatTransport {
  GatewayTalkAiSeatTransport({required this.api});

  final ApiClient api;

  @override
  Future<List<TalkAiSeatCandidate>> loadCandidates({
    required String talkId,
  }) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/talks/' + Uri.encodeComponent(talkId) + '/ai-seats',
      );
      final data = response.data;
      if (data is! List) {
        throw const FormatException('Invalid AI Seat catalog response');
      }
      return [
        for (final item in data)
          if (item is Map)
            TalkAiSeatCandidate.fromJson(item.cast<String, dynamic>()),
      ];
    } on DioException catch (error) {
      // Safe mobile rollout while the backend catalog lands in parallel.
      if (error.response?.statusCode == 404) return const [];
      rethrow;
    }
  }

  @override
  Future<TalkAiSeatQuote> createQuote({
    required String talkId,
    required String personaId,
    required TalkAiSeatMode mode,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/ai-seat-quotes',
      data: {
        'personaId': personaId,
        'mode': mode == TalkAiSeatMode.hostAdd ? 'host_add' : 'sponsor',
      },
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkAiSeatQuote.fromJson(data);
    if (data is Map) {
      return TalkAiSeatQuote.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid AI Seat quote response');
  }

  @override
  Future<TalkAiSeatRequest> confirmQuote({
    required String talkId,
    required String quoteId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/talks/' +
          Uri.encodeComponent(talkId) +
          '/ai-seat-quotes/' +
          Uri.encodeComponent(quoteId) +
          '/confirm',
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return TalkAiSeatRequest.fromJson(data);
    if (data is Map) {
      return TalkAiSeatRequest.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid AI Seat confirmation response');
  }
}

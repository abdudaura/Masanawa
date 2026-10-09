import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'models.dart';

/** Uses existing authenticated ApiClient; never accepts a user/tenant ID. */
class GatewayHostCopilotTransport implements HostCopilotTransport {
  GatewayHostCopilotTransport({required this.api});
  final ApiClient api;

  @override
  Future<List<HostCopilotSuggestion>> suggestions(String talkId) async {
    final response = await api.dio.get<dynamic>(
      '/talks/' + Uri.encodeComponent(talkId) + '/ai-stage/suggestions',
    );
    final data = response.data;
    if (data is! Map || data['suggestions'] is! List ||
        (data['suggestions'] as List).any((item) => item is! Map)) {
      throw const FormatException('Invalid Host suggestion response');
    }
    return [
      for (final item in data['suggestions'] as List)
        HostCopilotSuggestion.fromJson((item as Map).cast<String, dynamic>()),
    ];
  }

  @override
  Future<HostCopilotTurnReceipt> approveTurn({
    required String talkId,
    required String seatId,
    required String requestId,
    required String hostApprovedTranscript,
  }) async {
    try {
      final response = await api.dio.post<dynamic>(
        '/talks/' + Uri.encodeComponent(talkId) +
        '/ai-stage/seats/' + Uri.encodeComponent(seatId) + '/turns',
        data: {
          'requestId': requestId,
          'hostApprovedTranscript': hostApprovedTranscript,
        },
      );
      final data = response.data;
      if (data is! Map) throw const FormatException('Invalid Host turn response');
      return HostCopilotTurnReceipt.fromJson(data.cast<String, dynamic>());
    } on DioException catch (error) {
      // Intentional 409/429 outcomes are authoritative typed results, not
      // generic "unknown" network failures. Other 4xx/5xx remain errors.
      final status = error.response?.statusCode;
      final data = error.response?.data;
      if ((status == 409 || status == 429) && data is Map) {
        return HostCopilotTurnReceipt.fromJson(data.cast<String, dynamic>());
      }
      rethrow;
    }
  }
}

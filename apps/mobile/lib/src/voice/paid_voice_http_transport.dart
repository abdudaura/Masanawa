import '../core/network/api_client.dart';
import 'paid_voice.dart';

class GatewayPaidVoiceTransport implements PaidVoiceTransport {
  GatewayPaidVoiceTransport({required this.api});

  final ApiClient api;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid paid voice response');
  }

  @override
  Future<PaidVoiceQuote> quote({
    required String characterId,
    required int expectedSeconds,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/agent/twin/voice/quote',
      data: {
        'characterId': characterId,
        'expectedSeconds': expectedSeconds,
      },
    );
    return PaidVoiceQuote.fromJson(_map(response.data));
  }

  @override
  Future<PaidVoiceAdmission> start({
    required String characterId,
    required String quoteId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/agent/twin/voice/start',
      data: {
        'characterId': characterId,
        'quoteId': quoteId,
        'accepted': true,
      },
    );
    return PaidVoiceAdmission.fromJson(_map(response.data));
  }
  @override
  Future<void> mediaStarted({
    required String admissionId,
  }) async {
    await api.dio.post<dynamic>(
      '/agent/twin/voice/$admissionId/media-started',
    );
  }

  @override
  Future<void> complete({
    required String admissionId,
    required String outcome,
  }) async {
    await api.dio.post<dynamic>(
      '/agent/twin/voice/$admissionId/complete',
      data: {'outcome': outcome},
    );
  }
}

import '../core/network/api_client.dart';
import 'twin_safety.dart';

class GatewayTwinSafetyTransport implements TwinSafetyTransport {
  GatewayTwinSafetyTransport({required this.api});

  final ApiClient api;

  @override
  Future<void> block({required String characterId}) async {
    await api.dio.post<dynamic>(
      '/v1/twins/$characterId/block',
      data: const {},
    );
  }

  @override
  Future<void> unblock({required String characterId}) async {
    await api.dio.delete<dynamic>('/v1/twins/$characterId/block');
  }

  @override
  Future<void> report({
    required String characterId,
    required TwinReportReason reason,
    String? detail,
  }) async {
    await api.dio.post<dynamic>(
      '/v1/twins/$characterId/report',
      data: {
        'reason': twinReportReasonWire(reason),
        if (detail != null && detail.trim().isNotEmpty) 'detail': detail.trim(),
      },
    );
  }
}

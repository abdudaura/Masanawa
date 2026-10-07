import '../core/network/api_client.dart';
import 'twin_safety.dart';

class GatewayTwinSafetyTransport implements TwinSafetyTransport {
  GatewayTwinSafetyTransport({required this.api});

  final ApiClient api;

  @override
  Future<void> block({required String characterId}) async {
    await api.dio.post<dynamic>(
      '/agent/twin/$characterId/block',
      data: const {},
    );
  }

  @override
  Future<void> unblock({required String characterId}) async {
    await api.dio.delete<dynamic>('/agent/twin/$characterId/block');
  }

  @override
  Future<void> report({
    required String characterId,
    required TwinReportReason reason,
    String? detail,
  }) async {
    await api.dio.post<dynamic>(
      '/agent/twin/$characterId/report',
      data: {
        'reason': twinReportReasonWire(reason),
        if (detail != null && detail.trim().isNotEmpty) 'detail': detail.trim(),
      },
    );
  }
}

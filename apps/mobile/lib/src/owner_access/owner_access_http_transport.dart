import '../core/network/api_client.dart';
import 'owner_access.dart';

class GatewayOwnerAccessTransport implements OwnerAccessTransport {
  GatewayOwnerAccessTransport({required this.api});

  final ApiClient api;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid owner access response');
  }

  String _modality(OwnerAccessModality value) {
    switch (value) {
      case OwnerAccessModality.text:
        return 'text';
      case OwnerAccessModality.voice:
        return 'voice';
      case OwnerAccessModality.video:
        return 'video';
    }
  }

  @override
  Future<OwnerAccessQuote> quote({
    required String characterId,
    required OwnerAccessModality modality,
    required int durationMinutes,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/agent/twin/owner-access/quote',
      data: {
        'characterId': characterId,
        'modality': _modality(modality),
        'durationMinutes': durationMinutes,
      },
    );
    return OwnerAccessQuote.fromJson(_map(response.data));
  }

  @override
  Future<OwnerAccessRequest> request({
    required String characterId,
    required String quoteId,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/agent/twin/owner-access/request',
      data: {
        'characterId': characterId,
        'quoteId': quoteId,
      },
    );
    return OwnerAccessRequest.fromJson(_map(response.data));
  }

  @override
  Future<OwnerAccessRequest?> read({
    required String characterId,
    required String requestId,
  }) async {
    final response = await api.dio.get<dynamic>(
      '/agent/twin/owner-access/$requestId',
      queryParameters: {'characterId': characterId},
    );
    if (response.data == null) return null;
    return OwnerAccessRequest.fromJson(_map(response.data));
  }

  @override
  Future<OwnerAccessRequest> act({
    required String characterId,
    required String requestId,
    required String action,
    DateTime? scheduledFor,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/agent/twin/owner-access/$requestId/action',
      data: {
        'characterId': characterId,
        'action': action,
        if (scheduledFor != null)
          'scheduledFor': scheduledFor.toUtc().toIso8601String(),
      },
    );
    return OwnerAccessRequest.fromJson(_map(response.data));
  }
}

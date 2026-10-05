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
  Future<OwnerAccessRequest?> latest({
    required String characterId,
  }) async {
    final response = await api.dio.get<dynamic>(
      '/agent/twin/owner-access/latest',
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


class GatewayOwnerAccessOfferingTransport {
  GatewayOwnerAccessOfferingTransport({required this.api});

  final ApiClient api;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid owner access offering response');
  }

  String _modality(OwnerAccessModality value) {
    return switch (value) {
      OwnerAccessModality.text => 'text',
      OwnerAccessModality.voice => 'voice',
      OwnerAccessModality.video => 'video',
    };
  }

  OwnerAccessOffering _offering(dynamic value) {
    final json = _map(value);
    final modalities = json['modalities'];
    final durations = json['durationOptionsMinutes'];
    final price = json['priceCreditsPerMinute'];
    if (modalities is! List ||
        modalities.isEmpty ||
        durations is! List ||
        durations.isEmpty ||
        price is! num ||
        price.toInt() < 0 ||
        json['enabled'] is! bool) {
      throw const FormatException('Invalid owner access offering response');
    }
    final parsedModalities = <OwnerAccessModality>{};
    for (final raw in modalities) {
      final modality = switch (raw) {
        'text' => OwnerAccessModality.text,
        'voice' => OwnerAccessModality.voice,
        'video' => OwnerAccessModality.video,
        _ => throw const FormatException(
            'Invalid owner access offering modality',
          ),
      };
      parsedModalities.add(modality);
    }
    final parsedDurations = <int>[];
    for (final raw in durations) {
      if (raw is! num || raw.toInt() < 1) {
        throw const FormatException('Invalid owner access offering duration');
      }
      parsedDurations.add(raw.toInt());
    }
    return OwnerAccessOffering(
      enabled: json['enabled'] as bool,
      modalities: Set.unmodifiable(parsedModalities),
      durationOptionsMinutes: List.unmodifiable(parsedDurations),
      priceCreditsPerMinute: price.toInt(),
    );
  }

  Future<OwnerAccessOffering> read() async {
    final response = await api.dio.get<dynamic>(
      '/v1/twin/owner-access/offering',
    );
    return _offering(response.data);
  }

  Future<OwnerAccessOffering> update(OwnerAccessOffering offering) async {
    final response = await api.dio.put<dynamic>(
      '/v1/twin/owner-access/offering',
      data: {
        'enabled': offering.enabled,
        'modalities': [
          for (final value in offering.modalities) _modality(value),
        ],
        'durationOptionsMinutes': offering.durationOptionsMinutes,
        'priceCreditsPerMinute': offering.priceCreditsPerMinute,
      },
    );
    return _offering(response.data);
  }
}

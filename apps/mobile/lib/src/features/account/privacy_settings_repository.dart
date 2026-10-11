import 'package:dio/dio.dart';

const deliveryPreferenceKinds = <String>[
  'comment_reply', 'room_answer', 'followed_post',
  'subscription', 'wallet', 'case_update',
];

class DeliveryPreference {
  const DeliveryPreference(this.kind, this.enabled);
  final String kind;
  final bool enabled;
}

abstract class DeliverySettingsRepository {
  Future<List<DeliveryPreference>> load();
  Future<DeliveryPreference> update(String kind, bool enabled);
}

/// Uses the SAME authenticated Dio as C08. Never accepts user/tenant IDs on wire.
class DioDeliverySettingsRepository implements DeliverySettingsRepository {
  DioDeliverySettingsRepository({
    required this.dio, required this.ownerAccountKey, required this.currentAccountKey,
  });
  final Dio dio;
  final String ownerAccountKey;
  final String? Function() currentAccountKey;

  void _verify() {
    if (ownerAccountKey.isEmpty || currentAccountKey() != ownerAccountKey) {
      throw StateError('Account changed. Sign in again.');
    }
  }
  DeliveryPreference _parse(dynamic value) {
    if (value is! Map) throw const FormatException('Invalid preference');
    final data = Map<String, dynamic>.from(value);
    final kind = data['kind'];
    final enabled = data['enabled'];
    if (kind is! String || !deliveryPreferenceKinds.contains(kind) ||
        enabled is! bool) throw const FormatException('Invalid preference');
    return DeliveryPreference(kind, enabled);
  }

  @override
  Future<List<DeliveryPreference>> load() async {
    _verify();
    final response = await dio.get<dynamic>('/v1/notification-preferences');
    _verify();
    if (response.data is! Map) throw const FormatException('Invalid preferences response');
    final raw = (response.data as Map)['items'];
    if (raw is! List || raw.length != deliveryPreferenceKinds.length) {
      throw const FormatException('Missing preferences');
    }
    final result = raw.map(_parse).toList(growable: false);
    if (result.map((item) => item.kind).toSet().length != deliveryPreferenceKinds.length) {
      throw const FormatException('Duplicate preferences');
    }
    return result;
  }

  @override
  Future<DeliveryPreference> update(String kind, bool enabled) async {
    _verify();
    if (!deliveryPreferenceKinds.contains(kind)) throw const FormatException('Invalid kind');
    final response = await dio.put<dynamic>(
      '/v1/notification-preferences/${Uri.encodeComponent(kind)}',
      data: {'enabled': enabled},
    );
    _verify();
    final confirmed = _parse(response.data);
    if (confirmed.kind != kind || confirmed.enabled != enabled) {
      throw const FormatException('Preference not confirmed');
    }
    return confirmed;
  }
}

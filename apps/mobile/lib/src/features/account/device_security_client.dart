import 'package:dio/dio.dart';

/// C09: only the canonical signed-in Dio and bearer provider are accepted.
class FanDevice {
  const FanDevice({required this.id, required this.startedAt,
    required this.lastSeenAt, required this.expiresAt, required this.current});
  final String id;
  final DateTime startedAt, lastSeenAt, expiresAt;
  final bool current;
  factory FanDevice.fromJson(Map<String, dynamic> json) => FanDevice(
    id: json['id'] as String,
    startedAt: DateTime.parse(json['startedAt'] as String),
    lastSeenAt: DateTime.parse(json['lastSeenAt'] as String),
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    current: json['current'] as bool? ?? false,
  );
}
abstract class FanDevicesTransport {
  String get ownerAccountId;
  bool get isCurrentAccount;
  Future<List<FanDevice>> list();
  Future<void> revoke(String deviceId, String idempotencyKey);
}
class DioFanDevicesTransport implements FanDevicesTransport {
  DioFanDevicesTransport(this.dio,{required this.ownerAccountId,
    required this.currentAccountId,required this.authorizationHeader});
  final Dio dio;
  @override final String ownerAccountId;
  final String? Function() currentAccountId;
  final Future<String?> Function() authorizationHeader;
  @override bool get isCurrentAccount =>
    ownerAccountId.isNotEmpty && ownerAccountId==currentAccountId();
  Future<Options> _options() async {
    if(!isCurrentAccount) throw StateError('account_changed');
    final bearer=await authorizationHeader();
    if(!isCurrentAccount||bearer==null||!bearer.startsWith('Bearer '))
      throw StateError('sign_in_required');
    return Options(headers:{'Authorization':bearer});
  }
  @override Future<List<FanDevice>> list() async {
    final response=await dio.get<Map<String,dynamic>>('/v1/account/devices',
      options:await _options());
    if(!isCurrentAccount)throw StateError('account_changed');
    final raw=(response.data?['items'] as List<dynamic>?)??const [];
    return raw.map((v)=>FanDevice.fromJson(Map<String,dynamic>.from(v as Map))).toList();
  }
  @override Future<void> revoke(String deviceId,String key) async {
    await dio.post<void>('/v1/account/devices/${Uri.encodeComponent(deviceId)}/revoke',
      data:{'idempotencyKey':key}, options:await _options());
    if(!isCurrentAccount)throw StateError('account_changed');
  }
}

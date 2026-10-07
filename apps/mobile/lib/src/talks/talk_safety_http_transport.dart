import '../core/network/api_client.dart';
import 'talk_safety.dart';

class GatewayTalkSafetyTransport implements TalkSafetyTransport {
  GatewayTalkSafetyTransport({required this.api});
  final ApiClient api;

  @override
  Future<void> report({
    required String targetKind,
    required String targetId,
    required TalkSafetyReason reason,
    String? detail,
  }) async {
    await api.dio.post<dynamic>('/safety/reports', data: {
      'targetKind': targetKind,
      'targetId': targetId,
      'reason': reason.wire,
      if (detail != null && detail.trim().isNotEmpty) 'detail': detail.trim(),
      'clientRequestId': 'mobile-' + DateTime.now().microsecondsSinceEpoch.toString() + '-' + targetKind + '-' + targetId.hashCode.abs().toString(),
    });
  }

  @override
  Future<TalkSafetyPreference> loadPreference(String handle) async {
    final response = await api.dio.get<dynamic>(
      '/safety/profiles/' + Uri.encodeComponent(handle) + '/preference',
    );
    return _preference(response.data);
  }

  @override
  Future<TalkSafetyPreference> setPreference({
    required String handle,
    required bool blocked,
    required bool muted,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/safety/profiles/' + Uri.encodeComponent(handle) + '/preference',
      data: {'blocked': blocked, 'muted': muted},
    );
    return _preference(response.data);
  }

  TalkSafetyPreference _preference(dynamic data) {
    if (data is Map<String,dynamic>) return TalkSafetyPreference.fromJson(data);
    if (data is Map) return TalkSafetyPreference.fromJson(data.cast<String,dynamic>());
    throw const FormatException('Invalid safety preference response');
  }
}

import '../core/network/api_client.dart';
import '../core/request_id.dart';
import 'talk_safety.dart';

class GatewayTalkSafetyTransport implements TalkSafetyTransport {
  GatewayTalkSafetyTransport({required this.api});

  final ApiClient api;

  @override
  Future<TalkSafetyPreference> loadUserPreference(String userId) async {
    final response = await api.dio.get<dynamic>(
      '/safety/users/' + Uri.encodeComponent(userId) + '/preference',
    );
    return _preference(response.data);
  }

  @override
  Future<TalkSafetyPreference> setUserPreference({
    required String userId,
    required bool blocked,
    required bool muted,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/safety/users/' + Uri.encodeComponent(userId) + '/preference',
      data: {
        'blocked': blocked,
        'muted': muted,
      },
    );
    return _preference(response.data);
  }

  Future<void> _report({
    required String targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
    required String requestPrefix,
    String? clientRequestId,
  }) async {
    final normalizedDetail = detail?.trim();
    await api.dio.post<dynamic>(
      '/safety/reports',
      data: {
        'targetKind': targetKind,
        'targetId': targetId,
        'reason': reason.wire,
        if (normalizedDetail != null && normalizedDetail.isNotEmpty)
          'detail': normalizedDetail,
        'clientRequestId':
            clientRequestId ?? '$requestPrefix-${createRequestId()}',
      },
    );
  }

  @override
  Future<void> reportTalk({
    required String talkId,
    required bool isReplay,
    required TalkSafetyReportReason reason,
    String? detail,
  }) async {
    await _report(
      targetKind: isReplay ? 'replay' : 'talk',
      targetId: talkId,
      reason: reason,
      detail: detail,
      requestPrefix: 'talk-report',
    );
  }

  @override
  Future<void> reportTarget({
    required TalkSafetyTargetKind targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
    String? clientRequestId,
  }) async {
    await _report(
      targetKind: targetKind.wire,
      targetId: targetId,
      reason: reason,
      detail: detail,
      requestPrefix: 'participant-report',
      clientRequestId: clientRequestId,
    );
  }

  TalkSafetyPreference _preference(dynamic data) {
    if (data is Map<String, dynamic>) {
      return TalkSafetyPreference.fromJson(data);
    }
    if (data is Map) {
      return TalkSafetyPreference.fromJson(data.cast<String, dynamic>());
    }
    throw const FormatException('Invalid Talk safety preference response');
  }
}

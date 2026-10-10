import 'package:dio/dio.dart';

/// Inject the existing admin-authenticated Dio. The server enforces staff roles.
class ModerationApi {
  const ModerationApi(this.dio);
  final Dio dio;
  Future<List<Map<String, dynamic>>> queue() async {
    final response = await dio.get<dynamic>('/v1/admin/cases');
    return (Map<String, dynamic>.from(response.data as Map)['cases'] as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map)).toList(growable: false);
  }
  Future<Map<String, dynamic>> caseDetail(String id) async {
    final response = await dio.get<dynamic>('/v1/admin/cases/${Uri.encodeComponent(id)}');
    return Map<String, dynamic>.from(response.data as Map);
  }
  Future<void> propose({
    required String caseId, required String kind, required String reason,
    required int version, String? expiresAt,
  }) async {
    await dio.post<dynamic>('/v1/admin/cases/${Uri.encodeComponent(caseId)}/actions',
        data: {'kind': kind, 'reason': reason, 'expectedCaseVersion': version, 'expiresAt': expiresAt});
  }
  Future<void> decide({
    required String caseId, required String actionId,
    required bool approve, required int version,
  }) async {
    await dio.post<dynamic>(
      '/v1/admin/cases/${Uri.encodeComponent(caseId)}/actions/${Uri.encodeComponent(actionId)}/review',
      data: {'approve': approve, 'expectedVersion': version},
    );
  }
}

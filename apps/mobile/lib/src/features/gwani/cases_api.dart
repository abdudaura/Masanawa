import 'package:dio/dio.dart';

/// Reuses the authenticated app Dio client and session authority. No local token store.
class GwaniCasesApi {
  const GwaniCasesApi(this.dio);
  final Dio dio;

  Future<List<Map<String, dynamic>>> mine() async {
    final response = await dio.get<dynamic>('/v1/cases');
    final body = Map<String, dynamic>.from(response.data as Map);
    return (body['cases'] as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> detail(String id) async {
    final response = await dio.get<dynamic>('/v1/cases/${Uri.encodeComponent(id)}');
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<String> report({
    required String targetKind,
    required String targetId,
    required String category,
    required String details,
    required String clientRequestId,
  }) async {
    final response = await dio.post<dynamic>('/v1/cases', data: {
      'targetKind': targetKind,
      'targetId': targetId,
      'category': category,
      'details': details,
      'clientRequestId': clientRequestId,
    });
    return (response.data as Map)['caseId'] as String;
  }

  Future<void> appeal(String caseId, String reason, {required String clientRequestId}) async {
    await dio.post<dynamic>(
      '/v1/cases/${Uri.encodeComponent(caseId)}/appeal',
      data: {'reason': reason, 'clientRequestId': clientRequestId},
    );
  }
}

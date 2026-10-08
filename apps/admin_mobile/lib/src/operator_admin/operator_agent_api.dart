import 'package:dio/dio.dart';
import '../core/admin_api.dart';

class OperatorAgentException implements Exception {
  const OperatorAgentException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}

class OperatorSkill {
  const OperatorSkill(this.id, this.name, this.readiness, this.version);
  final String id;
  final String name;
  final String readiness;
  final String version;
  factory OperatorSkill.fromJson(Map<String, dynamic> json) => OperatorSkill(
    json['skillVersionId'] as String, json['displayName'] as String,
    json['readiness'] as String? ?? 'unknown', json['version'] as String);
}

class OperatorAgent {
  const OperatorAgent({required this.id, required this.name,
    required this.version, required this.role, required this.visible,
    required this.presentationRevision, required this.assignmentRevision,
    required this.skillIds});
  final String id, name, version, role;
  final bool visible;
  final int presentationRevision;
  final int? assignmentRevision;
  final List<String> skillIds;
  factory OperatorAgent.fromJson(Map<String, dynamic> json) => OperatorAgent(
    id: json['characterId'] as String, name: json['displayName'] as String,
    version: json['characterVersionId'] as String,
    role: json['roleLabel'] as String, visible: json['visibleInUserApp'] == true,
    presentationRevision: json['presentationRevision'] as int,
    assignmentRevision: json['assignmentRevision'] as int?,
    skillIds: List<String>.unmodifiable((json['skillVersionIds'] as List).cast<String>()),
  );
}

class OperatorAgentSnapshot {
  const OperatorAgentSnapshot(this.agents, this.skills, this.readAt);
  final List<OperatorAgent> agents;
  final List<OperatorSkill> skills;
  final String readAt;
  factory OperatorAgentSnapshot.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != 1) throw const FormatException('Unsupported schema');
    return OperatorAgentSnapshot(
      List<OperatorAgent>.unmodifiable((json['agents'] as List).map((item) =>
          OperatorAgent.fromJson(Map<String, dynamic>.from(item as Map)))),
      List<OperatorSkill>.unmodifiable((json['skills'] as List).map((item) =>
          OperatorSkill.fromJson(Map<String, dynamic>.from(item as Map)))),
      json['readAt'] as String,
    );
  }
}

abstract class OperatorAgentRepository {
  Future<OperatorAgentSnapshot> snapshot();
  Future<void> detachSkill({required String characterId,
    required String skillVersionId, required int expectedRevision});
}

/// Uses the signed-in Ops session. No app-embedded admin password or access grant.
class OperatorAgentApi implements OperatorAgentRepository {
  OperatorAgentApi({required this.admin, Dio? dio})
      : _dio = dio ?? Dio(BaseOptions(baseUrl: requireAdminBaseUrl(),
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20)));
  final AdminApi admin;
  final Dio _dio;

  Future<Response<dynamic>> _send(
      Future<Response<dynamic>> Function(String) action) async {
    try {
      return await action(admin.currentAccessToken);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        final refreshed = await admin.refreshForExternalClient();
        if (refreshed != null && refreshed.isNotEmpty) {
          try {
            return await action(refreshed);
          } on DioException catch (next) {
            throw _safe(next);
          }
        }
      }
      throw _safe(error);
    }
  }

  OperatorAgentException _safe(DioException error) {
    final status = error.response?.statusCode;
    final payload = error.response?.data;
    final code = payload is Map ? payload['code']?.toString() : '';
    if (status == 401 || status == 403) {
      return const OperatorAgentException('DENIED', 'This session is not authorized for agent controls.');
    }
    if (status == 409 || code == 'AGENT_REVISION_CONFLICT') {
      return const OperatorAgentException('CONFLICT', 'Agent configuration changed. Reload before retrying.');
    }
    if (code == 'AGENT_READBACK_UNCERTAIN') {
      return const OperatorAgentException('UNCERTAIN', 'Result unconfirmed. Reload before another action.');
    }
    return const OperatorAgentException('UNAVAILABLE', 'Agent controls are unavailable. No change is confirmed.');
  }

  @override
  Future<OperatorAgentSnapshot> snapshot() async {
    final response = await _send((token) => _dio.get<dynamic>(
      '/v1/admin/operator/agents', options: Options(headers: {
        'Authorization': 'Bearer ' + token, 'Cache-Control': 'no-store',
      }),
    ));
    try {
      return OperatorAgentSnapshot.fromJson(Map<String, dynamic>.from(response.data as Map));
    } catch (_) {
      throw const OperatorAgentException('INVALID_RESPONSE', 'Invalid agent catalog from server.');
    }
  }

  @override
  Future<void> detachSkill({required String characterId,
      required String skillVersionId, required int expectedRevision}) async {
    if (characterId.isEmpty || skillVersionId.isEmpty || expectedRevision < 1) {
      throw const OperatorAgentException('INVALID_REQUEST', 'Reload before editing this agent.');
    }
    final path = '/v1/admin/operator/agents/' + Uri.encodeComponent(characterId) +
        '/skills/' + Uri.encodeComponent(skillVersionId);
    final response = await _send((token) => _dio.delete<dynamic>(
      path, options: Options(headers: {
        'Authorization': 'Bearer ' + token, 'If-Match': '"' + expectedRevision.toString() + '"',
      }),
    ));
    final data = response.data;
    if (data is! Map || data['characterId'] != characterId ||
        data['revision'] is! int || (data['revision'] as int) <= expectedRevision ||
        data['skillVersionIds'] is! List ||
        (data['skillVersionIds'] as List).contains(skillVersionId)) {
      throw const OperatorAgentException('UNCERTAIN', 'Server did not confirm removal. Reload to verify.');
    }
  }
}

import 'package:dio/dio.dart';

const adminBaseUrl = String.fromEnvironment(
  'ADMIN_BASE_URL',
  defaultValue: 'https://nurainworker-production.up.railway.app',
);

class AdminApiException implements Exception {
  const AdminApiException(this.message, [this.statusCode]);
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class AgentPresentation {
  const AgentPresentation({
    required this.characterId,
    required this.characterVersionId,
    required this.displayName,
    required this.roleLabel,
    required this.about,
    required this.greeting,
    required this.visibleInUserApp,
    required this.sortOrder,
    required this.revision,
  });

  final String characterId;
  final String characterVersionId;
  final String displayName;
  final String roleLabel;
  final String about;
  final String? greeting;
  final bool visibleInUserApp;
  final int sortOrder;
  final int revision;

  factory AgentPresentation.fromJson(Map<String, dynamic> json) =>
      AgentPresentation(
        characterId: json['characterId'] as String,
        characterVersionId: json['characterVersionId'] as String,
        displayName: json['displayName'] as String,
        roleLabel: json['roleLabel'] as String,
        about: json['about'] as String? ?? '',
        greeting: json['greeting'] as String?,
        visibleInUserApp: json['visibleInUserApp'] as bool? ?? false,
        sortOrder: json['sortOrder'] as int? ?? 0,
        revision: json['revision'] as int? ?? 1,
      );
}

class AdminSkill {
  const AdminSkill({
    required this.skillVersionId,
    required this.key,
    required this.version,
    required this.displayName,
    required this.description,
    required this.readiness,
    required this.advertised,
  });

  final String skillVersionId;
  final String key;
  final String version;
  final String displayName;
  final String description;
  final String readiness;
  final bool advertised;

  factory AdminSkill.fromJson(Map<String, dynamic> json) => AdminSkill(
        skillVersionId: json['skillVersionId'] as String,
        key: json['key'] as String,
        version: json['version'] as String,
        displayName: json['displayName'] as String,
        description: json['description'] as String? ?? '',
        readiness: json['readiness'] as String? ?? 'unknown',
        advertised: json['advertised'] as bool? ?? false,
      );
}

class AgentSkillAssignment {
  const AgentSkillAssignment({
    required this.characterId,
    required this.skillVersionIds,
    required this.revision,
  });

  final String characterId;
  final List<String> skillVersionIds;
  final int revision;

  factory AgentSkillAssignment.fromJson(Map<String, dynamic> json) =>
      AgentSkillAssignment(
        characterId: json['characterId'] as String,
        skillVersionIds: (json['skillVersionIds'] as List<dynamic>? ?? const [])
            .map((value) => value.toString())
            .toList(growable: false),
        revision: json['revision'] as int? ?? 1,
      );
}

class OpsReadiness {
  const OpsReadiness({required this.status, required this.checks});
  final String status;
  final List<Map<String, dynamic>> checks;

  factory OpsReadiness.fromJson(Map<String, dynamic> json) => OpsReadiness(
        status: json['status'] as String? ?? 'unknown',
        checks: (json['checks'] as List<dynamic>? ?? const [])
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList(growable: false),
      );
}

class AdminApi {
  AdminApi({required this.token, Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: adminBaseUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              headers: {'Accept': 'application/json'},
            ));

  final String token;
  final Dio _dio;

  Options get _auth => Options(headers: {'Authorization': 'Bearer $token'});

  Future<void> health() async {
    await _request(() => _dio.get<dynamic>('/healthz', options: _auth));
  }

  Future<OpsReadiness> readiness() async {
    final response =
        await _request(() => _dio.get<dynamic>('/readyz', options: _auth));
    return OpsReadiness.fromJson(_map(response.data));
  }

  Future<List<AgentPresentation>> agents() async {
    final response =
        await _request(() => _dio.get<dynamic>('/v1/agents', options: _auth));
    return _list(response.data)
        .map((item) => AgentPresentation.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<AgentPresentation> updateAgentPresentation(
    AgentPresentation current, {
    required String displayName,
    required String roleLabel,
    required String about,
    required String? greeting,
    required bool visibleInUserApp,
    required int sortOrder,
  }) async {
    final response = await _request(
      () => _dio.put<dynamic>(
        '/v1/agents/${Uri.encodeComponent(current.characterId)}/presentation',
        options: _auth,
        data: {
          'schemaVersion': 1,
          'characterVersionId': current.characterVersionId,
          'displayName': displayName.trim(),
          'roleLabel': roleLabel.trim(),
          'about': about.trim(),
          'greeting': greeting?.trim().isEmpty == true ? null : greeting?.trim(),
          'visibleInUserApp': visibleInUserApp,
          'sortOrder': sortOrder,
          'expectedRevision': current.revision,
        },
      ),
    );
    return AgentPresentation.fromJson(_map(response.data));
  }

  Future<List<AdminSkill>> skills() async {
    final response =
        await _request(() => _dio.get<dynamic>('/v1/skills', options: _auth));
    return _list(response.data)
        .map((item) => AdminSkill.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<AgentSkillAssignment?> agentSkills(String characterId) async {
    final response = await _request(
      () => _dio.get<dynamic>(
        '/v1/agents/${Uri.encodeComponent(characterId)}/skills',
        options: _auth,
      ),
    );
    if (response.data == null) return null;
    return AgentSkillAssignment.fromJson(_map(response.data));
  }

  Future<AgentSkillAssignment> updateAgentSkills(
    String characterId, {
    required List<String> skillVersionIds,
    required int? expectedRevision,
  }) async {
    final response = await _request(
      () => _dio.put<dynamic>(
        '/v1/agents/${Uri.encodeComponent(characterId)}/skills',
        options: _auth,
        data: {
          'schemaVersion': 1,
          'skillVersionIds': skillVersionIds,
          'expectedRevision': expectedRevision,
        },
      ),
    );
    return AgentSkillAssignment.fromJson(_map(response.data));
  }

  Future<Response<dynamic>> _request(
    Future<Response<dynamic>> Function() call,
  ) async {
    try {
      return await call();
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      final message = switch (status) {
        401 || 403 => 'This credential is not authorized for Masanawa Ops.',
        404 => 'The configured server does not expose the Ops admin contract yet.',
        409 => 'This record changed on the server. Reload it before saving again.',
        _ => error.message ?? 'Admin request failed.',
      };
      throw AdminApiException(message, status);
    }
  }

  static Map<String, dynamic> _map(dynamic value) =>
      Map<String, dynamic>.from(value as Map);

  static List<dynamic> _list(dynamic value) => List<dynamic>.from(value as List);
}

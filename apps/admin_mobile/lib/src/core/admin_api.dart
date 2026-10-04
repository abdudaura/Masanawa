import 'package:dio/dio.dart';

const adminBaseUrl = String.fromEnvironment('ADMIN_BASE_URL');

String requireAdminBaseUrl() {
  final value = adminBaseUrl.trim();
  if (value.isEmpty) {
    throw const AdminApiException(
      'ADMIN_BASE_URL is not configured for the Ops service.',
    );
  }
  return value;
}

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


class PlatformSummary {
  const PlatformSummary({
    required this.users,
    required this.characters,
    required this.activeSessions,
    required this.runningAgentRuns,
    required this.enabledOffers,
    required this.admittedFulfillments,
    required this.completedFulfillments,
    required this.openReconciliationCases,
    required this.activeProviderCredentials,
  });

  final int users;
  final int characters;
  final int activeSessions;
  final int runningAgentRuns;
  final int enabledOffers;
  final int admittedFulfillments;
  final int completedFulfillments;
  final int openReconciliationCases;
  final int activeProviderCredentials;

  factory PlatformSummary.fromJson(Map<String, dynamic> json) => PlatformSummary(
        users: json['users'] as int? ?? 0,
        characters: json['characters'] as int? ?? 0,
        activeSessions: json['activeSessions'] as int? ?? 0,
        runningAgentRuns: json['runningAgentRuns'] as int? ?? 0,
        enabledOffers: json['enabledOffers'] as int? ?? 0,
        admittedFulfillments: json['admittedFulfillments'] as int? ?? 0,
        completedFulfillments: json['completedFulfillments'] as int? ?? 0,
        openReconciliationCases:
            json['openReconciliationCases'] as int? ?? 0,
        activeProviderCredentials:
            json['activeProviderCredentials'] as int? ?? 0,
      );
}


class AdminCharacter {
  const AdminCharacter({
    required this.characterId,
    required this.state,
    required this.activeCharacterVersionId,
    required this.revision,
    required this.configuredInUserApp,
    required this.visibleInUserApp,
    required this.displayName,
    required this.roleLabel,
    required this.updatedAt,
  });

  final String characterId;
  final String state;
  final String? activeCharacterVersionId;
  final int revision;
  final bool configuredInUserApp;
  final bool? visibleInUserApp;
  final String? displayName;
  final String? roleLabel;
  final String updatedAt;

  factory AdminCharacter.fromJson(Map<String, dynamic> json) => AdminCharacter(
        characterId: json['characterId'] as String,
        state: json['state'] as String,
        activeCharacterVersionId: json['activeCharacterVersionId'] as String?,
        revision: json['revision'] as int? ?? 1,
        configuredInUserApp: json['configuredInUserApp'] as bool? ?? false,
        visibleInUserApp: json['visibleInUserApp'] as bool?,
        displayName: json['displayName'] as String?,
        roleLabel: json['roleLabel'] as String?,
        updatedAt: json['updatedAt'] as String,
      );
}

class AdminUser {
  const AdminUser({
    required this.userId,
    required this.state,
    required this.revision,
    required this.createdAt,
    required this.updatedAt,
    required this.identityCount,
    required this.relationshipCount,
  });

  final String userId;
  final String state;
  final int revision;
  final String createdAt;
  final String updatedAt;
  final int identityCount;
  final int relationshipCount;

  factory AdminUser.fromJson(Map<String, dynamic> json) => AdminUser(
        userId: json['userId'] as String,
        state: json['state'] as String,
        revision: json['revision'] as int,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        identityCount: json['identityCount'] as int? ?? 0,
        relationshipCount: json['relationshipCount'] as int? ?? 0,
      );
}

class AdminAgentRun {
  const AdminAgentRun({
    required this.agentRunId,
    required this.userId,
    required this.characterId,
    required this.characterSessionId,
    required this.state,
    required this.failureCode,
    required this.startedAt,
    required this.updatedAt,
    required this.completedAt,
    required this.correlationId,
  });

  final String agentRunId;
  final String userId;
  final String characterId;
  final String characterSessionId;
  final String state;
  final String? failureCode;
  final String startedAt;
  final String updatedAt;
  final String? completedAt;
  final String correlationId;

  factory AdminAgentRun.fromJson(Map<String, dynamic> json) => AdminAgentRun(
        agentRunId: json['agentRunId'] as String,
        userId: json['userId'] as String,
        characterId: json['characterId'] as String,
        characterSessionId: json['characterSessionId'] as String,
        state: json['state'] as String,
        failureCode: json['failureCode'] as String?,
        startedAt: json['startedAt'] as String,
        updatedAt: json['updatedAt'] as String,
        completedAt: json['completedAt'] as String?,
        correlationId: json['correlationId'] as String,
      );
}

class AdminOffer {
  const AdminOffer({
    required this.offerId,
    required this.key,
    required this.revision,
    required this.enabled,
    required this.updatedAt,
  });
  final String offerId;
  final String key;
  final int revision;
  final bool enabled;
  final String updatedAt;

  factory AdminOffer.fromJson(Map<String, dynamic> json) => AdminOffer(
        offerId: json['offerId'] as String,
        key: json['key'] as String,
        revision: json['revision'] as int,
        enabled: json['enabled'] as bool,
        updatedAt: json['updatedAt'] as String,
      );
}

class AdminFulfillment {
  const AdminFulfillment({
    required this.fulfillmentId,
    required this.quoteId,
    required this.state,
    required this.createdAt,
    required this.completedAt,
  });
  final String fulfillmentId;
  final String quoteId;
  final String state;
  final String createdAt;
  final String? completedAt;

  factory AdminFulfillment.fromJson(Map<String, dynamic> json) =>
      AdminFulfillment(
        fulfillmentId: json['fulfillmentId'] as String,
        quoteId: json['quoteId'] as String,
        state: json['state'] as String,
        createdAt: json['createdAt'] as String,
        completedAt: json['completedAt'] as String?,
      );
}

class AdminLedgerEntry {
  const AdminLedgerEntry({
    required this.ledgerEntryId,
    required this.debitKind,
    required this.creditKind,
    required this.amountCredits,
    required this.reason,
    required this.quoteId,
    required this.fulfillmentId,
    required this.createdAt,
  });

  final String ledgerEntryId;
  final String debitKind;
  final String creditKind;
  final int amountCredits;
  final String reason;
  final String? quoteId;
  final String? fulfillmentId;
  final String createdAt;

  factory AdminLedgerEntry.fromJson(Map<String, dynamic> json) =>
      AdminLedgerEntry(
        ledgerEntryId: json['ledgerEntryId'] as String,
        debitKind: json['debitKind'] as String,
        creditKind: json['creditKind'] as String,
        amountCredits: json['amountCredits'] as int,
        reason: json['reason'] as String,
        quoteId: json['quoteId'] as String?,
        fulfillmentId: json['fulfillmentId'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class AdminOperation {
  const AdminOperation({
    required this.operationId,
    required this.kind,
    required this.state,
    required this.attempt,
    required this.provider,
    required this.terminalErrorCode,
    required this.createdAt,
    required this.updatedAt,
  });
  final String operationId;
  final String kind;
  final String state;
  final int attempt;
  final String? provider;
  final String? terminalErrorCode;
  final String createdAt;
  final String updatedAt;

  factory AdminOperation.fromJson(Map<String, dynamic> json) => AdminOperation(
        operationId: json['operationId'] as String,
        kind: json['kind'] as String,
        state: json['state'] as String,
        attempt: json['attempt'] as int? ?? 0,
        provider: json['provider'] as String?,
        terminalErrorCode: json['terminalErrorCode'] as String?,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );
}

class AdminReconciliationCase {
  const AdminReconciliationCase({
    required this.reconciliationCaseId,
    required this.operationId,
    required this.status,
    required this.reasonCode,
    required this.safeRetry,
    required this.nextAction,
    required this.openedAt,
    required this.updatedAt,
    required this.resolvedAt,
  });

  final String reconciliationCaseId;
  final String operationId;
  final String status;
  final String reasonCode;
  final bool safeRetry;
  final String? nextAction;
  final String openedAt;
  final String updatedAt;
  final String? resolvedAt;

  factory AdminReconciliationCase.fromJson(Map<String, dynamic> json) =>
      AdminReconciliationCase(
        reconciliationCaseId: json['reconciliationCaseId'] as String,
        operationId: json['operationId'] as String,
        status: json['status'] as String,
        reasonCode: json['reasonCode'] as String,
        safeRetry: json['safeRetry'] as bool? ?? false,
        nextAction: json['nextAction'] as String?,
        openedAt: json['openedAt'] as String,
        updatedAt: json['updatedAt'] as String,
        resolvedAt: json['resolvedAt'] as String?,
      );
}

class AdminCredentialRef {
  const AdminCredentialRef({
    required this.credentialRefId,
    required this.providerId,
    required this.slotKey,
    required this.generation,
    required this.algorithm,
    required this.keyId,
    required this.active,
    required this.updatedAt,
  });

  final String credentialRefId;
  final String providerId;
  final String slotKey;
  final int generation;
  final String algorithm;
  final String keyId;
  final bool active;
  final String updatedAt;

  factory AdminCredentialRef.fromJson(Map<String, dynamic> json) =>
      AdminCredentialRef(
        credentialRefId: json['credentialRefId'] as String,
        providerId: json['providerId'] as String,
        slotKey: json['slotKey'] as String,
        generation: json['generation'] as int,
        algorithm: json['algorithm'] as String,
        keyId: json['keyId'] as String,
        active: json['active'] as bool,
        updatedAt: json['updatedAt'] as String,
      );
}

class AdminAuditEvent {
  const AdminAuditEvent({
    required this.auditEventId,
    required this.eventType,
    required this.aggregateType,
    required this.aggregateId,
    required this.recordedAt,
    required this.correlationId,
    required this.sensitivity,
  });

  final String auditEventId;
  final String eventType;
  final String aggregateType;
  final String aggregateId;
  final String recordedAt;
  final String correlationId;
  final String sensitivity;

  factory AdminAuditEvent.fromJson(Map<String, dynamic> json) =>
      AdminAuditEvent(
        auditEventId: json['auditEventId'] as String,
        eventType: json['eventType'] as String,
        aggregateType: json['aggregateType'] as String,
        aggregateId: json['aggregateId'] as String,
        recordedAt: json['recordedAt'] as String,
        correlationId: json['correlationId'] as String,
        sensitivity: json['sensitivity'] as String,
      );
}


class AdminSystemSnapshot {
  const AdminSystemSnapshot({
    required this.memory,
    required this.queues,
  });

  final Map<String, dynamic> memory;
  final Map<String, dynamic> queues;

  factory AdminSystemSnapshot.fromJson(Map<String, dynamic> json) =>
      AdminSystemSnapshot(
        memory: Map<String, dynamic>.from(json['memory'] as Map),
        queues: Map<String, dynamic>.from(json['queues'] as Map),
      );
}

class AdminWorld {
  const AdminWorld({
    required this.worldId,
    required this.status,
    required this.policyRevision,
    required this.currentGenerationNumber,
    required this.simulationTime,
    required this.revision,
    required this.updatedAt,
  });

  final String worldId;
  final String status;
  final int policyRevision;
  final int currentGenerationNumber;
  final String simulationTime;
  final int revision;
  final String updatedAt;

  factory AdminWorld.fromJson(Map<String, dynamic> json) => AdminWorld(
        worldId: json['worldId'] as String,
        status: json['status'] as String,
        policyRevision: json['policyRevision'] as int? ?? 0,
        currentGenerationNumber:
            json['currentGenerationNumber'] as int? ?? 0,
        simulationTime: json['simulationTime'] as String,
        revision: json['revision'] as int? ?? 0,
        updatedAt: json['updatedAt'] as String,
      );
}

class AdminApproval {
  const AdminApproval({
    required this.approvalId,
    required this.operationId,
    required this.kind,
    required this.state,
    required this.action,
    required this.actionVersion,
    required this.resourceKey,
    required this.riskClass,
    required this.requestedAt,
    required this.expiresAt,
    required this.decidedAt,
    required this.approverKey,
  });

  final String approvalId;
  final String operationId;
  final String kind;
  final String state;
  final String action;
  final String actionVersion;
  final String resourceKey;
  final String riskClass;
  final String requestedAt;
  final String expiresAt;
  final String? decidedAt;
  final String? approverKey;

  factory AdminApproval.fromJson(Map<String, dynamic> json) => AdminApproval(
        approvalId: json['approvalId'] as String,
        operationId: json['operationId'] as String,
        kind: json['kind'] as String,
        state: json['state'] as String,
        action: json['action'] as String,
        actionVersion: json['actionVersion'] as String,
        resourceKey: json['resourceKey'] as String,
        riskClass: json['riskClass'] as String,
        requestedAt: json['requestedAt'] as String,
        expiresAt: json['expiresAt'] as String,
        decidedAt: json['decidedAt'] as String?,
        approverKey: json['approverKey'] as String?,
      );
}

class AdminApi {
  AdminApi({required this.token, Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: requireAdminBaseUrl(),
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


  Future<PlatformSummary> platformSummary() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/summary', options: _auth),
    );
    return PlatformSummary.fromJson(_map(response.data));
  }


  Future<List<AdminCharacter>> characters() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/characters', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminCharacter.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<AgentPresentation> configureCharacter(
    AdminCharacter character, {
    required String displayName,
    required String roleLabel,
    required String about,
    required String? greeting,
    required bool visibleInUserApp,
    required int sortOrder,
  }) async {
    final versionId = character.activeCharacterVersionId;
    if (versionId == null || versionId.isEmpty) {
      throw const AdminApiException(
        'This Character has no active CharacterVersion to publish.',
      );
    }
    final response = await _request(
      () => _dio.put<dynamic>(
        '/v1/agents/${Uri.encodeComponent(character.characterId)}/presentation',
        options: _auth,
        data: {
          'schemaVersion': 1,
          'characterVersionId': versionId,
          'displayName': displayName.trim(),
          'roleLabel': roleLabel.trim(),
          'about': about.trim(),
          'greeting': greeting?.trim().isEmpty == true ? null : greeting?.trim(),
          'visibleInUserApp': visibleInUserApp,
          'sortOrder': sortOrder,
          'expectedRevision': null,
        },
      ),
    );
    return AgentPresentation.fromJson(_map(response.data));
  }

  Future<List<AdminUser>> users() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/users', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminUser.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<AdminUser> setUserState(AdminUser user, String state) async {
    final response = await _request(
      () => _dio.put<dynamic>(
        '/v1/admin/users/${Uri.encodeComponent(user.userId)}/state',
        options: _auth,
        data: {
          'state': state,
          'expectedRevision': user.revision,
        },
      ),
    );
    return AdminUser.fromJson(_map(response.data));
  }

  Future<List<AdminAgentRun>> agentRuns() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/agent-runs', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminAgentRun.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminOffer>> offers() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/offers', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminOffer.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminFulfillment>> fulfillments() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/fulfillments', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminFulfillment.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminLedgerEntry>> ledger() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/ledger', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminLedgerEntry.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminOperation>> operations() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/operations', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminOperation.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminReconciliationCase>> reconciliationCases() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/reconciliation', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminReconciliationCase.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminCredentialRef>> providerCredentials() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/provider-credentials', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminCredentialRef.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminAuditEvent>> auditEvents() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/audit', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminAuditEvent.fromJson(_map(item)))
        .toList(growable: false);
  }


  Future<AdminSystemSnapshot> systemSnapshot() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/system', options: _auth),
    );
    return AdminSystemSnapshot.fromJson(_map(response.data));
  }

  Future<List<AdminWorld>> worlds() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/worlds', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminWorld.fromJson(_map(item)))
        .toList(growable: false);
  }

  Future<List<AdminApproval>> approvals() async {
    final response = await _request(
      () => _dio.get<dynamic>('/v1/admin/approvals', options: _auth),
    );
    return _list(response.data)
        .map((item) => AdminApproval.fromJson(_map(item)))
        .toList(growable: false);
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

import 'package:dio/dio.dart';

/// Admin feature client. The host supplies the verified gateway Dio base URL
/// and secure current-session token; never read user roles from the client.
class OperationsApi {
  OperationsApi(this._dio, {required Future<String> Function() accessToken})
      : _accessToken = accessToken;
  final Dio _dio;
  final Future<String> Function() _accessToken;

  Future<Options> _auth() async => Options(
        headers: {'Authorization': 'Bearer ${await _accessToken()}'},
      );

  Future<OperationsOverview> overview() async {
    final result=await _dio.get<dynamic>('/v1/admin/ops/overview',options:await _auth());
    return OperationsOverview.fromJson(Map<String,dynamic>.from(result.data as Map));
  }

  Future<List<OperationFlag>> flags() async {
    final result = await _dio.get<dynamic>(
      '/v1/admin/ops/flags',
      options: await _auth(),
    );
    final data = result.data as List<dynamic>;
    return data.map((row) =>
      OperationFlag.fromJson(Map<String, dynamic>.from(row as Map))).toList();
  }

  Future<OperationPreview> preview(OperationFlag flag, bool enabled) async {
    final result = await _dio.get<dynamic>(
      '/v1/admin/ops/flags/preview',
      queryParameters: {'name': flag.name, 'enabled': '$enabled'},
      options: await _auth(),
    );
    return OperationPreview.fromJson(
      Map<String, dynamic>.from(result.data as Map),
    );
  }

  Future<OperationFlag> update(
    OperationFlag flag,
    bool enabled,
    String reason,
    String idempotencyKey,
  ) async {
    final result = await _dio.put<dynamic>(
      '/v1/admin/ops/flags/${flag.name}',
      data: {
        'enabled': enabled,
        'expectedRevision': flag.revision,
        'reason': reason,
        'idempotencyKey': idempotencyKey,
      },
      options: await _auth(),
    );
    return OperationFlag.fromJson(
      Map<String, dynamic>.from(result.data as Map),
    );
  }

  Future<List<StaffMember>> staff() async {
    final result = await _dio.get<dynamic>(
      '/v1/admin/staff',
      options: await _auth(),
    );
    return (result.data as List<dynamic>)
        .map((row) => StaffMember.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList(growable: false);
  }

  Future<List<AuditEvent>> audit() async {
    final result = await _dio.get<dynamic>(
      '/v1/admin/staff/audit',
      options: await _auth(),
    );
    return (result.data as List<dynamic>)
        .map((row) => AuditEvent.fromJson(Map<String, dynamic>.from(row as Map)))
        .toList(growable: false);
  }
}
class OperationFlag {
  const OperationFlag({required this.name, required this.enabled,required this.revision,required this.updatedAt});
  final String name;
  final bool enabled;
  final int revision;
  final DateTime? updatedAt;
  factory OperationFlag.fromJson(Map<String,dynamic> v) => OperationFlag(
    name: v['name'] as String,
    enabled: v['enabled'] as bool,
    revision: (v['revision'] as num).toInt(),
    updatedAt: DateTime.tryParse(v['updatedAt']?.toString() ?? ''),
  );
}
class OperationPreview {
  const OperationPreview({required this.current,required this.proposed,required this.requiresReleaseApproval});
  final OperationFlag current;
  final bool proposed;
  final bool requiresReleaseApproval;
  factory OperationPreview.fromJson(Map<String,dynamic> v) => OperationPreview(
    current:OperationFlag.fromJson(Map<String,dynamic>.from(v['current'] as Map)),
    proposed:v['proposed'] as bool,
    requiresReleaseApproval:v['requiresReleaseApproval'] as bool,
  );
}
class StaffMember {
  const StaffMember({required this.userId,required this.roles,required this.mfaVerified});
  final String userId;
  final List<String> roles;
  final bool mfaVerified;
  factory StaffMember.fromJson(Map<String,dynamic> v)=> StaffMember(
    userId:v['userId'] as String,
    roles:(v['roles'] as List<dynamic>).map((e)=>e.toString()).toList(),
    mfaVerified:v['mfaVerified'] as bool,
  );
}
class AuditEvent {
  const AuditEvent({required this.action,required this.actorId,required this.at,required this.subject});
  final String action;
  final String actorId;
  final String at;
  final String subject;
  factory AuditEvent.fromJson(Map<String,dynamic> v)=>AuditEvent(
    action:v['action'] as String,actorId:v['actorId'] as String,
    at:v['at'] as String,subject:v['subject'] as String,
  );
}

class OperationsOverview {
  const OperationsOverview({required this.pendingJobs, required this.activeJobLeases,
    required this.deadLetters,required this.openFinancialReconciliation,
    this.oldestPendingSeconds,this.roomAnswerAgeSeconds,this.externalSyncLagSeconds,
    this.entitlementErrors,this.budgetWarnings});
  final int pendingJobs;
  final int activeJobLeases;
  final int deadLetters;
  final int openFinancialReconciliation;
  final int? oldestPendingSeconds;
  final int? roomAnswerAgeSeconds;
  final int? externalSyncLagSeconds;
  final int? entitlementErrors;
  final int? budgetWarnings;
  factory OperationsOverview.fromJson(Map<String,dynamic> j)=>OperationsOverview(
    pendingJobs:(j['pendingJobs'] as num).toInt(),
    activeJobLeases:(j['activeJobLeases'] as num).toInt(),
    deadLetters:(j['deadLetters'] as num).toInt(),
    openFinancialReconciliation:(j['openFinancialReconciliation'] as num).toInt(),
    oldestPendingSeconds:(j['oldestPendingSeconds'] as num?)?.toInt(),
    roomAnswerAgeSeconds:(j['roomAnswerAgeSeconds'] as num?)?.toInt(),
    externalSyncLagSeconds:(j['externalSyncLagSeconds'] as num?)?.toInt(),
    entitlementErrors:(j['entitlementErrors'] as num?)?.toInt(),
    budgetWarnings:(j['budgetWarnings'] as num?)?.toInt(),
  );
}

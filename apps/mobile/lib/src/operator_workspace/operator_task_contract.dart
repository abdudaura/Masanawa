import 'dart:convert';

/// Mirrors U02's server-owned task projection; never holds approval secrets,
/// untrusted model arguments, payment credentials or user-issued "approval".
enum OperatorTaskPhase {
  proposed,
  clarifying,
  prepared,
  awaitingApproval,
  running,
  reconciling,
  succeeded,
  failed,
  cancelled,
}

OperatorTaskPhase _phase(Object? value) => switch (value) {
      'proposed' => OperatorTaskPhase.proposed,
      'clarifying' => OperatorTaskPhase.clarifying,
      'prepared' => OperatorTaskPhase.prepared,
      'awaiting_approval' => OperatorTaskPhase.awaitingApproval,
      'running' => OperatorTaskPhase.running,
      'reconciling' => OperatorTaskPhase.reconciling,
      'succeeded' => OperatorTaskPhase.succeeded,
      'failed' => OperatorTaskPhase.failed,
      'cancelled' => OperatorTaskPhase.cancelled,
      _ => throw const FormatException('Unsupported task phase'),
    };

String _string(Map<String, dynamic> json, String key,
    {int max = 256, bool allowEmpty = false}) {
  final value = json[key];
  if (value is! String || value.length > max ||
      (!allowEmpty && value.trim().isEmpty)) {
    throw FormatException('Invalid server task field: $key');
  }
  return value;
}

String? _optional(Map<String, dynamic> json, String key, {int max = 256}) {
  final value = json[key];
  if (value == null) return null;
  if (value is! String || value.isEmpty || value.length > max) {
    throw FormatException('Invalid optional server task field: $key');
  }
  return value;
}

int _revision(Map<String, dynamic> json, String key, {bool zero = false}) {
  final value = json[key];
  if (value is! int || value < (zero ? 0 : 1) || value > 2147483647) {
    throw FormatException('Invalid server task revision: $key');
  }
  return value;
}

DateTime _date(Map<String, dynamic> json, String key) {
  final value = _string(json, key, max: 40);
  final parsed = DateTime.tryParse(value);
  if (parsed == null || !value.endsWith('Z')) {
    throw FormatException('Invalid task timestamp: $key');
  }
  return parsed.toUtc();
}

Map<String, dynamic> _object(Object? input) {
  if (input is! Map) throw const FormatException('Invalid task object');
  if (input.length > 80) throw const FormatException('Task object too large');
  return Map<String, dynamic>.from(input);
}

/// Immutable, identity-fenced readback. Server is the only authority for
/// phases, approval eligibility, operation execution and verified receipts.
class OperatorTaskSnapshot {
  const OperatorTaskSnapshot({
    required this.taskId,
    required this.tenantId,
    required this.userId,
    required this.requestId,
    required this.scope,
    required this.capabilityId,
    required this.capabilityVersion,
    required this.phase,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
    this.operationClass,
    this.operationId,
    this.approvalExpiresAt,
    this.receiptRef,
    this.errorCode,
  });

  final String taskId;
  final String tenantId;
  final String userId;
  final String requestId;
  final String scope;
  final String capabilityId;
  final int capabilityVersion;
  final OperatorTaskPhase phase;
  final int version;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? operationClass;
  final String? operationId;
  final DateTime? approvalExpiresAt;
  final String? receiptRef;
  final String? errorCode;

  bool get isTerminal => phase == OperatorTaskPhase.succeeded ||
      phase == OperatorTaskPhase.failed ||
      phase == OperatorTaskPhase.cancelled;

  bool get needsApproval => phase == OperatorTaskPhase.awaitingApproval;
  bool get isUncertain => phase == OperatorTaskPhase.reconciling;
  bool get mayRequestCancel =>
      phase == OperatorTaskPhase.proposed ||
      phase == OperatorTaskPhase.clarifying ||
      phase == OperatorTaskPhase.prepared ||
      phase == OperatorTaskPhase.awaitingApproval;
  bool get hasVerifiedReceipt =>
      phase == OperatorTaskPhase.succeeded && receiptRef != null;

  factory OperatorTaskSnapshot.fromJson(Object? raw) {
    final json = _object(raw);
    final id = _string(json, 'taskId', max: 120);
    if (!RegExp(r'^task_[A-Za-z0-9_-]{8,110}$').hasMatch(id)) {
      throw const FormatException('Malformed canonical task ID');
    }
    final scope = _string(json, 'scope', max: 30);
    if (scope != 'private-assistant' && scope != 'persona-chat') {
      throw const FormatException('Unsupported task scope');
    }
    final rawClass = _optional(json, 'operationClass', max: 16);
    if (rawClass != null &&
        !const ['read', 'draft', 'send', 'financial'].contains(rawClass)) {
      throw const FormatException('Invalid operation class');
    }
    final phase = _phase(json['phase']);
    final receipt = _optional(json, 'receiptRef', max: 200);
    if (phase == OperatorTaskPhase.succeeded && receipt == null) {
      throw const FormatException('Completed task is missing server receipt');
    }
    if (receipt != null && !RegExp(r'^[A-Za-z0-9:_./-]+$').hasMatch(receipt)) {
      throw const FormatException('Invalid receipt reference');
    }
    final expires = _optional(json, 'approvalExpiresAt', max: 40);
    final expiry = expires == null ? null : DateTime.tryParse(expires);
    if (expires != null && (expiry == null || !expires.endsWith('Z'))) {
      throw const FormatException('Invalid approval deadline');
    }
    return OperatorTaskSnapshot(
      taskId: id,
      tenantId: _string(json, 'tenantId', max: 120),
      userId: _string(json, 'userId', max: 120),
      requestId: _string(json, 'requestId', max: 120),
      scope: scope,
      capabilityId: _string(json, 'capabilityId', max: 100),
      capabilityVersion: _revision(json, 'capabilityVersion'),
      phase: phase,
      version: _revision(json, 'version'),
      createdAt: _date(json, 'createdAt'),
      updatedAt: _date(json, 'updatedAt'),
      operationClass: rawClass,
      operationId: _optional(json, 'operationId', max: 120),
      approvalExpiresAt: expiry?.toUtc(),
      receiptRef: receipt,
      errorCode: _optional(json, 'errorCode', max: 80),
    );
  }
}

class OperatorTaskEvent {
  const OperatorTaskEvent({
    required this.taskId, required this.version, required this.phase,
    required this.at, this.code,
  });

  final String taskId;
  final int version;
  final OperatorTaskPhase phase;
  final DateTime at;
  final String? code;

  factory OperatorTaskEvent.fromJson(Object? raw) {
    final j = _object(raw);
    return OperatorTaskEvent(
      taskId: _string(j, 'taskId', max: 120),
      version: _revision(j, 'version'),
      phase: _phase(j['phase']),
      at: _date(j, 'at'),
      code: _optional(j, 'code', max: 80),
    );
  }
}

class OperatorTaskPage {
  const OperatorTaskPage(this.items, {this.before});
  final List<OperatorTaskSnapshot> items;
  final String? before;
}

/// An explicit Gateway binding, NOT a replacement API or an in-memory fake.
/// The U02 / Work integrator supplies calls backed by authenticated server
/// task routes. No production module may substitute generated local outcomes.
abstract class OperatorTaskTransport {
  Future<List<OperatorTaskSnapshot>> list({required int limit, String? before});
  Future<OperatorTaskSnapshot> read(String taskId);
  Future<List<OperatorTaskEvent>> events(String taskId,
      {required int afterVersion, required int limit});
  Future<OperatorTaskSnapshot> cancel(String taskId,
      {required int expectedVersion});
}

/// Adapter for a verified, authenticated Gateway client. This contains no
/// credentials, no URLs guessed from documentation and no new HTTP authority.
/// The host must bind these to the actual U02 service after route qualification.
class OperatorTaskGatewayBinding implements OperatorTaskTransport {
  const OperatorTaskGatewayBinding({
    required this.listJson, required this.readJson,
    required this.eventsJson, required this.cancelJson,
  });

  final Future<Object?> Function(int limit, String? before) listJson;
  final Future<Object?> Function(String taskId) readJson;
  final Future<Object?> Function(
      String taskId, int afterVersion, int limit) eventsJson;
  final Future<Object?> Function(String taskId, int expectedVersion) cancelJson;

  @override
  Future<List<OperatorTaskSnapshot>> list({required int limit, String? before}) async {
    if (limit < 1 || limit > 50 || (before != null && before.length > 80)) {
      throw ArgumentError('Invalid task page');
    }
    final raw = await listJson(limit, before);
    final rows = raw is List ? raw : _object(raw)['items'];
    if (rows is! List || rows.length > limit) {
      throw const FormatException('Invalid task page response');
    }
    return List.unmodifiable(rows.map(OperatorTaskSnapshot.fromJson));
  }

  @override
  Future<OperatorTaskSnapshot> read(String taskId) async =>
      OperatorTaskSnapshot.fromJson(await readJson(taskId));

  @override
  Future<List<OperatorTaskEvent>> events(String taskId,
      {required int afterVersion, required int limit}) async {
    if (afterVersion < 0 || limit < 1 || limit > 50) {
      throw ArgumentError('Invalid event cursor');
    }
    final raw = await eventsJson(taskId, afterVersion, limit);
    final rows = raw is List ? raw : _object(raw)['events'];
    if (rows is! List || rows.length > limit) {
      throw const FormatException('Invalid event page');
    }
    var revision = afterVersion;
    final parsed = <OperatorTaskEvent>[];
    for (final rawEvent in rows) {
      final event = OperatorTaskEvent.fromJson(rawEvent);
      if (event.taskId != taskId || event.version != revision + 1) {
        throw const FormatException('Noncontiguous task event cursor');
      }
      parsed.add(event);
      revision = event.version;
    }
    return List.unmodifiable(parsed);
  }

  @override
  Future<OperatorTaskSnapshot> cancel(String taskId,
      {required int expectedVersion}) async =>
      OperatorTaskSnapshot.fromJson(await cancelJson(taskId, expectedVersion));
}

/// Safe support codes are identifiers, not machine-invented diagnosis.
String readableTaskPhase(OperatorTaskPhase phase) => switch (phase) {
      OperatorTaskPhase.proposed => 'Requested',
      OperatorTaskPhase.clarifying => 'Needs information',
      OperatorTaskPhase.prepared => 'Draft ready',
      OperatorTaskPhase.awaitingApproval => 'Needs secure approval',
      OperatorTaskPhase.running => 'Working',
      OperatorTaskPhase.reconciling => 'Checking uncertain outcome',
      OperatorTaskPhase.succeeded => 'Confirmed by server',
      OperatorTaskPhase.failed => 'Failed',
      OperatorTaskPhase.cancelled => 'Cancelled',
    };

/// When wire JSON is persisted by a verified transport it must remain
/// encrypted/account-scoped; U03 itself does NOT persist sensitive DTOs.
Object? parseTaskBody(String wire) {
  if (wire.length > 512 * 1024) throw const FormatException('Task response too large');
  return jsonDecode(wire);
}

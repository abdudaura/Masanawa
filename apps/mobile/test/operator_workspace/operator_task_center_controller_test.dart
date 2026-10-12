import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/operator_workspace/operator_task_center_controller.dart';
import 'package:masanawa/src/operator_workspace/operator_task_contract.dart';

final when = DateTime.utc(2026, 10, 9);
const tenant = 'tenant_AAAAAAAA';
const alice = 'user_AAAAAAAA';
const bob = 'user_BBBBBBBB';

OperatorTaskSnapshot task({
  String id = 'task_AAAAAAAA',
  String userId = alice,
  OperatorTaskPhase phase = OperatorTaskPhase.running,
  int version = 1,
  String? receipt,
  DateTime? approvalExpiresAt,
}) => OperatorTaskSnapshot(
  taskId: id,
  tenantId: tenant,
  userId: userId,
  requestId: 'req_12345678',
  scope: 'private-assistant',
  capabilityId: 'talks.create',
  capabilityVersion: 1,
  phase: phase,
  version: version,
  createdAt: when,
  updatedAt: when,
  receiptRef: receipt,
  approvalExpiresAt: approvalExpiresAt,
);

class FakeTasks implements OperatorTaskTransport {
  List<OperatorTaskSnapshot> rows = [];
  List<OperatorTaskEvent> eventRows = [];
  Completer<List<OperatorTaskSnapshot>>? heldList;
  int cancelCalls = 0;
  int readCalls = 0;
  int eventCalls = 0;
  int listCalls = 0;
  String? lastBefore;
  int? lastCancelVersion;
  OperatorTaskSnapshot? nextRead;

  @override
  Future<List<OperatorTaskSnapshot>> list({required int limit, String? before}) async {
    listCalls++;
    lastBefore = before;
    if (heldList != null) return heldList!.future;
    return rows.take(limit).toList();
  }

  @override
  Future<OperatorTaskSnapshot> read(String taskId) async {
    readCalls++;
    return nextRead ?? rows.firstWhere((task) => task.taskId == taskId);
  }

  @override
  Future<List<OperatorTaskEvent>> events(String taskId,
      {required int afterVersion, required int limit}) async {
    eventCalls++;
    return eventRows.take(limit).toList();
  }

  @override
  Future<OperatorTaskSnapshot> cancel(String taskId,
      {required int expectedVersion}) async {
    cancelCalls++;
    lastCancelVersion = expectedVersion;
    final result = task(
      id: taskId,
      phase: OperatorTaskPhase.cancelled,
      version: expectedVersion + 1,
    );
    rows = [result];
    return result;
  }
}

void main() {
  test('server snapshot rejects unsupported status and fake success', () {
    final base = <String, dynamic>{
      'taskId': 'task_AAAAAAAA',
      'tenantId': tenant,
      'userId': alice,
      'requestId': 'req_12345678',
      'scope': 'private-assistant',
      'capabilityId': 'talks.create',
      'capabilityVersion': 1,
      'phase': 'succeeded',
      'version': 1,
      'createdAt': '2026-10-09T00:00:00.000Z',
      'updatedAt': '2026-10-09T00:00:00.000Z',
    };
    expect(() => OperatorTaskSnapshot.fromJson(base), throwsFormatException);
    expect(() => OperatorTaskSnapshot.fromJson({
      ...base, 'phase': 'running', 'scope': 'human-dm',
    }), throwsFormatException);
    expect(() => OperatorTaskSnapshot.fromJson({
      ...base, 'phase': 'unknown',
    }), throwsFormatException);
    final confirmed = OperatorTaskSnapshot.fromJson({
      ...base, 'receiptRef': 'talk:confirmed/receipt-1',
    });
    expect(confirmed.hasVerifiedReceipt, true);
  });

  test('refuses leaked account rows rather than displaying private tasks', () async {
    final api = FakeTasks()..rows = [task(userId: bob)];
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    await c.refresh();
    expect(c.tasks, isEmpty);
    expect(c.error, isNotNull);
    c.dispose();
  });

  test('late original account request cannot repopulate after sign-out', () async {
    final api = FakeTasks()
      ..heldList = Completer<List<OperatorTaskSnapshot>>();
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    final loading = c.refresh();
    c.changeOwner(tenantId: tenant, userId: bob,
        transport: FakeTasks());
    api.heldList!.complete([task(userId: alice)]);
    await loading;
    expect(c.tasks, isEmpty);
    expect(c.userId, bob);
    expect(c.initialized, false);
    c.dispose();
  });

  test('reconciling readback never executes or replays side effects', () async {
    final api = FakeTasks()..rows = [
      task(phase: OperatorTaskPhase.reconciling),
    ];
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    await c.refresh();
    final read = await c.readback('task_AAAAAAAA');
    expect(read!.isUncertain, true);
    expect(api.readCalls, 1);
    expect(api.cancelCalls, 0);
    expect(c.notice, contains('not resubmitted'));
    c.dispose();
  });

  test('cancellation checks revision and stops on noncancellable phases', () async {
    final api = FakeTasks()..rows = [
      task(phase: OperatorTaskPhase.awaitingApproval, version: 7),
    ];
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    await c.refresh();
    expect(await c.cancel('task_AAAAAAAA'), true);
    expect(api.lastCancelVersion, 7);
    expect(c.history.single.phase, OperatorTaskPhase.cancelled);
    expect(await c.cancel('task_AAAAAAAA'), false);
    expect(api.cancelCalls, 1);
    c.dispose();
  });

  test('expired approval fails closed and does not call a confirmation API', () async {
    final api = FakeTasks()..rows = [
      task(phase: OperatorTaskPhase.awaitingApproval,
          approvalExpiresAt: DateTime.utc(2020)),
    ];
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    await c.refresh();
    expect(await c.getApprovalReview('task_AAAAAAAA'), isNull);
    expect(c.error, contains('expired'));
    expect(api.readCalls, 1);
    c.dispose();
  });

  test('task event cursor rejects fabricated gap', () async {
    final api = FakeTasks()..rows = [task()];
    api.eventRows = [
      OperatorTaskEvent(taskId: 'task_AAAAAAAA',
          version: 4, phase: OperatorTaskPhase.running,
          at: when),
    ];
    final c = OperatorTaskCenterController(
        tenantId: tenant, userId: alice, transport: api);
    await c.refresh();
    await c.inspect('task_AAAAAAAA');
    expect(c.selectedEvents, isEmpty);
    expect(c.error, contains('event history'));
    c.dispose();
  });

  test('Gateway binding validates event page and owner can inspect only readback',
      () async {
    final wire = {
      'taskId': 'task_AAAAAAAA',
      'tenantId': tenant,
      'userId': alice,
      'requestId': 'req_12345678',
      'scope': 'private-assistant',
      'capabilityId': 'tasks.list',
      'capabilityVersion': 1,
      'phase': 'running',
      'version': 1,
      'createdAt': '2026-10-09T00:00:00.000Z',
      'updatedAt': '2026-10-09T00:00:00.000Z',
    };
    final client = OperatorTaskGatewayBinding(
      listJson: (limit, before) async => [wire],
      readJson: (_) async => wire,
      eventsJson: (_, cursor, limit) async => [
        {'taskId': 'task_AAAAAAAA', 'version': 3, 'phase': 'running',
         'at': '2026-10-09T00:00:00.000Z', 'code': null},
      ],
      cancelJson: (_, revision) async => wire,
    );
    expect((await client.list(limit: 25)).single.taskId, 'task_AAAAAAAA');
    await expectLater(client.events('task_AAAAAAAA',
        afterVersion: 0, limit: 10), throwsFormatException);
  });
}

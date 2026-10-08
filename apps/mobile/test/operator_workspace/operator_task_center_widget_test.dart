import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/operator_workspace/operator_task_center.dart';
import 'package:masanawa/src/operator_workspace/operator_task_center_controller.dart';
import 'package:masanawa/src/operator_workspace/operator_task_contract.dart';

final stamp = DateTime.utc(2026, 10, 9);
OperatorTaskSnapshot snapshot(String id, OperatorTaskPhase phase,
    {String? receipt}) => OperatorTaskSnapshot(
  taskId: id,
  tenantId: 'tenant_AAAAAAAA',
  userId: 'user_AAAAAAAA',
  requestId: 'req_AAAAAAAA',
  scope: 'private-assistant',
  capabilityId: 'talks.create',
  capabilityVersion: 1,
  phase: phase,
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
  receiptRef: receipt,
);

class WidgetTasks implements OperatorTaskTransport {
  WidgetTasks(this.rows);
  List<OperatorTaskSnapshot> rows;
  int reads = 0;
  int cancellations = 0;
  @override
  Future<List<OperatorTaskSnapshot>> list({required int limit, String? before}) async =>
      rows.take(limit).toList();
  @override
  Future<OperatorTaskSnapshot> read(String taskId) async {
    reads++;
    return rows.firstWhere((row) => row.taskId == taskId);
  }
  @override
  Future<List<OperatorTaskEvent>> events(String taskId,
      {required int afterVersion, required int limit}) async => const [];
  @override
  Future<OperatorTaskSnapshot> cancel(String taskId,
      {required int expectedVersion}) async {
    cancellations++;
    return rows.firstWhere((row) => row.taskId == taskId);
  }
}

Future<void> showCenter(WidgetTester tester,
    OperatorTaskCenterController controller, {
    Future<void> Function(OperatorTaskSnapshot)? approval,
    VoidCallback? returnToOrigin,
  }) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SizedBox(
        height: 650,
        child: OperatorTaskCenter(
          controller: controller,
          onSecureApprovalReview: approval,
          onReturnToOrigin: returnToOrigin,
          originLabel: 'Talk',
        ),
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders three sections and secure approval without auto-confirm',
      (tester) async {
    final api = WidgetTasks([
      snapshot('task_AAAAAAAA', OperatorTaskPhase.running),
      snapshot('task_BBBBBBBB', OperatorTaskPhase.awaitingApproval),
      snapshot('task_CCCCCCCC', OperatorTaskPhase.succeeded, receipt: 'receipt:3'),
    ]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    var reviews = 0;
    await showCenter(tester, c, approval: (task) async { reviews++; });
    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Needs approval'), findsOneWidget);
    expect(find.text('History'), findsOneWidget);
    expect(find.text('Working'), findsOneWidget);
    await tester.tap(find.text('Needs approval'));
    await tester.pumpAndSettle();
    expect(find.text('Needs secure approval'), findsOneWidget);
    expect(find.text('Review exact terms'), findsOneWidget);
    expect(reviews, 0);
    await tester.tap(find.text('Review exact terms'));
    await tester.pumpAndSettle();
    expect(reviews, 1);
    expect(api.reads, greaterThanOrEqualTo(2));
    c.dispose();
  });

  testWidgets('unknown outcome permits readback but no send or confirm',
      (tester) async {
    final api = WidgetTasks([
      snapshot('task_AAAAAAAA', OperatorTaskPhase.reconciling),
    ]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    await showCenter(tester, c);
    expect(find.text('Check status'), findsOneWidget);
    expect(find.text('Review exact terms'), findsNothing);
    expect(find.textContaining('Outcome not confirmed'), findsOneWidget);
    await tester.tap(find.text('Check status'));
    await tester.pumpAndSettle();
    expect(api.reads, 1);
    expect(api.cancellations, 0);
    c.dispose();
  });

  testWidgets('cancel requires explicit modal consent', (tester) async {
    final api = WidgetTasks([
      snapshot('task_AAAAAAAA', OperatorTaskPhase.prepared),
    ]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    await showCenter(tester, c);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Request cancellation?'), findsOneWidget);
    expect(api.cancellations, 0);
    await tester.tap(find.text('Keep task'));
    await tester.pumpAndSettle();
    expect(api.cancellations, 0);
    c.dispose();
  });

  testWidgets('returns to origin without changing task state', (tester) async {
    final api = WidgetTasks([]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    var returned = false;
    await showCenter(tester, c, returnToOrigin: () => returned = true);
    await tester.tap(find.text('Return to Talk'));
    await tester.pumpAndSettle();
    expect(returned, true);
    expect(api.cancellations, 0);
    c.dispose();
  });
  testWidgets('history offers pagination even when first page has only active tasks',
      (tester) async {
    final api = WidgetTasks([
      for (var i = 0; i < 25; i++)
        snapshot('task_' + i.toString().padLeft(8, '0'),
            OperatorTaskPhase.running),
    ]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    await showCenter(tester, c);
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('Load older tasks'), findsOneWidget);
    c.dispose();
  });

  testWidgets('narrow large-text screen keeps semantic actions available',
      (tester) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    final api = WidgetTasks([
      snapshot('task_AAAAAAAA', OperatorTaskPhase.reconciling),
    ]);
    final c = OperatorTaskCenterController(
      tenantId: 'tenant_AAAAAAAA', userId: 'user_AAAAAAAA', transport: api);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
        child: OperatorTaskCenter(controller: c),
      )),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Check status'), findsOneWidget);
    c.dispose();
  });

}

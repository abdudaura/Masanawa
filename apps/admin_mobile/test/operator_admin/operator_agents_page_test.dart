import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/core/admin_api.dart';
import 'package:masanawa_admin/src/operator_admin/operator_agent_api.dart';
import 'package:masanawa_admin/src/operator_admin/operator_agents_page.dart';

class FakeRepository implements OperatorAgentRepository {
  bool forbidden = false;
  bool stale = false;
  bool removed = false;
  int calls = 0;
  int writes = 0;

  @override
  Future<OperatorAgentSnapshot> snapshot() async {
    calls++;
    if (forbidden) {
      throw const OperatorAgentException('DENIED', 'Not authorized');
    }
    return OperatorAgentSnapshot(
      [
        OperatorAgent(
          id: 'character_test', name: 'Gwana', version: 'version_test',
          role: 'Assistant', visible: true, presentationRevision: 4,
          assignmentRevision: removed ? 3 : 2,
          skillIds: removed ? [] : ['skillversion_test'],
        ),
      ],
      [const OperatorSkill('skillversion_test', 'Teaching', 'ready', '1')],
      '2026-10-08T19:00:00Z',
    );
  }

  @override
  Future<void> detachSkill({required String characterId,
      required String skillVersionId, required int expectedRevision}) async {
    writes++;
    if (stale) throw const OperatorAgentException('CONFLICT', 'Reload to retry');
    if (characterId != 'character_test' ||
        skillVersionId != 'skillversion_test' || expectedRevision != 2) {
      throw StateError('Incorrect target or revision');
    }
    removed = true;
  }
}

Widget harness(FakeRepository repository) => MaterialApp(
  home: Scaffold(body: OperatorAgentsPage(
    admin: AdminApi(token: 'session-test', dio: Dio()),
    repository: repository,
  )),
);

void main() {
  testWidgets('catalog shows actual version and readiness without writable grants',
      (tester) async {
    final repository = FakeRepository();
    await tester.pumpWidget(harness(repository));
    await tester.pumpAndSettle();
    expect(find.text('Gwana'), findsOneWidget);
    await tester.tap(find.text('Gwana'));
    await tester.pumpAndSettle();
    expect(find.text('version_test'), findsOneWidget);
    expect(find.textContaining('ready'), findsOneWidget);
    expect(find.textContaining('Granting new capabilities'), findsOneWidget);
    expect(repository.writes, 0);
  });

  testWidgets('explicit confirmation, CAS and server readback before success',
      (tester) async {
    final repository = FakeRepository();
    await tester.pumpWidget(harness(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gwana'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(find.text('Remove assigned skill?'), findsOneWidget);
    expect(repository.writes, 0);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(repository.writes, 0);

    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove skill'));
    await tester.pumpAndSettle();
    expect(repository.writes, 1);
    expect(repository.calls, greaterThanOrEqualTo(2));
    expect(repository.removed, isTrue);
    expect(find.text('No skills assigned'), findsOneWidget);
  });

  testWidgets('conflict discards stale catalog and requires manual refresh',
      (tester) async {
    final repository = FakeRepository()..stale = true;
    await tester.pumpWidget(harness(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gwana'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove skill'));
    await tester.pumpAndSettle();
    expect(repository.writes, 1);
    expect(find.textContaining('Reload to retry'), findsOneWidget);
    expect(find.text('Retry safely'), findsOneWidget);
  });

  testWidgets('denied admin cannot see cached agent rows',
      (tester) async {
    final repository = FakeRepository()..forbidden = true;
    await tester.pumpWidget(harness(repository));
    await tester.pumpAndSettle();
    expect(find.text('Gwana'), findsNothing);
    expect(find.textContaining('Not authorized'), findsOneWidget);
  });
}

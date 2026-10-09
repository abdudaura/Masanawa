import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/operator_memory/agent_memory_controller.dart';
import 'package:masanawa/src/operator_memory/manage_agent_memory_screen.dart';

class FakeAgentMemoryTransport implements AgentMemoryTransport {
  bool enabled = false;
  int revision = 0;
  List<AgentMemoryEntry> saved = [];
  Completer<List<AgentMemoryEntry>>? delayedList;
  @override
  Future<AgentMemoryConsent> consent() async =>
      AgentMemoryConsent(enabled: enabled, revision: revision);
  @override
  Future<AgentMemoryConsent> setConsent(bool next, int expectedRevision) async {
    if (expectedRevision != revision) throw StateError('stale consent');
    enabled = next;
    return AgentMemoryConsent(enabled: enabled, revision: ++revision);
  }
  @override
  Future<List<AgentMemoryEntry>> list() async =>
      delayedList == null ? List.of(saved) : delayedList!.future;
  @override
  Future<AgentMemoryEntry> remember(String kind, String content, int ttlDays) async {
    if (!enabled) throw StateError('opt in required');
    final entry = AgentMemoryEntry(id: 'memory-record_test', kind: kind,
        content: content, revision: 1, observedAt: DateTime.utc(2026, 10, 9));
    saved.add(entry);
    return entry;
  }
  @override
  Future<AgentMemoryEntry> correct(AgentMemoryEntry entry, String content) async {
    final changed = AgentMemoryEntry(id: entry.id, kind: entry.kind,
        content: content, revision: entry.revision + 1,
        observedAt: DateTime.utc(2026, 10, 9));
    saved = [for (final item in saved) item.id == entry.id ? changed : item];
    return changed;
  }
  @override
  Future<String> prepareForget(AgentMemoryEntry entry) async => 'operation_pending';
}

void main() {
  test('unknown consent and malformed response fail closed', () {
    expect(() => AgentMemoryConsent.fromJson({'enabled': false, 'revision': -1}),
        throwsFormatException);
    expect(() => AgentMemoryEntry.fromJson({
      'id': 'memory-record_test', 'revision': 1, 'kind': 'human-dm',
      'content': 'private', 'observedAt': '2026-10-09T00:00:00Z',
    }), throwsFormatException);
  });

  test('account switch during delayed read discards previous user memory', () async {
    final transport = FakeAgentMemoryTransport();
    transport.delayedList = Completer<List<AgentMemoryEntry>>();
    var account = 'tenant-A/user-A';
    final controller = AgentMemoryController(
      transport: transport, sessionKey: () => account);
    final load = controller.refresh();
    await Future<void>.delayed(Duration.zero);
    account = 'tenant-A/user-B';
    controller.resetForAccountChange();
    transport.delayedList!.complete([
      AgentMemoryEntry(id: 'memory-record_old', kind: 'preference',
        content: 'A secret', revision: 1, observedAt: DateTime.utc(2026, 10, 9)),
    ]);
    await load;
    expect(controller.entries, isEmpty);
    expect(controller.consentState, isNull);
    controller.dispose();
  });

  testWidgets('review remains available after opt-out, no silent write',
      (tester) async {
    final transport = FakeAgentMemoryTransport();
    transport.saved.add(AgentMemoryEntry(
      id: 'memory-record_saved', kind: 'preference',
      content: 'Use Hausa', revision: 1, observedAt: DateTime.utc(2026, 10, 9),
    ));
    final controller = AgentMemoryController(
      transport: transport, sessionKey: () => 'tenant/user');
    await tester.pumpWidget(MaterialApp(home:
        ManageAgentMemoryScreen(controller: controller)));
    await tester.pumpAndSettle();
    expect(find.text('Use Hausa'), findsOneWidget);
    expect(find.text('Remember'), findsOneWidget);
    final button = tester.widget<FilledButton>(find.ancestor(
        of: find.text('Remember'), matching: find.byType(FilledButton)));
    expect(button.onPressed, isNull);
    expect(controller.enabled, isFalse);
    controller.dispose();
  });

  testWidgets('secure forget preparation does not pretend deletion',
      (tester) async {
    final transport = FakeAgentMemoryTransport();
    transport.saved.add(AgentMemoryEntry(
      id: 'memory-record_saved', kind: 'preference',
      content: 'Remember this', revision: 1, observedAt: DateTime.utc(2026, 10, 9),
    ));
    final controller = AgentMemoryController(
      transport: transport, sessionKey: () => 'tenant/user');
    await tester.pumpWidget(MaterialApp(home:
        ManageAgentMemoryScreen(controller: controller)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Memory actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Forget securely'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Remember this'), findsOneWidget);
    expect(transport.saved, hasLength(1));
    controller.dispose();
  });
}

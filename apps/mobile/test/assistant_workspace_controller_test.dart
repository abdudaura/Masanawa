import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/assistant_workspace/assistant_workspace_controller.dart';

AgentDirectoryEntry entry(
    String id, String name, {bool preferred = false, String? voiceName}) =>
  AgentDirectoryEntry(
    characterId: id,
    characterVersionId: 'version-' + id,
    displayName: name,
    roleLabel: 'Support',
    about: 'A platform assistant',
    presence: AgentPresence.unknown,
    supportAgent: true,
    defaultPlatformAgent: preferred,
    voiceName: voiceName,
  );

class DirectoryFake implements AgentDirectoryTransport {
  List<AgentDirectoryEntry> entries = [
    entry('character-gwani', 'Gwani', preferred: true),
    entry('character-gwana', 'Gwana'),
  ];
  bool failSwitch = false;
  bool failLoad = false;
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    if (failLoad) throw StateError('offline');
    return entries;
  }
  @override
  Future<void> setDefaultPlatformAgent(String id) async {
    if (failSwitch) throw StateError('server rejected');
    entries = [
      for (final e in entries)
        entry(e.characterId, e.displayName, preferred: e.characterId == id),
    ];
  }
}

class JournalFake implements AssistantPendingJournal {
  final Map<String, AssistantPendingTurn> saved = {};
  @override
  Future<AssistantPendingTurn?> read(String owner) async => saved[owner];
  @override
  Future<void> write(String owner, AssistantPendingTurn turn) async {
    saved[owner] = turn;
  }
  @override
  Future<void> clear(String owner) async { saved.remove(owner); }
}

class AgentsFake implements AgentTransport {
  final requestIds = <String>[];
  bool failOnce = false;
  int opens = 0;
  @override
  Future<AgentSessionBinding> openSession(String id) async {
    opens++;
    return AgentSessionBinding(
        characterId: id, characterSessionId: 'session-$id');
  }

  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String)? onTextDelta,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    requestIds.add(requestId!);
    if (failOnce) {
      failOnce = false;
      throw StateError('unknown network response');
    }
    return const AgentTurnResult(text: 'Authoritative service result');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('Not relevant to this test');
}

class ShellFake implements AgentShellTransport {
  final Map<String, List<AgentHistoryMessage>> messages = {};
  Future<void> Function(String)? beforeHistoryReturn;
  final Map<String, String> statuses = {};

  @override
  Future<List<AgentHistoryMessage>> loadHistory(
      String characterId, {int limit = 100, String? before}) async {
    if (beforeHistoryReturn != null) await beforeHistoryReturn!(characterId);
    return messages[characterId] ?? [];
  }

  @override
  Future<AgentTurnStatus> turnStatus(
      String characterId, String requestId) async =>
      AgentTurnStatus(state: statuses[requestId] ?? 'missing');

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('Not relevant to this test');
}

class DeniedJournal extends JournalFake {
  @override
  Future<void> write(String owner, AssistantPendingTurn turn) async {
    throw StateError('keystore unavailable');
  }
}

AssistantWorkspaceController controller(
    DirectoryFake d, AgentsFake a, ShellFake s, AssistantPendingJournal j,
    {String owner = 'user-a'}) => AssistantWorkspaceController(
      directory: d, agents: a, shell: s, journal: j, ownerId: owner);

void main() {
  test('only genuine support agents make one attributed chronological list',
      () async {
    final d = DirectoryFake();
    final a = AgentsFake();
    final s = ShellFake();
    final j = JournalFake();
    s.messages['character-gwana'] = [
      AgentHistoryMessage(
        key: 'later', direction: 'assistant', requestId: 'request-b',
        text: 'Gwana answer', parts: const [],
        createdAt: DateTime.utc(2026, 10, 8, 11, 1),
      ),
    ];
    s.messages['character-gwani'] = [
      AgentHistoryMessage(
        key: 'first', direction: 'assistant', requestId: 'request-a',
        text: 'Gwani answer', parts: const [],
        createdAt: DateTime.utc(2026, 10, 8, 11, 0),
      ),
    ];
    final c = controller(d, a, s, j);
    await c.load();
    expect(c.error, isNull);
    expect(c.activeRole, AssistantRole.gwani);
    expect(c.history.map((e) => e.role), [
      AssistantRole.gwani, AssistantRole.gwana,
    ]);
    expect(c.history.map((e) => e.message.text),
      ['Gwani answer', 'Gwana answer']);
    c.dispose();
  });

  test('refresh refuses to misattribute a Gwana history after directory remap',
      () async {
    final d = DirectoryFake();
    final s = ShellFake();
    final c = controller(d, AgentsFake(), s, JournalFake());
    await c.load();
    final gate = Completer<void>();
    s.beforeHistoryReturn = (_) => gate.future;
    final refresh = c.refreshHistory();
    d.entries = [
      entry('character-gwani', 'Gwani', preferred: true),
      entry('character-gwana-new', 'Gwana'),
    ];
    gate.complete();
    await refresh;
    expect(c.history, isEmpty);
    expect(c.ready, false);
    expect(c.error, contains('Could not refresh'));
    c.dispose();
  });

  test('revoked directory clears previous history, offline read retains it',
      () async {
    final d = DirectoryFake();
    final s = ShellFake();
    s.messages['character-gwani'] = [AgentHistoryMessage(
      key: 'safe-1', direction: 'assistant', requestId: 'request-safe',
      text: 'Earlier authorized response', parts: const [],
      createdAt: DateTime.utc(2026, 10, 9),
    )];
    final c = controller(d, AgentsFake(), s, JournalFake());
    await c.load();
    expect(c.history, hasLength(1));
    d.failLoad = true;
    await c.refreshHistory();
    expect(c.history, hasLength(1)); // Transport failure is not revocation.
    expect(c.ready, true);
    d.failLoad = false;
    d.entries = [entry('character-gwani', 'Gwani', preferred: true)];
    await c.refreshHistory();
    expect(c.history, isEmpty);
    expect(c.ready, false);
    c.dispose();
  });

  test('conflicting official name and voice cannot label another role',
      () async {
    final d = DirectoryFake();
    d.entries = [
      entry('character-gwani', 'Gwani', voiceName: 'Sulafat', preferred: true),
      entry('character-gwana', 'Gwana', voiceName: 'Sulafat'),
    ];
    final c = controller(d, AgentsFake(), ShellFake(), JournalFake());
    await c.load();
    expect(c.ready, false);
    expect(c.history, isEmpty);
    expect(c.error, isNotNull);
    c.dispose();
  });

  test('late refresh cannot overwrite a successful persona switch', () async {
    final d = DirectoryFake();
    final s = ShellFake();
    final c = controller(d, AgentsFake(), s, JournalFake());
    await c.load();
    final gate = Completer<void>();
    s.beforeHistoryReturn = (_) => gate.future;
    final refresh = c.refreshHistory();
    await c.switchTo(AssistantRole.gwana);
    gate.complete();
    await refresh;
    expect(c.activeRole, AssistantRole.gwana);
    expect(c.ready, true);
    c.dispose();
  });

  test('authoritative role switch persists; rejection preserves old role',
      () async {
    final d = DirectoryFake();
    final c = controller(d, AgentsFake(), ShellFake(), JournalFake());
    await c.load();
    await c.switchTo(AssistantRole.gwana);
    expect(c.activeRole, AssistantRole.gwana);
    expect(d.entries.where((e) => e.defaultPlatformAgent)
        .single.characterId, 'character-gwana');
    d.failSwitch = true;
    await c.switchTo(AssistantRole.gwani);
    expect(c.activeRole, AssistantRole.gwana);
    expect(c.error, contains('Could not confirm'));
    c.dispose();
  });

  test('unknown send retries with same durable request ID, never fabricates ack',
      () async {
    final d = DirectoryFake();
    final a = AgentsFake()..failOnce = true;
    final s = ShellFake();
    final j = JournalFake();
    final c = controller(d, a, s, j);
    await c.load();
    await c.sendText('A request requiring a safe retry');
    expect(j.saved['user-a']!.text, 'A request requiring a safe retry');
    expect(c.pending, isNotNull);
    expect(c.notice, isNull);
    expect(a.requestIds, hasLength(1));
    await c.switchTo(AssistantRole.gwana);
    expect(c.activeRole, AssistantRole.gwani);
    await c.retryPending();
    expect(a.requestIds, hasLength(2));
    expect(a.requestIds[0], a.requestIds[1]);
    expect(j.saved['user-a'], isNull);
    expect(c.notice, contains('acknowledged'));
    c.dispose();
  });

  test('a prior request completed after timeout is reconciled without resend',
      () async {
    final d = DirectoryFake();
    final a = AgentsFake();
    final s = ShellFake();
    final j = JournalFake();
    const id = 'request_0199bc88-1710-7000-8000-000000000123';
    final turn = AssistantPendingTurn(
      characterId: 'character-gwani', role: AssistantRole.gwani,
      requestId: id, text: 'Already executed',
    );
    await j.write('user-a', turn);
    s.statuses[id] = 'completed';
    final c = controller(d, a, s, j);
    await c.load();
    expect(c.pending, isNotNull);
    await c.retryPending();
    expect(a.requestIds, isEmpty);
    expect(c.pending, isNull);
    c.dispose();
  });

  test('account switch fences old private history and pending operation',
      () async {
    final d = DirectoryFake();
    final j = JournalFake();
    final c = controller(d, AgentsFake(), ShellFake(), j);
    await c.load();
    await c.sendText('Only account A can resume this');
    expect(c.pending, isNull);
    c.changeOwner('user-b');
    expect(c.history, isEmpty);
    expect(c.roster, isEmpty);
    expect(c.activeRole, isNull);
    expect(c.pending, isNull);
    await c.load();
    expect(c.ownerId, 'user-b');
    c.dispose();
  });

  test('protected journal write failure prevents any network send', () async {
    final a = AgentsFake();
    final c = controller(DirectoryFake(), a, ShellFake(), DeniedJournal());
    await c.load();
    await c.sendText('Do not send without durable retry safety');
    expect(a.requestIds, isEmpty);
    expect(c.pending, isNull);
    expect(c.error, contains('Protected storage'));
    c.dispose();
  });

  test('canonical server Bodi/Sulafat voices handle custom admin labels',
      () async {
    final directory = DirectoryFake();
    directory.entries = [
      entry('character-w', 'Support Primary', voiceName: 'Bodi', preferred: true),
      entry('character-a', 'Support Secondary', voiceName: 'Sulafat'),
    ];
    final c = controller(directory, AgentsFake(), ShellFake(), JournalFake());
    await c.load();
    expect(c.ready, true);
    expect(c.roster[AssistantRole.gwani]!.characterId, 'character-w');
    expect(c.roster[AssistantRole.gwana]!.characterId, 'character-a');
    c.dispose();
  });

  test('missing, duplicate or non-support identities fail closed', () async {
    final d = DirectoryFake();
    d.entries = [entry('character-w', 'Gwani', preferred: true)];
    final c = controller(d, AgentsFake(), ShellFake(), JournalFake());
    await c.load();
    expect(c.ready, false);
    expect(c.error, isNotNull);
    c.dispose();
  });
}

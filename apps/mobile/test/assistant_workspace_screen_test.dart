import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/assistant_workspace/assistant_workspace_controller.dart';
import 'package:masanawa/src/assistant_workspace/assistant_workspace_screen.dart';
import 'package:masanawa/src/assistant_workspace/assistant_draft_store.dart';

class DirectoryForWidget implements AgentDirectoryTransport {
  String current = 'character-w';
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async => [
    for (final (id, name) in [
      ('character-w', 'Gwani'), ('character-a', 'Gwana'),
    ])
      AgentDirectoryEntry(
        characterId: id,
        characterVersionId: 'version-' + id,
        displayName: name,
        roleLabel: 'Assistant', about: 'Authorized platform assistant',
        presence: AgentPresence.unknown,
        supportAgent: true, defaultPlatformAgent: current == id,
      ),
  ];
  @override
  Future<void> setDefaultPlatformAgent(String id) async { current = id; }
}

class AgentsForWidget implements AgentTransport {
  final List<String> sent = [];
  @override
  Future<AgentSessionBinding> openSession(String id) async =>
      AgentSessionBinding(characterId: id, characterSessionId: 'session-' + id);
  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    String? requestId,
    void Function(String)? onTextDelta,
    Future<void> Function(Uint8List chunk)? onAudioPcmChunk,
  }) async {
    sent.add(text);
    return const AgentTurnResult(text: 'Server replied');
  }
  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('No media used in this widget test');
}

class ShellForWidget implements AgentShellTransport {
  @override
  Future<List<AgentHistoryMessage>> loadHistory(
      String id, {int limit = 100, String? before}) async => [];
  @override
  Future<AgentTurnStatus> turnStatus(String id, String requestId) async =>
      const AgentTurnStatus(state: 'missing');
  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('No other shell operation used in this test');
}

class JournalForWidget implements AssistantPendingJournal {
  AssistantPendingTurn? pending;
  @override
  Future<AssistantPendingTurn?> read(String user) async => pending;
  @override
  Future<void> write(String user, AssistantPendingTurn turn) async {
    pending = turn;
  }
  @override
  Future<void> clear(String user) async { pending = null; }
}

class DraftsForWidget implements AssistantDraftStore {
  final saved = <String, String>{};
  @override
  Future<String?> read(String user) async => saved[user];
  @override
  Future<void> write(String user, String text) async { saved[user] = text; }
  @override
  Future<void> clear(String user) async { saved.remove(user); }
}

void main() {
  testWidgets('single in-chat switch, text send and no fake native mic',
      (tester) async {
    final directory = DirectoryForWidget();
    final agents = AgentsForWidget();
    await tester.pumpWidget(MaterialApp(
      home: AssistantWorkspaceScreen(
        ownerId: 'user-a', directory: directory,
        agents: agents, shell: ShellForWidget(),
        journal: JournalForWidget(),
        drafts: DraftsForWidget(),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Gwani'), findsWidgets);
    expect(find.byIcon(Icons.mic), findsNothing,
        reason: 'Mic must only appear if real native integration is supplied');

    await tester.enterText(find.byType(TextField), 'Hello Gwani');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(agents.sent, ['Hello Gwani']);
    expect(find.text('Server acknowledged your message.'), findsOneWidget);
    expect(find.text('Server replied'), findsNothing,
        reason: 'Reply must come from durable server history, not a local fake');

    await tester.tap(find.byTooltip('Switch assistant'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Switch to Gwana'));
    await tester.pumpAndSettle();
    expect(directory.current, 'character-a');
    expect(find.text('Gwana'), findsWidgets);
  });
  testWidgets('shared draft survives persona switch but never leaks to another account',
      (tester) async {
    final directory = DirectoryForWidget();
    final agents = AgentsForWidget();
    final shell = ShellForWidget();
    final journal = JournalForWidget();
    final drafts = DraftsForWidget();
    drafts.saved['user-a'] = 'My private A draft';
    drafts.saved['user-b'] = 'An unrelated B draft';
    Widget surface(String owner) => MaterialApp(
      home: AssistantWorkspaceScreen(
        ownerId: owner, directory: directory,
        agents: agents, shell: shell,
        journal: journal, drafts: drafts,
      ),
    );

    await tester.pumpWidget(surface('user-a'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'My private A draft');
    await tester.tap(find.byTooltip('Switch assistant'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Switch to Gwana'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'My private A draft');

    await tester.pumpWidget(surface('user-b'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'An unrelated B draft');
    await tester.pumpWidget(surface('user-a'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'My private A draft');
  });

}


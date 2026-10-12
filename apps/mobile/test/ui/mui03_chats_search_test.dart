import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/chat/chat_list_screen.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'fan-a',
  name: 'Fan',
  locale: 'en',
  status: 'ACTIVE',
  role: 'fan',
  isNewUser: false,
  createdAt: '2026-10-12T00:00:00Z',
);

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(
    _user,
    AuthTokens(
      accessToken: 'test',
      refreshToken: 'test',
      accessExpiresIn: 900,
      user: _user,
    ),
  );

  void switchTo(String id) {
    state = SessionSignedIn(
      AuthUser(
        id: id, name: 'Other', locale: 'en', status: 'ACTIVE',
        role: 'fan', isNewUser: false, createdAt: '2026-10-12T00:00:00Z',
      ),
      AuthTokens(
        accessToken: 'another-test', refreshToken: 'another-test',
        accessExpiresIn: 900,
        user: AuthUser(
          id: id, name: 'Other', locale: 'en', status: 'ACTIVE',
          role: 'fan', isNewUser: false, createdAt: '2026-10-12T00:00:00Z',
        ),
      ),
    );
  }
}

class _Directory extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(
    loading: false,
    agents: [
      AgentDirectoryEntry(
        characterId: 'character_00000000-0000-0000-0000-000000000001',
        characterVersionId: 'v1',
        displayName: 'Gwana Bello',
        roleLabel: 'Teacher',
        about: '',
        presence: AgentPresence.unknown,
      ),
      AgentDirectoryEntry(
        characterId: 'character_00000000-0000-0000-0000-000000000002',
        characterVersionId: 'v2',
        displayName: 'Gwani',
        roleLabel: 'Guide',
        about: '',
        presence: AgentPresence.unknown,
      ),
    ],
  );
}

class _Chats extends AiChatController {
  _Chats(this.offline);
  final bool offline;

  @override
  AiChatState build() => AiChatState(
    online: !offline,
    threads: {
      for (final thread in [
        ChatThread(
          characterId: 'character_00000000-0000-0000-0000-000000000001',
          title: 'History lessons',
          unread: 2,
          pinned: true,
          updatedAt: DateTime.utc(2026, 10, 12),
          messages: [
            AiChatMessage(
              id: 'm1', isUser: false, text: 'A lesson',
              createdAt: DateTime.utc(2026, 10, 12),
            ),
          ],
        ),
        ChatThread(
          characterId: 'character_00000000-0000-0000-0000-000000000002',
          title: 'Language practice',
          updatedAt: DateTime.utc(2026, 10, 11),
          messages: [
            AiChatMessage(
              id: 'm2', isUser: false, text: 'Sannu',
              createdAt: DateTime.utc(2026, 10, 11),
            ),
          ],
        ),
        // A stale cached thread MUST NOT become searchable without
        // a matching server-authorized directory entry.
        ChatThread(
          characterId: 'character_00000000-0000-0000-0000-000000000003',
          title: 'Private hidden',
          messages: [
            AiChatMessage(
              id: 'm3', isUser: false, text: 'Secret',
              createdAt: DateTime.utc(2026, 10, 10),
            ),
          ],
        ),
      ]) thread.characterId: thread,
    },
  );
}

void main() {
  Future<ProviderContainer> mount(
    WidgetTester tester, {
    bool offline = false,
    double width = 390,
  }) async {
    tester.view.physicalSize = Size(width, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const ChatListScreen()),
      GoRoute(
        path: '/chat/:id',
        builder: (_, state) => Scaffold(
          body: Text('Opened ${state.pathParameters['id']}'),
        ),
      ),
      GoRoute(path: '/masana', builder: (_, _) =>
          const Scaffold(body: Text('Discover'))),
    ]);
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_Session.new),
          aiChatProvider.overrideWith(() => _Chats(offline)),
          agentDirectoryProvider.overrideWith(_Directory.new),
        ],
        child: MaterialApp.router(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    return ProviderScope.containerOf(
      tester.element(find.byType(ChatListScreen)),
    );
  }

  testWidgets('live search matches authorized name, title and character id',
      (tester) async {
    await mount(tester);
    final field = find.byType(TextField);
    expect(find.text('History lessons'), findsOneWidget);
    expect(find.text('Language practice'), findsOneWidget);
    expect(find.text('Private hidden'), findsNothing);
    expect(find.byIcon(Icons.push_pin), findsOneWidget);
    expect(find.text('2'), findsOneWidget);

    await tester.enterText(field, '  GWaNa  ');
    await tester.pump();
    expect(find.text('History lessons'), findsOneWidget);
    expect(find.text('Language practice'), findsNothing);

    await tester.enterText(field, 'practice');
    await tester.pump();
    expect(find.text('Language practice'), findsOneWidget);
    expect(find.text('History lessons'), findsNothing);

    await tester.enterText(field, '000000000002');
    await tester.pump();
    expect(find.text('Language practice'), findsOneWidget);

    await tester.enterText(field, 'Private hidden');
    await tester.pump();
    expect(find.text('No matching conversations'), findsOneWidget);
    await tester.tap(find.text('Clear search'));
    await tester.pump();
    expect(find.text('History lessons'), findsOneWidget);
    expect(find.text('Language practice'), findsOneWidget);
  });

  testWidgets('offline query is honest and clear restores pinned/unread rows',
      (tester) async {
    await mount(tester, offline: true, width: 320);
    await tester.enterText(find.byType(TextField), 'missing');
    await tester.pump();
    expect(find.text('No matches in saved conversations'), findsOneWidget);
    expect(find.textContaining('Offline searches only'), findsOneWidget);
    await tester.tap(find.byTooltip('Clear chat search'));
    await tester.pump();
    expect(find.text('History lessons'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account switch discards search controller/query',
      (tester) async {
    final container = await mount(tester);
    await tester.enterText(find.byType(TextField), 'no-result');
    await tester.pump();
    expect(find.text('No matching conversations'), findsOneWidget);
    (container.read(sessionProvider.notifier) as _Session).switchTo('fan-b');
    await tester.pump();
    expect(find.byType(TextField), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty);
    expect(find.text('No matching conversations'), findsNothing);
  });

  testWidgets('tapping filtered row preserves canonical chat open route',
      (tester) async {
    await mount(tester);
    await tester.enterText(find.byType(TextField), 'practice');
    await tester.pump();
    await tester.tap(find.text('Language practice'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Opened character_00000000'), findsOneWidget);
  });
}

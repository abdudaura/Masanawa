import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/features/masana_chat/inbox_search.dart';
import 'package:masanawa/src/screens/chat/chat_list_screen.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const fan = AuthUser(
  id: 'fan-a', name: 'Fan', locale: 'en',
  status: 'ACTIVE', role: 'fan', isNewUser: false,
  createdAt: '2026-10-13T00:00:00Z',
);

class TestSession extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(fan, AuthTokens(
    accessToken: 'old-fan-token', refreshToken: 'r', accessExpiresIn: 600,
    user: fan,
  ));
  void switchAccount() {
    const another = AuthUser(
      id: 'fan-b', name: 'Other', locale: 'en',
      status: 'ACTIVE', role: 'fan', isNewUser: false,
      createdAt: '2026-10-13T00:00:00Z',
    );
    state = const SessionSignedIn(another, AuthTokens(
      accessToken: 'new-fan-token', refreshToken: 'r2',
      accessExpiresIn: 600, user: another,
    ));
  }
}

class TestDirectory extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(
    loading: false,
    agents: [
      AgentDirectoryEntry(
        characterId: 'character_00000000-0000-0000-0000-000000000001',
        characterVersionId: 'v1', displayName: 'Gwana',
        roleLabel: 'Teacher', about: '', presence: AgentPresence.unknown,
      ),
    ],
  );
}

class TestChats extends AiChatController {
  @override
  AiChatState build() => AiChatState(online: true, threads: {
    'character_00000000-0000-0000-0000-000000000001': ChatThread(
      characterId: 'character_00000000-0000-0000-0000-000000000001',
      title: 'Local history',
      updatedAt: DateTime.utc(2026, 10, 13),
      messages: [
        AiChatMessage(id:'m1', isUser:false, text:'Cached',
          createdAt: DateTime.utc(2026, 10, 13)),
      ],
    ),
  });
}

class FakeInbox implements MasanaInboxSearchAccess {
  final calls = <String>[];
  final pins = <String>[];
  final reads = <String>[];
  final pending = <String, Completer<List<MasanaInboxSearchItem>>>{};
  bool disabled = false;
  final remote = const MasanaInboxSearchItem(
    characterId: 'character_00000000-0000-0000-0000-000000000099',
    displayName: 'Astronomy Masana', profession: 'Scientist',
    lastMessage: 'Stars are bright', pinned: false,
    unreadCount: 2, revision: 3,
  );

  @override
  Future<List<MasanaInboxSearchItem>> search({
    required String bearer, required String query,
  }) async {
    calls.add('$bearer:$query');
    if (disabled) {
      final options = RequestOptions(path: '/v1/chats');
      throw DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 503),
        type: DioExceptionType.badResponse,
      );
    }
    final wait = pending[query];
    if (wait != null) return wait.future;
    return query == 'astronomy' ? [remote] : [];
  }

  @override
  Future<int> setPinned({
    required String bearer, required String characterId,
    required bool pinned, required int expectedRevision,
  }) async {
    pins.add('$bearer:$characterId:$pinned:$expectedRevision');
    return expectedRevision + 1;
  }

  @override
  Future<void> markRead({
    required String bearer, required String characterId,
  }) async {
    reads.add('$bearer:$characterId');
  }
}

void main() {
  Future<ProviderContainer> mount(WidgetTester tester, FakeInbox inbox) async {
    tester.view.physicalSize = const Size(390, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final router = GoRouter(routes: [
      GoRoute(path:'/', builder:(_, _) => const ChatListScreen()),
      GoRoute(path:'/chat/:id', builder:(_, state) =>
        Scaffold(body:Text('Opened ${state.pathParameters['id']}'))),
      GoRoute(path:'/masana', builder:(_, _) =>
        const Scaffold(body:Text('Discover'))),
    ]);
    addTearDown(router.dispose);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(TestSession.new),
        agentDirectoryProvider.overrideWith(TestDirectory.new),
        aiChatProvider.overrideWith(TestChats.new),
        masanaInboxSearchProvider.overrideWithValue(inbox),
      ],
      child: MaterialApp.router(
        theme: buildMasanawaTheme(brightness:Brightness.light),
        routerConfig: router,
      ),
    ));
    await tester.pumpAndSettle();
    return ProviderScope.containerOf(
      tester.element(find.byType(ChatListScreen)),
    );
  }

  testWidgets('no startup fetch; server search, pin, read and open', (tester) async {
    final inbox = FakeInbox();
    await mount(tester, inbox);
    expect(inbox.calls, isEmpty);
    expect(find.text('Local history'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Astronomy');
    await tester.pump(const Duration(milliseconds: 380));
    await tester.pump();
    expect(inbox.calls, contains('old-fan-token:astronomy'));
    expect(find.text('Astronomy Masana'), findsOneWidget);
    expect(find.text('Stars are bright'), findsOneWidget);
    await tester.tap(find.byTooltip('Pin server conversation'));
    await tester.pump();
    expect(inbox.pins.single, contains('old-fan-token:'));
    expect(find.byTooltip('Unpin server conversation'), findsOneWidget);
    await tester.tap(find.text('Astronomy Masana'));
    await tester.pumpAndSettle();
    expect(inbox.reads.single, contains('old-fan-token:'));
    expect(find.textContaining('Opened character_'), findsOneWidget);
  });

  testWidgets('out-of-order server search cannot replace later query', (tester) async {
    final inbox = FakeInbox();
    final old = Completer<List<MasanaInboxSearchItem>>();
    inbox.pending['alpha'] = old;
    await mount(tester, inbox);
    await tester.enterText(find.byType(TextField), 'alpha');
    await tester.pump(const Duration(milliseconds: 380));
    await tester.enterText(find.byType(TextField), 'astronomy');
    await tester.pump(const Duration(milliseconds: 380));
    await tester.pump();
    expect(find.text('Astronomy Masana'), findsOneWidget);
    old.complete(const []);
    await tester.pump();
    expect(find.text('Astronomy Masana'), findsOneWidget);
  });

  testWidgets('switching fans fences late search response and clears query', (tester) async {
    final inbox = FakeInbox();
    final pending = Completer<List<MasanaInboxSearchItem>>();
    inbox.pending['astronomy'] = pending;
    final container = await mount(tester, inbox);
    await tester.enterText(find.byType(TextField), 'astronomy');
    await tester.pump(const Duration(milliseconds: 380));
    (container.read(sessionProvider.notifier) as TestSession).switchAccount();
    await tester.pump();
    pending.complete([inbox.remote]);
    await tester.pump();
    expect(find.text('Astronomy Masana'), findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, isEmpty);
    expect(inbox.calls, contains('old-fan-token:astronomy'));
    expect(inbox.calls.any((c) => c.startsWith('new-fan-token:')), isFalse);
  });

  testWidgets('server unavailable preserves saved conversation and retry', (tester) async {
    final inbox = FakeInbox()..disabled = true;
    await mount(tester, inbox);
    await tester.enterText(find.byType(TextField), 'history');
    await tester.pump(const Duration(milliseconds: 380));
    await tester.pump();
    expect(find.text('Local history'), findsOneWidget);
    expect(find.textContaining('Server conversations are not available yet'), findsOneWidget);
    expect(find.text('Retry server search'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/agents/twin_directory.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/screens/twin/twin_home_shell.dart';
import 'package:masanawa/src/screens/activity/activity_screen.dart';
import 'package:masanawa/src/screens/you/you_screen.dart';
import 'package:masanawa/src/state/talk_activity_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FakeTalkTransport implements TalkTransport {
  const _FakeTalkTransport();

  static const explore = TalkDiscoveryItem(
    id: 'explore-1',
    title: 'Is university still worth it?',
    hostName: 'Aisha',
    isLive: false,
    listenerCount: 1200,
    commentCount: 42,
  );

  static const live = TalkDiscoveryItem(
    id: 'live-1',
    title: 'Can AI create more jobs than it removes?',
    hostName: 'Abdullahi',
    isLive: true,
    listenerCount: 830,
    commentCount: 19,
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async {
    return feed == TalkFeedKind.live ? const [live] : const [explore, live];
  }

  @override
  Future<TalkDetail> loadTalk(String talkId) async {
    return TalkDetail(talk: talkId == live.id ? live : explore);
  }

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async {
    return TalkDiscoveryItem(
      id: 'created',
      title: title ?? topic,
      hostName: 'You',
      isLive: true,
      listenerCount: 0,
      viewerIsHost: true,
    );
  }

  @override
  Future<TalkDiscoveryItem> updateTalk({
    required String talkId,
    String? title,
    String? topic,
    String? summary,
  }) async => (await loadTalk(talkId)).talk;

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async {
    return TalkComment(
      id: 'comment',
      authorName: 'You',
      body: body,
      createdAt: DateTime(2026, 10, 7),
    );
  }
}

class _CountingActivityTransport implements TalkActivityTransport {
  int loads = 0;

  @override
  Future<void> respondToInvitation({
    required String talkId,
    required bool accept,
  }) async {}

  @override
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) async {
    loads += 1;
    return const [];
  }
}

class _FakeTwinDirectoryTransport implements TwinDirectoryTransport {
  const _FakeTwinDirectoryTransport();

  @override
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  }) async => TwinDirectoryPage(
    items: [
      if (query.isEmpty || 'Amina Twin'.toLowerCase().contains(query.toLowerCase()))
        const TwinDirectoryEntry(
          publicId: 'amina-twin',
          characterId: 'twin-character-1',
          displayName: 'Amina Twin',
          bio: 'Public storyteller',
          languages: ['en'],
          voiceEnabled: true,
          ownerAccessEnabled: false,
          publicUrl: null,
        ),
    ],
    nextCursor: null,
  );

  @override
  Future<TwinDirectoryEntry?> resolve({required String publicId}) async => null;
}

Widget _app({TalkActivityTransport? activity, int initialIndex = 0}) {
  return ProviderScope(
    overrides: [
      talkTransportProvider.overrideWithValue(const _FakeTalkTransport()),
      talkActivityTransportProvider.overrideWithValue(
        activity ?? _CountingActivityTransport(),
      ),
      twinDirectoryTransportProvider.overrideWithValue(
        const _FakeTwinDirectoryTransport(),
      ),
    ],
    child: MaterialApp.router(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      routerConfig: GoRouter(
        initialLocation: '/home',
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => TwinHomeShell(initialIndex: initialIndex),
          ),
          GoRoute(
            path: '/activity',
            builder: (_, __) => const ActivityScreen(),
          ),
          GoRoute(
            path: '/you',
            builder: (_, __) => const YouScreen(),
          ),
          GoRoute(
            path: '/persona/:id',
            builder: (_, state) => Scaffold(
              body: Text('Profile ${state.pathParameters['id']}'),
            ),
          ),
        ],
      ),
    ),
  );
}

void main() {
  test('R17 agent search matches server roles and names without inventing records', () {
    const agents = [
      AgentDirectoryEntry(
        characterId: 'expert-1',
        characterVersionId: 'v1',
        displayName: 'Kwararriya',
        roleLabel: 'Research expert',
        about: 'Evidence and sources',
        presence: AgentPresence.available,
      ),
      AgentDirectoryEntry(
        characterId: 'support-1',
        characterVersionId: 'v2',
        displayName: 'Gwani',
        roleLabel: 'Assistant',
        about: 'General support',
        presence: AgentPresence.offline,
      ),
    ];
    expect(matchingAgentEntries(agents, 'research').single.characterId, 'expert-1');
    expect(matchingAgentEntries(agents, 'GWANI').single.characterId, 'support-1');
    expect(matchingAgentEntries(agents, 'not-found'), isEmpty);
    expect(matchingAgentEntries(agents, '').length, 2);
  });

  testWidgets('R17 root shell has the approved four destinations and header', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Agents'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Talk'), findsOneWidget);
    expect(find.text('Create'), findsNothing);
    expect(find.byTooltip('Start Talk'), findsOneWidget);
    expect(find.byTooltip('Activity'), findsOneWidget);
    expect(find.byTooltip('Profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('bottom tab selection updates deep-linkable route', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.smart_toy_outlined));
    await tester.pumpAndSettle();
    var router = GoRouter.of(tester.element(find.byType(TwinHomeShell)));
    expect(router.routeInformationProvider.value.uri.queryParameters['tab'], 'agents');

    await tester.tap(find.byIcon(Icons.account_balance_wallet_outlined));
    await tester.pumpAndSettle();
    router = GoRouter.of(tester.element(find.byType(TwinHomeShell)));
    expect(router.routeInformationProvider.value.uri.queryParameters['tab'], 'wallet');

    await tester.tap(find.byIcon(Icons.home_outlined));
    await tester.pumpAndSettle();
    router = GoRouter.of(tester.element(find.byType(TwinHomeShell)));
    expect(router.routeInformationProvider.value.uri.path, '/home');
    expect(router.routeInformationProvider.value.uri.queryParameters['tab'], isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Home keeps a single visible title and vertical Talk tabs', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Masanawa'), findsOneWidget);
    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Live Talks'), findsOneWidget);
    expect(find.text('Is university still worth it?'), findsOneWidget);
    await tester.tap(find.text('Live Talks'));
    await tester.pumpAndSettle();
    expect(find.text('Can AI create more jobs than it removes?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Agents tab presents public Twins from the Gateway directory', (tester) async {
    await tester.pumpWidget(_app(initialIndex: 1));
    await tester.pumpAndSettle();

    expect(find.text('Masanawa Agents'), findsOneWidget);
    expect(find.text('Twins'), findsOneWidget);
    await tester.tap(find.text('Twins'));
    await tester.pumpAndSettle();
    expect(find.text('Amina Twin'), findsOneWidget);
    expect(find.text('Public storyteller'), findsOneWidget);
    expect(find.text('My Twin'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('public Twin private Talk checks directory before navigation', (tester) async {
    await tester.pumpWidget(_app(initialIndex: 1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Twins'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Talk'));
    await tester.pumpAndSettle();
    expect(
      find.text('Private Talk with Amina Twin is not available yet.'),
      findsOneWidget,
    );
    expect(find.text('View profile'), findsOneWidget);
    await tester.tap(find.text('View profile'));
    await tester.pumpAndSettle();
    expect(find.text('Profile amina-twin'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Activity is opened from the header and not fetched on Home', (tester) async {
    final activity = _CountingActivityTransport();
    await tester.pumpWidget(_app(activity: activity));
    await tester.pumpAndSettle();
    expect(activity.loads, 0);

    await tester.tap(find.byTooltip('Activity'));
    await tester.pumpAndSettle();
    expect(activity.loads, 1);
    expect(find.text('Nothing here yet.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Profile header action opens the existing You hub route', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Profile'));
    await tester.pumpAndSettle();
    expect(find.text('Your profile'), findsOneWidget);
    expect(find.text('Settings & privacy'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('private Talk does not start a microphone on tab entry', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Talk'));
    await tester.pumpAndSettle();
    // Without a qualified server agent, the shell fails closed with Retry.
    expect(find.text('Gwani is unavailable right now.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.byTooltip('Start Talk'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('four destinations fit on compact Android width', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Agents'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Talk'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/screens/twin/twin_home_shell.dart';
import 'package:masanawa/src/state/talk_activity_state.dart';
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
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) async {
    loads += 1;
    return const [];
  }
}

Widget _app({
  TalkActivityTransport? activity,
  int initialIndex = 0,
}) {
  return ProviderScope(
    overrides: [
      talkTransportProvider.overrideWithValue(const _FakeTalkTransport()),
      talkActivityTransportProvider.overrideWithValue(
        activity ?? _CountingActivityTransport(),
      ),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: TwinHomeShell(initialIndex: initialIndex),
    ),
  );
}

void main() {
  testWidgets('root shell is Home Create Activity You', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Create'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);

    expect(find.text('Wallet'), findsNothing);
    expect(find.text('Agents'), findsNothing);
    expect(find.text('Rooms'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Home contains Explore and Live Talks tabs', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Live Talks'), findsOneWidget);
    expect(find.text('Is university still worth it?'), findsOneWidget);

    await tester.tap(find.text('Live Talks'));
    await tester.pumpAndSettle();

    expect(
      find.text('Can AI create more jobs than it removes?'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('initial Activity tab opens new Activity directly', (tester) async {
    await tester.pumpWidget(_app(initialIndex: 2));
    await tester.pumpAndSettle();

    expect(find.text('Nothing here yet.'), findsOneWidget);
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Talks'), findsOneWidget);
    expect(find.text('Money'), findsOneWidget);
    expect(find.text('Social'), findsOneWidget);
    expect(find.text('Your conversations will appear here.'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('four-tab shell stays usable on narrow Android viewport',
      (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Create'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('inactive Activity does not fetch until visited', (tester) async {
    final activity = _CountingActivityTransport();

    await tester.pumpWidget(_app(activity: activity));
    await tester.pumpAndSettle();
    expect(activity.loads, 0);

    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();

    expect(activity.loads, 1);
    expect(tester.takeException(), isNull);
  });
}

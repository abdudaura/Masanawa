import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/talks/talk_home_screen.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FeedTransport implements TalkTransport {
  const _FeedTransport();

  static const first = TalkDiscoveryItem(
    id: 'first',
    title: 'Should everyone learn to use AI?',
    summary: 'A practical discussion about work and learning.',
    hostName: 'Amina',
    isLive: true,
    listenerCount: 2400,
    commentCount: 81,
  );

  static const second = TalkDiscoveryItem(
    id: 'second',
    title: 'Can small businesses compete globally?',
    summary: 'Founders discuss what actually changes the odds.',
    hostName: 'Musa',
    isLive: false,
    listenerCount: 970,
    commentCount: 33,
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async {
    return feed == TalkFeedKind.live ? const [first] : const [first, second];
  }

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      const TalkDetail(talk: first);

  @override
  Future<TalkDiscoveryItem> createTalk({
    required String topic,
    String? title,
  }) async =>
      first;

  @override
  Future<TalkComment> addComment({
    required String talkId,
    required String body,
  }) async =>
      TalkComment(
        id: 'new',
        authorName: 'You',
        body: body,
        createdAt: DateTime(2026, 10, 7),
      );
}

Widget _app() => ProviderScope(
      overrides: [
        talkTransportProvider.overrideWithValue(const _FeedTransport()),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const TalkHomeScreen(),
      ),
    );

void main() {
  testWidgets('Home exposes exactly Explore and Live Talks discovery tabs',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Live Talks'), findsOneWidget);
    expect(find.text('For You'), findsNothing);
    expect(find.text('Rooms'), findsNothing);
  });

  testWidgets('Explore Talk cards stack vertically, never as a grid',
      (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final first = find.byKey(const ValueKey('talk-card-first'));
    final second = find.byKey(const ValueKey('talk-card-second'));

    expect(first, findsOneWidget);
    expect(second, findsOneWidget);
    expect(find.byType(GridView), findsNothing);

    final firstTop = tester.getTopLeft(first);
    final secondTop = tester.getTopLeft(second);
    expect((firstTop.dx - secondTop.dx).abs(), lessThan(1));
    expect(secondTop.dy, greaterThan(firstTop.dy));
  });

  testWidgets('Live Talks reuses the same vertical card language', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Live Talks'));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('talk-card-first')), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-card-second')), findsNothing);
    expect(find.text('Listen'), findsOneWidget);
  });
}

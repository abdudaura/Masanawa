import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/rooms/rooms_screen.dart';
import 'package:masanawa/src/state/talk_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _RoomsTransport implements TalkTransport {
  const _RoomsTransport();

  static const live = TalkDiscoveryItem(
    id: 'room-live',
    title: 'Evening gist',
    hostName: 'Amina',
    isLive: true,
    listenerCount: 12,
  );

  static const ended = TalkDiscoveryItem(
    id: 'room-ended',
    title: 'Old recording',
    hostName: 'Musa',
    isLive: false,
    listenerCount: 300,
  );

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async =>
      const [live, ended];

  @override
  Future<TalkDetail> loadTalk(String talkId) async =>
      throw UnimplementedError();

  @override
  Future<TalkDiscoveryItem> createTalk({required String topic, String? title}) =>
      throw UnimplementedError();

  @override
  Future<TalkDiscoveryItem> updateTalk(
          {required String talkId,
          String? title,
          String? topic,
          String? summary}) =>
      throw UnimplementedError();

  @override
  Future<TalkComment> addComment({required String talkId, required String body}) =>
      throw UnimplementedError();
}

Widget _app() => ProviderScope(
      overrides: [
        talkTransportProvider.overrideWithValue(const _RoomsTransport()),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const RoomsScreen(),
      ),
    );

void main() {
  testWidgets('rooms lists only live sessions', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.text('Evening gist'), findsOneWidget);
    expect(find.text('Old recording'), findsNothing);
    expect(find.text('LIVE'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('rooms shows an honest empty state', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        talkTransportProvider.overrideWithValue(const _EmptyTransport()),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const RoomsScreen(),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No live rooms'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _EmptyTransport extends _RoomsTransport {
  const _EmptyTransport();

  @override
  Future<List<TalkDiscoveryItem>> loadFeed(TalkFeedKind feed) async =>
      const [];
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/library/talk_library.dart';
import 'package:masanawa/src/screens/you/my_talks_screen.dart';
import 'package:masanawa/src/screens/you/saved_talks_screen.dart';
import 'package:masanawa/src/state/talk_library_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _LibraryTransport implements TalkLibraryTransport {
  static const live = TalkDiscoveryItem(
    id: 'live-owned',
    title: 'My live Talk',
    hostName: 'You',
    isLive: true,
    listenerCount: 42,
    viewerIsHost: true,
  );

  static const replay = TalkDiscoveryItem(
    id: 'replay-owned',
    title: 'My replay',
    hostName: 'You',
    isLive: false,
    listenerCount: 320,
    viewerIsHost: true,
  );

  static const saved = TalkDiscoveryItem(
    id: 'saved-1',
    title: 'A Talk I saved',
    hostName: 'Amina',
    isLive: false,
    listenerCount: 800,
  );

  @override
  Future<MyTalksView> loadMyTalks() async => MyTalksView(
        live: const [live],
        replays: const [replay],
        drafts: [
          TalkDraftPreview(
            id: 'draft-1',
            topic: 'A draft topic',
            updatedAt: DateTime(2026, 10, 7),
          ),
        ],
      );

  @override
  Future<List<TalkDiscoveryItem>> loadSavedTalks() async => const [saved];
}

Widget _app({
  required Widget home,
  TalkLibraryTransport? transport,
}) {
  return ProviderScope(
    overrides: [
      talkLibraryTransportProvider.overrideWithValue(
        transport ?? _LibraryTransport(),
      ),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: home,
    ),
  );
}

void main() {
  testWidgets('My Talks exposes Live Replays and persisted Drafts',
      (tester) async {
    await tester.pumpWidget(
      _app(home: const MyTalksScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Live'), findsOneWidget);
    expect(find.text('Replays'), findsOneWidget);
    expect(find.text('Drafts'), findsOneWidget);
    expect(find.text('My live Talk'), findsOneWidget);
    expect(find.byType(GridView), findsNothing);

    await tester.tap(find.text('Replays'));
    await tester.pumpAndSettle();
    expect(find.text('My replay'), findsOneWidget);
    expect(find.text('My live Talk'), findsNothing);

    await tester.tap(find.text('Drafts'));
    await tester.pumpAndSettle();
    expect(find.text('A draft topic'), findsOneWidget);
  });

  testWidgets('owned Talk opens canonical Talk callback', (tester) async {
    TalkDiscoveryItem? opened;
    await tester.pumpWidget(
      _app(
        home: MyTalksScreen(onOpenTalk: (talk) => opened = talk),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('owned-talk-live-owned')));
    await tester.pump();

    expect(opened?.id, 'live-owned');
    expect(opened?.viewerIsHost, isTrue);
  });

  testWidgets('Saved Talks stays a simple vertical listening list',
      (tester) async {
    TalkDiscoveryItem? opened;
    await tester.pumpWidget(
      _app(
        home: SavedTalksScreen(onOpenTalk: (talk) => opened = talk),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('A Talk I saved'), findsOneWidget);
    expect(find.byType(GridView), findsNothing);

    await tester.tap(find.byKey(const ValueKey('saved-talk-saved-1')));
    await tester.pump();

    expect(opened?.id, 'saved-1');
  });
}

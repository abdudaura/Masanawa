import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/home/home_models.dart';
import 'package:masanawa/src/home/home_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  const snapshot = HomeSnapshot(
    assistants: [
      HomeAssistantCardModel(
        role: HomeAssistantRole.gwani,
        characterId: 'gwani-from-server',
        displayName: 'Gwani',
        description: 'Ready to help',
        voiceLabel: 'Bodi',
      ),
      HomeAssistantCardModel(
        role: HomeAssistantRole.gwana,
        characterId: 'gwana-from-server',
        displayName: 'Gwana',
        description: 'Ready to help',
        voiceLabel: 'Sulafat',
      ),
    ],
    myTwin: HomeTwinCardModel(
      title: 'My Twin',
      subtitle: '',
      hasTwin: true,
      characterId: 'my-twin-from-server',
    ),
    continuations: [
      HomeContinuationModel(
        id: 'old-chat-history',
        title: 'Old conversation',
        subtitle: 'Must not render on Home',
        kind: 'chat',
      ),
    ],
    rooms: [
      HomeRoomCardModel(
        roomId: 'internet-cafe-server-id',
        title: 'Internet Cafe',
        description: 'Digital services',
        iconKey: 'internet_cafe',
      ),
      HomeRoomCardModel(
        roomId: 'news-server-id',
        title: 'News',
        description: 'Current sourced stories',
        iconKey: 'news',
      ),
    ],
  );

  Widget app(Widget child) => MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: child,
      );

  testWidgets('renders compact Gwani and Gwana side by side', (tester) async {
    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.ready(snapshot))),
    );

    final gwani = find.byKey(const ValueKey('home-assistant-gwani'));
    final gwana = find.byKey(const ValueKey('home-assistant-gwana'));
    expect(gwani, findsOneWidget);
    expect(gwana, findsOneWidget);
    expect(tester.getTopLeft(gwani).dy, tester.getTopLeft(gwana).dy);
    expect(tester.getSize(gwani).height, lessThanOrEqualTo(72));
    expect(find.text('Bodi'), findsNothing);
    expect(find.text('Sulafat'), findsNothing);
  });

  testWidgets('assistant tile opens exact server Character chat', (tester) async {
    HomeAssistantCardModel? selected;
    HomeAssistantAction? action;
    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onAssistantAction: (assistant, value) {
            selected = assistant;
            action = value;
          },
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('home-assistant-gwani')));
    await tester.pump();

    expect(selected?.characterId, 'gwani-from-server');
    expect(action, HomeAssistantAction.chat);
  });

  testWidgets('assistant call affordance emits live voice intent', (tester) async {
    HomeAssistantAction? action;
    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onAssistantAction: (_, value) => action = value,
        ),
      ),
    );

    final tile = find.byKey(const ValueKey('home-assistant-gwani'));
    await tester.tap(find.descendant(of: tile, matching: find.byIcon(Icons.call_rounded)));
    await tester.pump();

    expect(action, HomeAssistantAction.liveVoice);
  });

  testWidgets('Home never renders conversation history or verbose section labels',
      (tester) async {
    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.ready(snapshot))),
    );

    expect(find.text('Old conversation'), findsNothing);
    expect(find.text('Must not render on Home'), findsNothing);
    expect(find.text('Your assistants'), findsNothing);
    expect(find.text('Quick services'), findsNothing);
    expect(find.text('Rooms'), findsNothing);
  });

  testWidgets('quick services preserve intent-only routing', (tester) async {
    HomeQuickService? selected;
    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onQuickService: (service) => selected = service,
        ),
      ),
    );
    await tester.tap(find.byKey(const ValueKey('home-quick-data')));
    await tester.pump();
    expect(selected, HomeQuickService.data);
  });

  testWidgets('server room identity remains intact', (tester) async {
    HomeRoomCardModel? opened;
    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onOpenRoom: (room) => opened = room,
        ),
      ),
    );
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('home-room-internet-cafe-server-id')),
      200,
    );
    await tester.tap(
      find.byKey(const ValueKey('home-room-internet-cafe-server-id')),
    );
    expect(opened?.roomId, 'internet-cafe-server-id');
  });

  testWidgets('error state never exposes transport exception details',
      (tester) async {
    await tester.pumpWidget(
      app(
        const HomeScreen(
          state: HomeViewState.error(
            'DioException [connection error]: socket failed',
          ),
        ),
      ),
    );
    expect(find.text('Couldn’t refresh Masanawa'), findsOneWidget);
    expect(find.textContaining('DioException'), findsNothing);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('compact assistant row remains usable at 320dp', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.ready(snapshot))),
    );
    expect(tester.takeException(), isNull);
    final gwani = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwani')),
    );
    final gwana = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwana')),
    );
    expect(gwani.dy, gwana.dy);
  });
}

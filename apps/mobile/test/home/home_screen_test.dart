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
      subtitle: 'Teach and manage your twin',
      hasTwin: true,
      characterId: 'my-twin-from-server',
    ),
    continuations: [
      HomeContinuationModel(
        id: 'continue-1',
        title: 'Continue lesson',
        subtitle: 'Fractions',
        kind: 'study',
        roomId: 'study-room',
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

  testWidgets('renders Gwana left and Gwani right from server projection',
      (tester) async {
    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.ready(snapshot))),
    );

    final gwana = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwana')),
    );
    final gwani = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwani')),
    );

    expect(gwana.dx, lessThan(gwani.dx));
    expect(find.text('Bodi'), findsOneWidget);
    expect(find.text('Sulafat'), findsOneWidget);
  });

  testWidgets('assistant actions preserve exact server character identity',
      (tester) async {
    HomeAssistantCardModel? selected;
    HomeAssistantAction? selectedAction;

    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onAssistantAction: (assistant, action) {
            selected = assistant;
            selectedAction = action;
          },
        ),
      ),
    );

    final gwanaCard = find.byKey(const ValueKey('home-assistant-gwana'));
    final chat = find.descendant(
      of: gwanaCard,
      matching: find.byTooltip('Chat'),
    );
    await tester.tap(chat);
    await tester.pump();

    expect(selected?.characterId, 'gwana-from-server');
    expect(selectedAction, HomeAssistantAction.chat);
  });

  testWidgets('Crypto Tokens sits directly after Internet Cafe',
      (tester) async {
    HomeQuickService? selected;

    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onQuickService: (service) => selected = service,
        ),
      ),
    );

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('home-room-crypto-tokens')),
      300,
    );

    final cafe = tester.getTopLeft(
      find.byKey(const ValueKey('home-room-internet-cafe-server-id')),
    );
    final crypto = tester.getTopLeft(
      find.byKey(const ValueKey('home-room-crypto-tokens')),
    );
    expect(crypto.dy, greaterThan(cafe.dy));

    await tester.tap(find.byKey(const ValueKey('home-room-crypto-tokens')));
    await tester.pump();
    expect(selected, HomeQuickService.crypto);

    expect(find.text('Your assistants'), findsNothing);
    expect(find.text('Quick services'), findsNothing);
    expect(find.text('Rooms'), findsNothing);
  });

  testWidgets('assistant Talk action emits live talk intent',
      (tester) async {
    HomeAssistantAction? selectedAction;

    await tester.pumpWidget(
      app(
        HomeScreen(
          state: const HomeViewState.ready(snapshot),
          onAssistantAction: (_, action) => selectedAction = action,
        ),
      ),
    );

    final gwaniCard = find.byKey(const ValueKey('home-assistant-gwani'));
    await tester.tap(
      find.descendant(of: gwaniCard, matching: find.byTooltip('Talk')),
    );
    await tester.pump();

    expect(selectedAction, HomeAssistantAction.talk);
  });

  testWidgets('quick services emit intent only and do not execute billing',
      (tester) async {
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

  testWidgets('room cards return server room model to integration owner',
      (tester) async {
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
      find.byKey(const ValueKey('home-room-news-server-id')),
      300,
    );
    await tester.tap(find.byKey(const ValueKey('home-room-news-server-id')));
    await tester.pump();

    expect(opened?.roomId, 'news-server-id');
  });

  testWidgets('loading, error and empty states are explicit', (tester) async {
    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.loading())),
    );
    expect(find.byKey(const ValueKey('home-loading')), findsOneWidget);

    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.error('Offline'))),
    );
    expect(find.byKey(const ValueKey('home-error')), findsOneWidget);
    expect(find.text('Offline'), findsOneWidget);

    await tester.pumpWidget(
      app(
        const HomeScreen(
          state: HomeViewState.ready(
            HomeSnapshot(assistants: [], rooms: []),
          ),
        ),
      ),
    );
    expect(find.byKey(const ValueKey('home-empty')), findsOneWidget);
  });

  testWidgets('assistant cards stay side by side on a narrow phone',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      app(const HomeScreen(state: HomeViewState.ready(snapshot))),
    );

    expect(tester.takeException(), isNull);
    final gwana = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwana')),
    );
    final gwani = tester.getTopLeft(
      find.byKey(const ValueKey('home-assistant-gwani')),
    );
    expect(gwana.dy, gwani.dy);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_activity.dart';
import 'package:masanawa/src/agents/twin_directory.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/home/home_models.dart';
import 'package:masanawa/src/home/home_state.dart';
import 'package:masanawa/src/screens/twin/twin_home_shell.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/twin_activity_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FakeHomeController extends HomeController {
  @override
  Future<HomeSnapshot> build() async => const HomeSnapshot(
        assistants: [
          HomeAssistantCardModel(
            role: HomeAssistantRole.gwana,
            characterId: 'character-gwana',
            displayName: 'Gwana',
            description: 'Platform assistant',
            voiceLabel: 'Sulafat',
          ),
          HomeAssistantCardModel(
            role: HomeAssistantRole.gwani,
            characterId: 'character-gwani',
            displayName: 'Gwani',
            description: 'Platform assistant',
            voiceLabel: 'Bodi',
          ),
        ],
        rooms: [
          HomeRoomCardModel(
            roomId: 'room.internet-cafe',
            title: 'Internet Cafe',
            description: 'Digital services',
            iconKey: 'internet_cafe',
          ),
        ],
        myTwin: HomeTwinCardModel(
          title: 'My Twin',
          subtitle: 'Teach and manage your Twin',
          hasTwin: true,
          characterId: 'character-owner',
        ),
      );
}

void main() {
  testWidgets('signed-in root exposes Home, Explore, Activity and Wallet',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          homeProvider.overrideWith(_FakeHomeController.new),
          twinDirectoryTransportProvider.overrideWithValue(
            const UnavailableTwinDirectoryTransport(),
          ),
          twinActivityTransportProvider.overrideWithValue(
            const UnavailableTwinActivityTransport(),
          ),
          walletTransportProvider.overrideWithValue(
            const UnavailableWalletTransport(),
          ),
        ],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: const TwinHomeShell(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Home'), findsWidgets);
    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Gwana'), findsOneWidget);
    expect(find.text('Gwani'), findsOneWidget);
    expect(find.text('My Twin'), findsOneWidget);
    expect(find.text('Agents'), findsNothing);
    expect(find.text('Agent Float'), findsNothing);
    expect(find.text('Skills'), findsNothing);

    await tester.tap(find.text('Explore'));
    await tester.pump();
    expect(find.text('Search twins'), findsOneWidget);

    await tester.tap(find.text('Activity'));
    await tester.pump();
    expect(find.text('Activity is not available yet.'), findsOneWidget);

    await tester.tap(find.text('Wallet'));
    await tester.pump();
    expect(find.text('Wallet is not available yet.'), findsOneWidget);

    expect(tester.takeException(), isNull);
  });

  testWidgets('initial Activity tab deep link opens Activity directly',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          homeProvider.overrideWith(_FakeHomeController.new),
          twinDirectoryTransportProvider.overrideWithValue(
            const UnavailableTwinDirectoryTransport(),
          ),
          twinActivityTransportProvider.overrideWithValue(
            const UnavailableTwinActivityTransport(),
          ),
          walletTransportProvider.overrideWithValue(
            const UnavailableWalletTransport(),
          ),
        ],
        child: MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          home: const TwinHomeShell(initialIndex: 2),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Activity is not available yet.'), findsOneWidget);
    expect(find.text('Gwana'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

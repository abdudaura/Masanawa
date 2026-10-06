import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_activity.dart';
import 'package:masanawa/src/agents/twin_directory.dart';
import 'package:masanawa/src/agents/twin_profile.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/screens/twin/twin_home_shell.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/my_twin_state.dart';
import 'package:masanawa/src/state/twin_activity_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _EmptyTwinTransport implements TwinProfileTransport {
  const _EmptyTwinTransport();

  static const profile = TwinProfile(
    hasTwin: false,
    characterId: null,
    displayName: '',
    bio: '',
    publicUrl: null,
    discoverable: false,
    voiceEnabled: false,
    ownerAccessEnabled: false,
    languages: [],
    summary: TwinPerformanceSummary(
      visitors: 0,
      conversations: 0,
      earningsCredits: 0,
      pendingOwnerRequests: 0,
    ),
  );

  @override
  Future<TwinProfile> load() async => profile;

  @override
  Future<TwinProfile> setDiscoverable(bool discoverable) async => profile;
}

class _CountingActivityTransport implements TwinActivityTransport {
  int loads = 0;

  @override
  Future<TwinActivityView> load({int limit = 50}) async {
    loads += 1;
    return const TwinActivityView(
      hasTwin: false,
      characterId: null,
      summary: TwinActivitySummary(
        visitors: 0,
        conversations: 0,
        earningsCredits: 0,
        pendingOwnerRequests: 0,
      ),
      items: [],
    );
  }
}

void main() {
  testWidgets('signed-in root exposes My Twin, Explore, Activity and Wallet',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          twinProfileTransportProvider.overrideWithValue(
            const _EmptyTwinTransport(),
          ),
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
    expect(find.text('My Twin'), findsWidgets);
    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.text('Create your digital twin'), findsOneWidget);
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
          twinProfileTransportProvider.overrideWithValue(
            const _EmptyTwinTransport(),
          ),
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
    expect(find.text('Create your digital twin'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('four-tab shell stays usable on a narrow Android viewport',
      (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          twinProfileTransportProvider.overrideWithValue(
            const _EmptyTwinTransport(),
          ),
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

    expect(find.text('My Twin'), findsWidgets);
    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });


  testWidgets('inactive root tabs do not start provider work until visited',
      (tester) async {
    final activityTransport = _CountingActivityTransport();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isSignedInProvider.overrideWithValue(true),
          twinProfileTransportProvider.overrideWithValue(
            const _EmptyTwinTransport(),
          ),
          twinDirectoryTransportProvider.overrideWithValue(
            const UnavailableTwinDirectoryTransport(),
          ),
          twinActivityTransportProvider.overrideWithValue(activityTransport),
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
    expect(activityTransport.loads, 0);

    await tester.tap(find.text('Activity'));
    await tester.pumpAndSettle();

    expect(activityTransport.loads, 1);
    expect(tester.takeException(), isNull);
  });

}

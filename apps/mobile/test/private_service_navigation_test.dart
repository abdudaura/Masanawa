import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/screens/twin/twin_home_shell.dart';
import 'package:masanawa/src/router/app_router.dart';
import 'package:masanawa/src/services/private_service_intent.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/talk_social_profile_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'test-user',
  name: 'Test user',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  user: _user,
  accessToken: 'test-only',
  refreshToken: 'test-only',
  accessExpiresIn: 3600,
);

class _SignedInSession extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);

  void signOutForTest() => state = const SessionSignedOut();
}

class _OfflineWallet extends WalletController {
  @override
  Future<WalletView?> build() async => throw StateError('no wallet transport');
}

class _EmptyAgents extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(loading: false);
}

class _NoAuthorizedAgents implements AgentDirectoryTransport {
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async => [];
  @override
  Future<void> setDefaultPlatformAgent(String id) async => throw StateError('Unavailable');
}

void main() {
  testWidgets('R17 Wallet selection survives the GoRouter root rebuild and clears on logout',
      (tester) async {
    final container = ProviderContainer(overrides: [
      sessionProvider.overrideWith(_SignedInSession.new),
      walletProvider.overrideWith(_OfflineWallet.new),
      agentDirectoryProvider.overrideWith(_EmptyAgents.new),
      agentDirectoryTransportProvider.overrideWithValue(_NoAuthorizedAgents()),
      humanProfileByUserIdProvider('test-user').overrideWith((ref) async => null),
    ]);
    addTearDown(container.dispose);

    final router = GoRouter(
      initialLocation: '/home?tab=wallet',
      routes: [
        GoRoute(
          path: '/assistant',
          builder: (_, state) => const TwinHomeShell(initialIndex: 2),
        ),
        GoRoute(
          path: '/home',
          builder: (_, state) => TwinHomeShell(
            initialIndex: shellRootTabIndex(state.uri.queryParameters['tab']),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        supportedLocales: MasanawaLocalization.supportedLocales,
        localizationsDelegates: MasanawaLocalization.delegates,
        theme: buildMasanawaTheme(brightness: Brightness.light),
      ),
    ));
    await tester.pumpAndSettle();

    // The money API being offline cannot strand the independent service entry.
    expect(find.text('Data bundles'), findsOneWidget);
    await tester.tap(find.text('Data bundles'));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/assistant');

    final selected = container.read(pendingPrivateServiceIntentProvider);
    expect(selected?.intent, PrivateServiceIntent.data);
    expect(selected?.ownerUserId, 'test-user');

    // A missing Gwani profile produces a recoverable status, not a fabricated
    // assistant identity or an automatic AI/payment operation.
    expect(find.text('Assistant not available. Retry after signing in.'), findsOneWidget);


    (container.read(sessionProvider.notifier) as _SignedInSession)
        .signOutForTest();
    await tester.pump();
    expect(container.read(pendingPrivateServiceIntentProvider), isNull);
    expect(tester.takeException(), isNull);
  });
}

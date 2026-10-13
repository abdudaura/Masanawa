import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/splash/splash_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'test-account', name: 'Sample', email: 'test@example.invalid',
  locale: 'en-NG', status: 'ACTIVE', role: 'USER', isNewUser: false,
  createdAt: '2026-10-13T00:00:00Z',
);
final _tokens = AuthTokens(
  accessToken: 'only-in-test', refreshToken: 'only-in-test',
  accessExpiresIn: 900, user: _user,
);

class _StartupSession extends SessionController {
  _StartupSession(this.initial);
  final SessionState initial;

  @override
  SessionState build() => initial;

  void setSession(SessionState next) => state = next;
}

class _Harness {
  _Harness(this.container, this.router);
  final ProviderContainer container;
  final GoRouter router;

  void dispose() {
    router.dispose();
    container.dispose();
  }
}

_Harness _startHarness(SessionState initial) {
  final container = ProviderContainer(overrides: [
    sessionProvider.overrideWith(() => _StartupSession(initial)),
  ]);
  final router = GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/chats', builder: (_, _) => const Scaffold(body: Text('Chats ready'))),
      GoRoute(path: '/phone-login', builder: (_, _) => const Scaffold(body: Text('Login ready'))),
    ],
  );
  return _Harness(container, router);
}

Future<void> _mount(WidgetTester tester, _Harness harness) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: MaterialApp.router(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        routerConfig: harness.router,
      ),
    ),
  );
  await tester.pump(); // first post-frame navigation; no 1200 ms timeout
}

void main() {
  testWidgets('returning account navigates to Chats without a brand delay', (tester) async {
    final harness = _startHarness(SessionSignedIn(_user, _tokens));
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.text('Chats ready'), findsOneWidget);
  });

  testWidgets('signed out account navigates promptly to login', (tester) async {
    final harness = _startHarness(const SessionSignedOut());
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.text('Login ready'), findsOneWidget);
  });

  testWidgets('restoring session never assumes signed out after 6.2 seconds',
      (tester) async {
    final harness = _startHarness(const SessionRestoring());
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.byType(SplashScreen), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 6300));
    expect(find.textContaining('Restoring your saved session'), findsOneWidget);
    expect(find.text('Login ready'), findsNothing);

    (harness.container.read(sessionProvider.notifier) as _StartupSession)
        .setSession(SessionSignedIn(_user, _tokens));
    await tester.pump();
    expect(find.text('Chats ready'), findsOneWidget);
  });
}

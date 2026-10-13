import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/shell/startup_gate.dart';
import 'package:masanawa/src/state/session_state.dart';

const _user = AuthUser(
  id: 'test-account', name: 'Sample', email: 'test@example.invalid',
  locale: 'en-NG', status: 'ACTIVE', role: 'USER', isNewUser: false,
  createdAt: '2026-10-13T00:00:00Z',
);
final _tokens = AuthTokens(
  accessToken: 'test-only', refreshToken: 'test-only',
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
  _Harness(this.container);
  final ProviderContainer container;
  void dispose() => container.dispose();
  void change(SessionState next) {
    (container.read(sessionProvider.notifier) as _StartupSession)
        .setSession(next);
  }
}

_Harness _harness(SessionState initial) {
  return _Harness(ProviderContainer(overrides: [
    sessionProvider.overrideWith(() => _StartupSession(initial)),
  ]));
}

Future<void> _mount(WidgetTester tester, _Harness harness) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: const MaterialApp(
        home: StartupGate(child: Scaffold(body: Text('Chats ready'))),
      ),
    ),
  );
}

void main() {
  testWidgets('restoring session shows only neutral progress, not Chats',
      (tester) async {
    final harness = _harness(const SessionRestoring());
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Chats ready'), findsNothing);
    await tester.pump(const Duration(seconds: 7));
    // Never fake a logout or force a time-based navigation.
    expect(find.text('Chats ready'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('restored account renders Chats without a splash timer',
      (tester) async {
    final harness = _harness(const SessionRestoring());
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    harness.change(SessionSignedIn(_user, _tokens));
    await tester.pump();
    expect(find.text('Chats ready'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('returning authenticated account paints Chats in first frame',
      (tester) async {
    final harness = _harness(SessionSignedIn(_user, _tokens));
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.text('Chats ready'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('signed out never mounts protected child', (tester) async {
    final harness = _harness(const SessionSignedOut());
    addTearDown(harness.dispose);
    await _mount(tester, harness);
    expect(find.text('Chats ready'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/incoming_call_controller.dart';
import 'package:masanawa/src/calls/incoming_call_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'calls_screen_test.dart' show signedIn;
import 'incoming_call_test.dart' show FakeIncoming;
import 'dart:async';

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

class _RestoringSession extends SessionController {
  @override
  SessionState build() => const SessionRestoring();
  void signIn(String id) => state = signedIn(id);
}

void main() {
  testWidgets('opening invitation requires explicit acceptance', (
    tester,
  ) async {
    final transport = FakeIncoming();
    final controller = IncomingCallController(
      callId: 'call',
      accountKey: 'a',
      currentAccountKey: () => 'a',
      transport: transport,
      authorize: (_) async => null,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sessionProvider.overrideWith(_Session.new)],
        child: MaterialApp(
          home: IncomingCallScreen(callId: 'call', controller: controller),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Incoming audio call'), findsOneWidget);
    expect(transport.accepts, 0);
    await tester.tap(find.text('Accept'));
    await tester.pumpAndSettle();
    expect(transport.accepts, 1);
    expect(transport.tokens, 0);
    expect(find.text('Call ended'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'restored sign-in activates fetch and account switch hides old call',
    (tester) async {
      final session = _RestoringSession();
      final old = FakeIncoming();
      final next = FakeIncoming()..pending = Completer();
      var creations = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [sessionProvider.overrideWith(() => session)],
          child: MaterialApp(
            home: IncomingCallScreen(
              callId: 'call',
              controllerFactory: (owner) {
                creations++;
                return IncomingCallController(
                  callId: 'call',
                  accountKey: owner.user.id,
                  currentAccountKey: () =>
                      (session.state as SessionSignedIn).user.id,
                  transport: owner.user.id == 'a' ? old : next,
                  authorize: (_) async => null,
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(creations, 0);
      expect(find.text('Sign in to check this call.'), findsOneWidget);
      session.signIn('a');
      await tester.pumpAndSettle();
      expect(creations, 1);
      expect(find.text('Incoming audio call'), findsOneWidget);
      session.signIn('b');
      await tester.pump();
      expect(creations, 2);
      expect(find.text('Incoming audio call'), findsNothing);
      expect(find.text('Checking this call…'), findsOneWidget);
      next.pending!.complete(next.value);
      await tester.pumpAndSettle();
      expect(find.text('Incoming audio call'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}

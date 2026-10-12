import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/calls/incoming_call_coordinator.dart';
import 'package:masanawa/src/calls/incoming_call_transport.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'incoming_call_test.dart' show FakeIncoming;
import 'calls_screen_test.dart' show signedIn;

class _Session extends SessionController {
  @override
  SessionState build() => signedIn('a');
  void switchTo(String id) => state = signedIn(id);
}

class _Incoming extends FakeIncoming {
  Completer<List<IncomingCallRecord>>? listing;
  @override
  Future<List<IncomingCallRecord>> list() =>
      listing?.future ?? Future.value([value]);
}

void main() {
  testWidgets(
    'dropped pushes show a passive banner; account switch removes old invitation',
    (tester) async {
      final session = _Session();
      final transport = _Incoming();
      final empty = _Incoming()
        ..listing = (Completer<List<IncomingCallRecord>>()..complete([]));
      await tester.pumpWidget(
        ProviderScope(
          overrides: [sessionProvider.overrideWith(() => session)],
          child: MaterialApp(
            home: IncomingCallCoordinator(
              transportFactory: (session, _) =>
                  session.user.id == 'c' ? empty : transport,
              child: const Scaffold(body: Text('Chats')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Incoming call from Masana'), findsOneWidget);
      expect(find.text('Chats'), findsOneWidget);
      expect(transport.accepts, 0);
      transport.listing = Completer();
      session.switchTo('b');
      await tester.pump();
      expect(find.text('Incoming call from Masana'), findsNothing);
      session.switchTo('c');
      await tester.pump();
      transport.listing!.complete([transport.value]);
      await tester.pumpAndSettle();
      expect(find.text('Incoming call from Masana'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  for (final (path, active) in [
    ('/calls/incoming/existing', false),
    ('/chat/character_test', false),
    ('/home', true),
    ('/home', false),
  ]) {
    testWidgets(
      'actual banner Open guards $path with imperative call $active',
      (tester) async {
        final transport = _Incoming();
        var destinations = 0;
        final router = GoRouter(
          initialLocation: path,
          routes: [
            for (final initial in [
              '/calls/incoming/existing',
              '/chat/character_test',
              '/home',
            ])
              GoRoute(
                path: initial,
                builder: (_, _) => IncomingCallCoordinator(
                  transportFactory: (_, _) => transport,
                  child: const Scaffold(body: Text('Existing screen')),
                ),
              ),
            GoRoute(
              path: '/calls/incoming/call',
              builder: (_, _) {
                destinations++;
                return const Scaffold(body: Text('New incoming screen'));
              },
            ),
          ],
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [sessionProvider.overrideWith(_Session.new)],
            child: MaterialApp.router(routerConfig: router),
          ),
        );
        await tester.pumpAndSettle();
        if (active) {
          unawaited(
            router.routerDelegate.navigatorKey.currentState!.push<void>(
              PageRouteBuilder<void>(
                opaque: false,
                pageBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          );
          await tester.pumpAndSettle();
        }
        if (active) {
          tester
              .widget<TextButton>(find.widgetWithText(TextButton, 'Open'))
              .onPressed!();
        } else {
          await tester.tap(find.text('Open'));
        }
        await tester.pumpAndSettle();
        expect(destinations, path == '/home' && !active ? 1 : 0);
        expect(router.routeInformationProvider.value.uri.path, path);
        await tester.pumpWidget(const SizedBox.shrink());
        router.dispose();
      },
    );
  }
}

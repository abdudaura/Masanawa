import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/screens/activity/activity_screen.dart';
import 'package:masanawa/src/state/talk_activity_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

SessionState signedIn(String id) {
  final user = AuthUser(
    id: id, name: 'Activity viewer', locale: 'en-NG',
    status: 'ACTIVE', role: 'CITIZEN', isNewUser: false,
    createdAt: '2026-10-09T00:00:00Z',
  );
  return SessionSignedIn(
    user,
    AuthTokens(
      accessToken: 'fixture',
      refreshToken: 'fixture',
      accessExpiresIn: 900,
      user: user,
    ),
  );
}

class _RecoverySession extends SessionController {
  @override
  SessionState build() => signedIn('user-a');

  void switchTo(String id) => state = signedIn(id);
  void signOut() => state = const SessionSignedOut();
}

class _RecoveryTransport implements TalkActivityTransport {
  bool unread = true;
  bool failMarkRead = false;
  int markReadCalls = 0;
  Completer<void>? markReadGate;

  @override
  Future<void> markRead({required String activityId}) async {
    markReadCalls += 1;
    if (markReadGate != null) await markReadGate!.future;
    if (failMarkRead) throw StateError('PRIVATE_MARK_READ_FAILURE');
    unread = false;
  }

  bool failLoad = false;
  bool failDecision = false;
  bool failReadbackAfterDecision = false;
  String currentTitle = 'A Talk invitation';
  Completer<void>? decisionGate;
  Completer<void>? firstLoadGate;
  int loadCalls = 0;
  int decisionCalls = 0;

  @override
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) async {
    loadCalls += 1;
    final capturedTitle = currentTitle;
    final gate = firstLoadGate;
    firstLoadGate = null;
    if (gate != null) await gate.future;
    if (failLoad) throw StateError('SECRET_TRANSPORT_DIAGNOSTIC');
    return [
      TalkActivityItem(
        id: 'invitation-1',
        kind: TalkActivityKind.talkInvitation,
        title: capturedTitle,
        detail: 'Invitation details',
        createdAt: DateTime(2026, 10, 9),
        talkId: 'talk-123',
        requiresAction: decisionCalls == 0 || failDecision,
        unread: unread,
      ),
    ];
  }

  @override
  Future<void> respondToInvitation({
    required String talkId,
    required bool accept,
  }) async {
    decisionCalls += 1;
    if (decisionGate != null) await decisionGate!.future;
    if (failDecision) throw StateError('SECRET_SUBMIT_DIAGNOSTIC');
    if (failReadbackAfterDecision) failLoad = true;
  }
}

Widget _app(_RecoveryTransport transport) => ProviderScope(
  overrides: [
    sessionProvider.overrideWith(_RecoverySession.new),
    talkActivityTransportProvider.overrideWithValue(transport),
  ],
  child: MaterialApp(
    theme: buildMasanawaTheme(brightness: Brightness.light),
    home: const ActivityScreen(),
  ),
);

void main() {
  testWidgets('retry control recovers an offline Activity list without leaking diagnostics',
      (tester) async {
    final transport = _RecoveryTransport()..failLoad = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    expect(find.text('Couldn’t refresh Activity.'), findsOneWidget);
    expect(find.byKey(const ValueKey('activity-retry')), findsOneWidget);
    expect(find.textContaining('SECRET_TRANSPORT_DIAGNOSTIC'), findsNothing);

    transport.failLoad = false;
    await tester.tap(find.byKey(const ValueKey('activity-retry')));
    await tester.pumpAndSettle();

    expect(find.text('A Talk invitation'), findsOneWidget);
    expect(find.byKey(const ValueKey('activity-retry')), findsNothing);
    expect(transport.loadCalls, greaterThanOrEqualTo(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('accepted invitation remains truthful if following readback fails',
      (tester) async {
    final transport = _RecoveryTransport()
      ..failReadbackAfterDecision = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('activity-invite-accept-invitation-1')),
    );
    await tester.pumpAndSettle();

    expect(transport.decisionCalls, 1);
    expect(find.text('Invitation accepted.'), findsOneWidget);
    expect(find.text('Couldn’t update this invitation.'), findsNothing);
    expect(find.text('Couldn’t refresh Activity.'), findsOneWidget);
    expect(find.byKey(const ValueKey('activity-retry')), findsOneWidget);
    expect(tester.takeException(), isNull);

    transport.failLoad = false;
    await tester.tap(find.byKey(const ValueKey('activity-retry')));
    await tester.pumpAndSettle();
    expect(find.text('A Talk invitation'), findsOneWidget);
  });

  testWidgets('uncertain submit never claims rejection or success',
      (tester) async {
    final transport = _RecoveryTransport()..failDecision = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('activity-invite-decline-invitation-1')),
    );
    await tester.pumpAndSettle();

    expect(transport.decisionCalls, 1);
    expect(
      find.text(
        'Could not confirm the response. Refresh Activity before trying again.',
      ),
      findsOneWidget,
    );
    expect(find.text('Invitation declined.'), findsNothing);
    expect(find.textContaining('SECRET_SUBMIT_DIAGNOSTIC'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('uncertain invitation cannot be sent again until a successful refresh',
      (tester) async {
    final transport = _RecoveryTransport()..failDecision = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    const acceptKey = ValueKey('activity-invite-accept-invitation-1');
    const refreshKey = ValueKey('activity-invite-refresh-invitation-1');
    await tester.tap(find.byKey(acceptKey));
    await tester.pumpAndSettle();

    expect(transport.decisionCalls, 1);
    expect(tester.widget<FilledButton>(find.byKey(acceptKey)).onPressed, isNull);
    expect(find.byKey(refreshKey), findsOneWidget);
    // Even an unrelated list error cannot accidentally authorize resubmission.
    transport.failLoad = true;
    await tester.tap(find.byKey(refreshKey));
    await tester.pumpAndSettle();
    expect(transport.decisionCalls, 1);
    expect(find.text('Couldn’t refresh Activity.'), findsOneWidget);

    transport.failLoad = false;
    await tester.tap(find.byKey(const ValueKey('activity-retry')));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.byKey(acceptKey)).onPressed, isNotNull);
    expect(find.byKey(refreshKey), findsNothing);
    // A read-only refresh must never resubmit the original decision.
    expect(transport.decisionCalls, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('uncertain invitation fence is cleared across account switch',
      (tester) async {
    final transport = _RecoveryTransport()..failDecision = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    const acceptKey = ValueKey('activity-invite-accept-invitation-1');
    await tester.tap(find.byKey(acceptKey));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.byKey(acceptKey)).onPressed, isNull);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ActivityScreen)),
    );
    transport.currentTitle = 'Activity for B';
    (container.read(sessionProvider.notifier) as _RecoverySession)
        .switchTo('user-b');
    await tester.pumpAndSettle();

    expect(find.text('Activity for B'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byKey(acceptKey)).onPressed, isNotNull);
    expect(transport.decisionCalls, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account switch replaces cached Activity with new principal data',
      (tester) async {
    final transport = _RecoveryTransport()
      ..currentTitle = 'Private activity for A';
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    expect(find.text('Private activity for A'), findsOneWidget);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ActivityScreen)),
    );
    transport.currentTitle = 'Private activity for B';
    (container.read(sessionProvider.notifier) as _RecoverySession)
        .switchTo('user-b');
    await tester.pumpAndSettle();

    expect(find.text('Private activity for B'), findsOneWidget);
    expect(find.text('Private activity for A'), findsNothing);
    expect(transport.loadCalls, greaterThanOrEqualTo(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('old-account invitation completion never appears under new user',
      (tester) async {
    final transport = _RecoveryTransport()
      ..decisionGate = Completer<void>()
      ..currentTitle = 'Private activity for A';
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ActivityScreen)),
    );
    await tester.tap(
      find.byKey(const ValueKey('activity-invite-accept-invitation-1')),
    );
    await tester.pump();
    transport.currentTitle = 'Private activity for B';
    (container.read(sessionProvider.notifier) as _RecoverySession)
        .switchTo('user-b');
    await tester.pump();
    transport.decisionGate!.complete();
    await tester.pumpAndSettle();

    expect(find.text('Private activity for B'), findsOneWidget);
    expect(find.text('Private activity for A'), findsNothing);
    expect(find.text('Invitation accepted.'), findsNothing);
    expect(transport.decisionCalls, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mark read writes to server then hides unread action after refetch',
      (tester) async {
    final transport = _RecoveryTransport();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('activity-mark-read-invitation-1')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('activity-mark-read-invitation-1')));
    await tester.pumpAndSettle();

    expect(transport.markReadCalls, 1);
    expect(transport.unread, isFalse);
    expect(find.byKey(const ValueKey('activity-mark-read-invitation-1')), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed mark-read preserves unread state and offers a retry',
      (tester) async {
    final transport = _RecoveryTransport()..failMarkRead = true;
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('activity-mark-read-invitation-1')));
    await tester.pumpAndSettle();

    expect(transport.markReadCalls, 1);
    expect(transport.unread, isTrue);
    expect(find.byKey(const ValueKey('activity-mark-read-invitation-1')), findsOneWidget);
    expect(find.text('Could not mark as read. Try again.'), findsOneWidget);
    expect(find.textContaining('PRIVATE_MARK_READ_FAILURE'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('signed-out Activity never fetches or displays private results',
      (tester) async {
    final transport = _RecoveryTransport();
    await tester.pumpWidget(_app(transport));
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ActivityScreen)),
    );
    (container.read(sessionProvider.notifier) as _RecoverySession).signOut();
    await tester.pumpAndSettle();

    expect(find.text('Sign in to view Activity.'), findsOneWidget);
    expect(find.text('A Talk invitation'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('late prior-account HTTP list cannot overwrite newer account',
      (tester) async {
    final initialRead = Completer<void>();
    final transport = _RecoveryTransport()
      ..firstLoadGate = initialRead
      ..currentTitle = 'Delayed private activity for A';
    await tester.pumpWidget(_app(transport));
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ActivityScreen)),
    );
    transport.currentTitle = 'Private activity for B';
    (container.read(sessionProvider.notifier) as _RecoverySession)
        .switchTo('user-b');
    await tester.pump();
    initialRead.complete();
    await tester.pumpAndSettle();

    expect(find.text('Private activity for B'), findsOneWidget);
    expect(find.text('Delayed private activity for A'), findsNothing);
    expect(transport.loadCalls, greaterThanOrEqualTo(2));
    expect(tester.takeException(), isNull);
  });

}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/profile/persona_report_sheet.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/talk_safety_state.dart';
import 'package:masanawa/src/talks/talk_safety.dart';

const user = AuthUser(
  id: 'user-1', name: 'Reporter', email: 'reporter@example.test',
  locale: 'en', status: 'ACTIVE', role: 'USER', isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const tokens = AuthTokens(
  accessToken: 'token', refreshToken: 'refresh',
  accessExpiresIn: 900, user: user,
);

class SignedIn extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(user, tokens);
  void signOut() => state = const SessionSignedOut();
}
class SignedOut extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

class Reports implements TalkSafetyTransport {
  int count = 0;
  bool failOnce = false;
  final ids = <String?>[];
  final targets = <String>[];
  @override
  Future<void> reportTarget({
    required TalkSafetyTargetKind targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
    String? clientRequestId,
  }) async {
    expect(targetKind, TalkSafetyTargetKind.persona);
    expect(reason, TalkSafetyReportReason.harassment);
    count++;
    ids.add(clientRequestId);
    targets.add(targetId);
    if (failOnce) {
      failOnce = false;
      throw StateError('Lost acknowledgement');
    }
  }
  @override
  Future<void> reportTalk({
    required String talkId, required bool isReplay,
    required TalkSafetyReportReason reason, String? detail,
  }) => throw UnimplementedError();
  @override
  Future<TalkSafetyPreference> loadUserPreference(String userId) =>
      throw UnimplementedError();
  @override
  Future<TalkSafetyPreference> setUserPreference({
    required String userId, required bool blocked, required bool muted,
  }) => throw UnimplementedError();
}

Widget app(Reports reports, {bool signedIn = true}) => ProviderScope(
  overrides: [
    talkSafetyTransportProvider.overrideWithValue(reports),
    sessionProvider.overrideWith(signedIn ? SignedIn.new : SignedOut.new),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: Builder(builder: (context) => TextButton(
        onPressed: () => showPersonaReportSheet(
          context, publicId: 'persona-public-1', displayName: 'Gwani',
        ),
        child: const Text('Report'),
      )),
    ),
  ),
);

void main() {
  testWidgets('failed receipt retries once with same request ID', (tester) async {
    final reports = Reports()..failOnce = true;
    await tester.pumpWidget(app(reports));
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('persona-reason-harassment')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('persona-report-submit')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('persona-report-error')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('persona-report-submit')));
    await tester.pumpAndSettle();
    expect(reports.count, 2);
    expect(reports.ids.first, reports.ids.last);
    expect(reports.targets, ['persona-public-1', 'persona-public-1']);
    expect(find.byKey(const ValueKey('persona-report-confirmed')),
        findsOneWidget);
  });

  testWidgets('signed-out visitor cannot send reports', (tester) async {
    final reports = Reports();
    await tester.pumpWidget(app(reports, signedIn: false));
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to report this AI persona.'), findsOneWidget);
    expect(tester.widget<FilledButton>(
      find.byKey(const ValueKey('persona-report-submit')),
    ).onPressed, isNull);
    expect(reports.count, 0);
  });

  testWidgets('account changes prevent later sends', (tester) async {
    final reports = Reports();
    await tester.pumpWidget(app(reports));
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('persona-reason-harassment')));
    await tester.pumpAndSettle();
    final context = tester.element(find.byKey(
      const ValueKey('persona-report-submit'),
    ));
    (ProviderScope.containerOf(context).read(sessionProvider.notifier)
        as SignedIn).signOut();
    await tester.pumpAndSettle();
    expect(reports.count, 0);
    expect(find.text('Sign in to report this AI persona.'), findsOneWidget);
  });
}

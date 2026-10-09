import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/messages/human_contacts_controller.dart';
import 'package:masanawa/src/messages/human_contacts_screen.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';
import 'package:masanawa/src/state/session_state.dart';

const _user = AuthUser(
  id: 'user_a',
  name: 'Amina',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'session-a',
  refreshToken: 'refresh-a',
  accessExpiresIn: 900,
  user: _user,
);

class _TestSessionController extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);

  void signOutForTest() => state = const SessionSignedOut();
}

class _ContactApi implements HumanContactsTransport {
  int requests = 0;
  bool fail = false;
  bool wasRevoked = false;
  bool listRevoked = false;
  HumanContactPreferences prefs = const HumanContactPreferences(
    policy: HumanContactPolicy.requests,
    discoverableByHandle: true,
  );

  @override
  Future<HumanContactPreferences> preferences() async => prefs;

  @override
  Future<List<HumanContact>> list({int limit = 30}) async =>
      listRevoked
          ? const [
              HumanContact(
                userId: 'user_b', handle: 'bob', displayName: 'Bob',
                avatarUrl: null, status: HumanContactStatus.revoked,
                canMessage: false, requestRevision: '1',
                updatedAt: null,
              ),
            ]
          : const [];

  @override
  Future<HumanContact?> lookup(String handle) async {
    if (handle != 'bob') return null;
    return HumanContact(
      userId: 'user_b', handle: 'bob', displayName: 'Bob',
      avatarUrl: null,
      status: wasRevoked ? HumanContactStatus.revoked : HumanContactStatus.none,
      canMessage: false,
    );
  }

  @override
  Future<String> request(String handle) async {
    requests++;
    if (fail) throw const FormatException('Contact unavailable');
    return 'pending';
  }

  @override
  Future<String> respond(String userId, {required bool accept, required String requestRevision}) async =>
      accept ? 'accepted' : 'declined';

  @override
  Future<void> revoke(String otherUserId) async {}

  @override
  Future<HumanContactPreferences> updatePreferences({
    HumanContactPolicy? policy,
    bool? discoverableByHandle,
  }) async {
    prefs = HumanContactPreferences(
      policy: policy ?? prefs.policy,
      discoverableByHandle:
          discoverableByHandle ?? prefs.discoverableByHandle,
    );
    return prefs;
  }
}

void main() {
  testWidgets('exact handle search and request use C01 server response',
      (tester) async {
    final api = _ContactApi();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_TestSessionController.new),
        humanContactsTransportProvider.overrideWithValue(api),
      ],
      child: const MaterialApp(home: HumanContactsScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('No contact requests yet'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'bob');
    await tester.tap(find.text('Find'));
    await tester.pumpAndSettle();
    expect(find.text('Bob'), findsOneWidget);
    expect(find.text('Request contact'), findsOneWidget);
    await tester.tap(find.text('Request contact'));
    await tester.pumpAndSettle();
    expect(api.requests, 1);
    expect(find.text('Contact request sent.'), findsOneWidget);
    expect(find.text('Request contact'), findsNothing);
  });

  testWidgets('revoked contact reconnect sends a new real request',
      (tester) async {
    final api = _ContactApi()..wasRevoked = true;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_TestSessionController.new),
        humanContactsTransportProvider.overrideWithValue(api),
      ],
      child: const MaterialApp(home: HumanContactsScreen()),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'bob');
    await tester.tap(find.text('Find'));
    await tester.pumpAndSettle();
    expect(find.textContaining('You removed this connection'), findsOneWidget);
    expect(find.text('Request reconnect'), findsOneWidget);
    await tester.tap(find.text('Request reconnect'));
    await tester.pumpAndSettle();
    expect(api.requests, 1);
    expect(find.text('Contact request sent.'), findsOneWidget);
  });

  testWidgets('revoked contact remains recoverable in server list after restart',
      (tester) async {
    final api = _ContactApi()..listRevoked = true;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_TestSessionController.new),
        humanContactsTransportProvider.overrideWithValue(api),
      ],
      child: const MaterialApp(home: HumanContactsScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Request reconnect'), findsOneWidget);
    await tester.tap(find.text('Request reconnect'));
    await tester.pumpAndSettle();
    expect(api.requests, 1);
    expect(find.text('Contact request sent.'), findsOneWidget);
  });

  testWidgets('request denial surfaces error, not false sent confirmation',
      (tester) async {
    final api = _ContactApi()..fail = true;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_TestSessionController.new),
        humanContactsTransportProvider.overrideWithValue(api),
      ],
      child: const MaterialApp(home: HumanContactsScreen()),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'bob');
    await tester.tap(find.text('Find'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Request contact'));
    await tester.pumpAndSettle();
    expect(find.text('Contact unavailable'), findsOneWidget);
    expect(find.text('Contact request sent.'), findsNothing);
  });

  testWidgets('sign-out hides all user-specific contact UI', (tester) async {
    final api = _ContactApi();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_TestSessionController.new),
        humanContactsTransportProvider.overrideWithValue(api),
      ],
      child: const MaterialApp(home: HumanContactsScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Your privacy'), findsOneWidget);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(HumanContactsScreen)),
    );
    (container.read(sessionProvider.notifier) as _TestSessionController)
        .signOutForTest();
    await tester.pumpAndSettle();
    expect(find.text('Sign in to manage private contacts.'), findsOneWidget);
    expect(find.text('Your privacy'), findsNothing);
    expect(find.text('Find'), findsNothing);
  });
}


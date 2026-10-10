
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/customer_support/models.dart';
import 'package:masanawa/src/customer_support/support_screen.dart';
import 'package:masanawa/src/customer_support/transport.dart';
import 'package:masanawa/src/state/session_state.dart';

AuthUser user(String id) => AuthUser(
  id: id, name: id, locale: 'en-NG', status: 'ACTIVE', role: 'CITIZEN',
  isNewUser: false, createdAt: '2026-10-08T12:00:00Z',
);
SessionSignedIn signed(String id) {
  final account = user(id);
  return SessionSignedIn(account, AuthTokens(
    accessToken: 'test', refreshToken: 'test', accessExpiresIn: 900, user: account,
  ));
}

class FakeSession extends SessionController {
  FakeSession(this.initial);
  final SessionState initial;
  @override
  SessionState build() => initial;
  void set(SessionState value) => state = value;
}

CustomerSupportTicket ticket(String id) => CustomerSupportTicket(
  id: id, kind: 'general', referenceMask: null, operationPhase: null,
  summary: 'Please explain the issue with my account.', status: 'queued',
  resolution: null, createdAt: DateTime.utc(2026, 10, 8),
);

class FakeTransport implements CustomerSupportTransport {
  int ticketReads = 0;
  int statusReads = 0;
  int writes = 0;
  Completer<List<CustomerSupportTicket>>? delayed;
  List<CustomerSupportTicket> result = [];
  bool failOnce = false;
  final List<String> requestKeys = [];
  @override
  Future<List<CustomerSupportTicket>> tickets() {
    ticketReads++;
    return delayed?.future ?? Future.value(result);
  }
  @override
  Future<SupportOperationStatus> operationStatus(
      SupportOperationKind kind, String reference) async {
    statusReads++;
    return SupportOperationStatus(
      kind: kind, referenceMask: '••••1234', phase: 'pending',
      observedAt: DateTime.utc(2026,10,8),
      message: 'Not confirmed. Do not repeat the payment.',
    );
  }
  @override
  Future<CustomerSupportTicket> submit({
    required String requestKey, required String kind,
    String? reference, required String summary,
    required bool shareWithSupport,
  }) async {
    writes++;
    requestKeys.add(requestKey);
    if (!shareWithSupport) throw StateError('Consent must be explicit');
    if (failOnce) {
      failOnce = false;
      throw StateError('Ambiguous transport response');
    }
    return ticket('123e4567-e89b-42d3-a456-426614174000');
  }
}

Future<void> launch(WidgetTester tester, FakeSession session,
    FakeTransport transport, {SupportOperationKind? kind, String? reference}) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [sessionProvider.overrideWith(() => session)],
    child: MaterialApp(home: CustomerSupportScreen(
      transport: transport, operationKind: kind, operationReference: reference,
    )),
  ));
  await tester.pump();
}

void main() {
  testWidgets('signed-out, restoring and OTP users never request or see tickets',
      (tester) async {
    final session=FakeSession(const SessionSignedOut());
    final transport=FakeTransport()..result=[ticket('ticket-for-A')];
    await launch(tester,session,transport);
    expect(find.textContaining('Sign in to view'), findsOneWidget);
    expect(transport.ticketReads,0);
    expect(find.textContaining('ticket-for-A'), findsNothing);
  });

  testWidgets('account switch fences delayed A response and reloads B only',
      (tester) async {
    final first=Completer<List<CustomerSupportTicket>>();
    final session=FakeSession(signed('A'));
    final transport=FakeTransport()..delayed=first;
    await launch(tester,session,transport);
    expect(transport.ticketReads,1);
    transport.delayed=null;
    transport.result=[ticket('ticket-for-B')];
    session.set(signed('B'));
    await tester.pump();
    await tester.pump();
    first.complete([ticket('ticket-for-A')]);
    await tester.pump();
    expect(find.byKey(const Key('support-ticket-ticket-for-A')),findsNothing);
    expect(find.byKey(const Key('support-ticket-ticket-for-B')),findsOneWidget);
  });

  testWidgets('pending status shows warning; consent required before write',
      (tester) async {
    final session=FakeSession(signed('A'));
    final transport=FakeTransport();
    await launch(tester,session,transport,
        kind:SupportOperationKind.billingQuote,
        reference:'bill_quote_SENSITIVE_1234');
    await tester.pump();
    expect(find.textContaining('Not confirmed'), findsWidgets);
    expect(transport.statusReads,1);
    await tester.enterText(find.byKey(const Key('support-summary')),
      'My electricity token has not appeared after the payment.');
    await tester.ensureVisible(find.byKey(const Key('support-submit')));
    await tester.tap(find.byKey(const Key('support-submit')));
    await tester.pump();
    expect(transport.writes,0);
    await tester.ensureVisible(find.byKey(const Key('support-consent')));
    await tester.tap(find.byKey(const Key('support-consent')));
    await tester.ensureVisible(find.byKey(const Key('support-submit')));
    await tester.tap(find.byKey(const Key('support-submit')));
    await tester.pump();
    expect(transport.writes,1);
    expect(find.byKey(const Key('support-ticket-123e4567-e89b-42d3-a456-426614174000')),
      findsOneWidget);
  });

  testWidgets('ambiguous timeout retries same idempotency key',
      (tester) async {
    final session=FakeSession(signed('A'));
    final transport=FakeTransport()..failOnce=true;
    await launch(tester,session,transport);
    await tester.pump();
    await tester.enterText(find.byKey(const Key('support-summary')),
      'An unexpected account issue needs a person to review it.');
    await tester.ensureVisible(find.byKey(const Key('support-consent')));
    await tester.tap(find.byKey(const Key('support-consent')));
    await tester.ensureVisible(find.byKey(const Key('support-submit')));
    await tester.tap(find.byKey(const Key('support-submit')));
    await tester.pump();
    expect(transport.writes,1);
    await tester.tap(find.byKey(const Key('support-submit')));
    await tester.pump();
    expect(transport.writes,2);
    expect(transport.requestKeys[0],transport.requestKeys[1]);
  });
}

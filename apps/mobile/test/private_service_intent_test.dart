import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/services/private_service_intent.dart';
import 'package:masanawa/src/screens/chat/private_service_intent_prompt.dart';

void main() {
  test('R17 accepts only canonical Billing codes, not guessed categories', () {
    const codes = ['data', 'airtime', 'electricity', 'tv'];
    for (final code in codes) {
      expect(PrivateServiceIntent.fromBillingCode(code), isNotNull);
      expect(PrivateServiceIntent.fromBillingCode('  ${code.toUpperCase()} '),
          PrivateServiceIntent.fromBillingCode(code));
    }
    for (final unknown in ['', 'dat', 'data:buy', 'crypto', 'bill',
      'internet', 'tv-express', 'other', '../data']) {
      expect(PrivateServiceIntent.fromBillingCode(unknown), isNull);
    }
  });

  test('R17 forwards exact service identity and no made-up payment terms', () {
    expect(PrivateServiceIntent.values.length, 5);
    expect(PrivateServiceIntent.crypto.editorLocation, '/crypto');
    expect(PrivateServiceIntent.data.editorLocation, '/billing?service=data');
    expect(PrivateServiceIntent.airtime.editorLocation,
        '/billing?service=airtime');
    expect(PrivateServiceIntent.electricity.editorLocation,
        '/billing?service=electricity');
    expect(PrivateServiceIntent.tv.editorLocation, '/billing?service=tv');
    for (final intent in PrivateServiceIntent.values) {
      expect(intent.helpRequest, contains('explicit confirmation'));
      expect(intent.helpRequest, contains('quote'));
      expect(intent.displayName.trim(), isNotEmpty);
      expect(intent.helpRequest, isNot(contains('₦')));
      expect(intent.helpRequest, isNot(contains('USDT')));
    }
  });

  test('R17 request identity is scoped to signed-in user and revision', () {
    const first = PendingPrivateServiceIntent(
      intent: PrivateServiceIntent.data, ownerUserId: 'user-a', revision: 1);
    const second = PendingPrivateServiceIntent(
      intent: PrivateServiceIntent.data, ownerUserId: 'user-a', revision: 2);
    expect(first.belongsTo('user-a'), isTrue);
    expect(first.belongsTo('user-b'), isFalse);
    expect(second.revision, isNot(first.revision));
  });

  testWidgets('R17 service selection never auto-sends or starts microphone',
      (tester) async {
    var requests = 0;
    var editors = 0;
    var dismissals = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PrivateServiceIntentPrompt(
          intent: PrivateServiceIntent.data,
          onContinue: () async { requests++; },
          onOpenEditor: () { editors++; },
          onDismiss: () { dismissals++; },
        ),
      ),
    ));
    expect(requests, 0);
    expect(editors, 0);
    expect(find.text('Data bundles · Private'), findsOneWidget);
    expect(find.text('Continue in Talk'), findsOneWidget);
    expect(find.byIcon(Icons.mic), findsNothing);
    await tester.tap(find.text('Use service form'));
    expect(editors, 1);
    expect(requests, 0);
    await tester.tap(find.byTooltip('Dismiss service request'));
    expect(dismissals, 1);
    expect(requests, 0);
    await tester.tap(find.text('Continue in Talk'));
    await tester.pump();
    expect(requests, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('R17 same request cannot submit twice while in flight',
      (tester) async {
    final pending = Completer<void>();
    var requests = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PrivateServiceIntentPrompt(
          intent: PrivateServiceIntent.crypto,
          onContinue: () { requests++; return pending.future; },
          onOpenEditor: () {},
          onDismiss: () {},
        ),
      ),
    ));
    await tester.tap(find.text('Continue in Talk'));
    await tester.pump();
    expect(requests, 1);
    expect(tester.widget<FilledButton>(
      find.byType(FilledButton)).onPressed, isNull);
    pending.complete();
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('R17 failed send offers recovery, not false success',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PrivateServiceIntentPrompt(
          intent: PrivateServiceIntent.airtime,
          onContinue: () async {
            calls++;
            if (calls == 1) throw StateError('private network error');
          },
          onOpenEditor: () {},
          onDismiss: () {},
        ),
      ),
    ));
    await tester.tap(find.text('Continue in Talk'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Could not start this request'), findsOneWidget);
    expect(calls, 1);
    await tester.tap(find.text('Continue in Talk'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.textContaining('Could not start this request'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

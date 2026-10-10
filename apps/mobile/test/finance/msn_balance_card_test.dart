import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/finance/msn_balance_card.dart';
import 'package:masanawa/src/finance/msn_balance_transport.dart';

class _QueueTransport implements MsnBalanceTransport {
  _QueueTransport(this.responses);
  final List<Future<MsnBalance>> responses;
  int calls = 0;

  @override
  Future<MsnBalance> read() => responses[calls++];
}

MsnBalance _balance(String amount) =>
    MsnBalance.fromJson({'asset': 'MSN', 'spendableMicro': amount});

Widget _screen(MsnBalanceTransport transport, String? session) => MaterialApp(
  home: Scaffold(
    body: ListView(children: [
      MsnBalanceCard(transport: transport, sessionIdentity: session),
    ]),
  ),
);

void main() {
  testWidgets('server readback displays exact amount and a usable refresh',
      (tester) async {
    final t = _QueueTransport([
      Future.value(_balance('1250000')),
      Future.value(_balance('2500001')),
    ]);
    await tester.pumpWidget(_screen(t, 'account-session-A'));
    await tester.pumpAndSettle();
    expect(find.text('1.25 MSN'), findsOneWidget);
    expect(find.textContaining('NGN deposits are funding'), findsOneWidget);

    await tester.tap(find.byTooltip('Refresh MSN balance'));
    await tester.pumpAndSettle();
    expect(find.text('2.500001 MSN'), findsOneWidget);
    expect(t.calls, 2);
  });

  testWidgets('switching accounts discards a late former-user response',
      (tester) async {
    final original = Completer<MsnBalance>();
    final next = Completer<MsnBalance>();
    final transport = _QueueTransport([original.future, next.future]);
    await tester.pumpWidget(_screen(transport, 'session-A'));
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    await tester.pumpWidget(_screen(transport, 'session-B'));
    original.complete(_balance('91000000'));
    await tester.pump();
    expect(find.text('91 MSN'), findsNothing);
    next.complete(_balance('1000000'));
    await tester.pumpAndSettle();
    expect(find.text('1 MSN'), findsOneWidget);
    expect(find.text('91 MSN'), findsNothing);
  });

  testWidgets('sign-out immediately clears previously visible money',
      (tester) async {
    final transport = _QueueTransport([Future.value(_balance('10000000'))]);
    await tester.pumpWidget(_screen(transport, 'session-A'));
    await tester.pumpAndSettle();
    expect(find.text('10 MSN'), findsOneWidget);

    await tester.pumpWidget(_screen(transport, null));
    await tester.pump();
    expect(find.text('10 MSN'), findsNothing);
    expect(find.text('Sign in to view your MSN balance.'), findsOneWidget);
    expect(transport.calls, 1);
  });

  testWidgets('route disabled never displays a synthetic zero',
      (tester) async {
    final transport = _QueueTransport([
      Future<MsnBalance>.error(
          const ApiException('not mounted', statusCode: 404)),
    ]);
    await tester.pumpWidget(_screen(transport, 'session-A'));
    await tester.pumpAndSettle();
    expect(find.text('MSN balance is not available yet.'), findsOneWidget);
    expect(find.text('0 MSN'), findsNothing);
  });
}

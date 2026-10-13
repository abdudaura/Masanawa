import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/finance/msn_funding_card.dart';
import 'package:masanawa/src/finance/msn_funding_transport.dart';

class _QueueFunding implements MsnFundingTransport {
  _QueueFunding(this.responses);
  final List<Future<List<MsnFundingOperation>>> responses;
  int calls=0;
  @override
  Future<List<MsnFundingOperation>> read()=>responses[calls++];
}
MsnFundingOperation _operation({String state='fiat_verified_backing_pending'}) =>
    MsnFundingOperation.fromJson({
      'quoteId':'quote-1','fundingReference':'fund-1',
      'fundingRail':'NGN_FLUTTERWAVE','ngnFundingKobo':'15025',
      'backingAsset':'USDTTRC20','backingNetwork':'tron',
      'state':state,
      'issuedMsnMicro':state=='backed_issued'?'2500000':null,
    });
Widget _screen(MsnFundingTransport transport,String? account)=>MaterialApp(
  home:Scaffold(body:ListView(children:[
    MsnFundingCard(transport:transport,sessionIdentity:account),
  ])),
);
void main(){
  testWidgets('honestly distinguishes verified payment awaiting backing',
      (tester) async {
    final t=_QueueFunding([
      Future.value([_operation()]),
      Future.value([_operation(state:'backed_issued')]),
    ]);
    await tester.pumpWidget(_screen(t,'fan-A'));
    await tester.pumpAndSettle();
    expect(find.text('Payment verified · backing pending'),findsOneWidget);
    expect(find.textContaining('2.5 MSN'),findsNothing);
    expect(find.textContaining('Verified fiat payments are not MSN'),findsOneWidget);
    await tester.tap(find.byTooltip('Refresh MSN funding'));
    await tester.pumpAndSettle();
    expect(find.textContaining('2.5 MSN issued'),findsOneWidget);
    expect(t.calls,2);
  });

  testWidgets('switching fan account discards late old-identity funding records',
      (tester) async{
    final first=Completer<List<MsnFundingOperation>>();
    final second=Completer<List<MsnFundingOperation>>();
    final t=_QueueFunding([first.future,second.future]);
    await tester.pumpWidget(_screen(t,'fan-A'));
    await tester.pumpWidget(_screen(t,'fan-B'));
    first.complete([_operation(state:'backed_issued')]);
    await tester.pump();
    expect(find.textContaining('2.5 MSN issued'),findsNothing);
    second.complete([]);
    await tester.pumpAndSettle();
    expect(find.text('No MSN funding operations yet.'),findsOneWidget);
  });

  testWidgets('sign-out removes private verified funding immediately',
      (tester) async{
    final t=_QueueFunding([Future.value([_operation()])]);
    await tester.pumpWidget(_screen(t,'fan-A'));
    await tester.pumpAndSettle();
    expect(find.text('Payment verified · backing pending'),findsOneWidget);
    await tester.pumpWidget(_screen(t,null));
    await tester.pump();
    expect(find.text('Payment verified · backing pending'),findsNothing);
    expect(find.text('Sign in to view your MSN funding.'),findsOneWidget);
  });

  testWidgets('missing staging/API returns unavailable, never fabricated empty',
      (tester) async{
    final t=_QueueFunding([
      Future<List<MsnFundingOperation>>.delayed(Duration.zero,
        ()=>throw const ApiException('not mounted',statusCode:404)),
    ]);
    await tester.pumpWidget(_screen(t,'fan-A'));
    await tester.pumpAndSettle();
    expect(find.text('MSN funding is not available yet.'),findsOneWidget);
    expect(find.text('No MSN funding operations yet.'),findsNothing);
  });
}

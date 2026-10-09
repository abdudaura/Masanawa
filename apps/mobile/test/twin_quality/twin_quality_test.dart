import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/twin_quality/twin_quality.dart';
import 'package:masanawa/src/twin_quality/twin_quality_screen.dart';

final good = <String,dynamic>{
  'schemaVersion':1,'qualification':'ledger-balances-with-sampled-activity',
  'hasTwin':true,'characterId':'character_ok',
  'earnings':{'source':'commerce-ledger','pendingCredits':3,'availableCredits':8,'payoutGuaranteed':false},
  'float':{'remainingCredits':10,'exhausted':false,'taskQuotaRemaining':null,'providerCostCredits':null},
  'evidence':{'characterId':'character_ok','sampledEvents':0,'sampledLimit':50,'completed':0,'unsuccessful':0,'totalResultsKnown':false},
  'recent':<dynamic>[],
};
class MockTransport implements TwinQualityTransport {
  MockTransport(this.future);
  final Future<TwinQualityReport> future;
  @override
  Future<TwinQualityReport> load()=>future;
}
void main() {
  test('rejects fractional or event-derived earnings',(){
    expect(()=>TwinQualityReport.fromJson({...good,
      'earnings':{...(good['earnings'] as Map),'availableCredits':8.5},
    }),throwsFormatException);
    expect(()=>TwinQualityReport.fromJson({...good,
      'earnings':{...(good['earnings'] as Map),'source':'activity-estimate'},
    }),throwsFormatException);
  });
  testWidgets('late response from prior account cannot reveal earnings',(tester) async {
    final old = Completer<TwinQualityReport>();
    final fresh = Completer<TwinQualityReport>();
    Future<void> display(String epoch, TwinQualityTransport transport) async {
      await tester.pumpWidget(MaterialApp(home:Scaffold(body:TwinQualityOwnerDashboard(
        accountEpoch:epoch,transport:transport,
      ))));
    }
    await display('account1',MockTransport(old.future));
    await display('account2',MockTransport(fresh.future));
    old.complete(TwinQualityReport.fromJson(good));
    await tester.pump();
    expect(find.text('8 Credits'),findsNothing);
    fresh.complete(TwinQualityReport.fromJson({...good,
      'earnings':{...(good['earnings'] as Map),'availableCredits':4},
    }));
    await tester.pumpAndSettle();
    expect(find.text('4 Credits'),findsOneWidget);
    expect(find.text('8 Credits'),findsNothing);
  });
}

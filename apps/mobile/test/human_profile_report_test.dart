import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/profile/human_profile_report_journal.dart';
import 'package:masanawa/src/screens/profile/human_profile_report_sheet.dart';
import 'package:masanawa/src/screens/profile/human_profile_report_transport.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/talks/talk_safety.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

AuthTokens _tokens(String id)=>AuthTokens(
  accessToken:'access-$id',
  refreshToken:'refresh-$id',
  accessExpiresIn:900,
  user:AuthUser(
    id:id,name:'User $id',locale:'en',status:'ACTIVE',role:'customer',
    isNewUser:false,createdAt:'2026-10-08T00:00:00.000Z',
  ),
);

class _SignedIn extends SessionController {
  @override
  SessionState build()=>SessionSignedIn(_tokens('user-a').user,_tokens('user-a'));
  void switchTo(String id){
    state=SessionSignedIn(_tokens(id).user,_tokens(id));
  }
}

class _Transport implements HumanProfileReportTransport {
  bool ambiguousOnce=false;
  final ids=<String>[];
  @override
  Future<String> report(String handle,{
    required TalkSafetyReportReason reason,
    required String requestId,
    required String detail,
    required String reporterUserId,
  }) async {
    expect(reporterUserId,'user-a');
    ids.add(requestId);
    expect(handle,'amina');
    expect(reason,TalkSafetyReportReason.spam);
    if(ambiguousOnce){
      ambiguousOnce=false;
      throw StateError('Response lost after server may have committed');
    }
    return 'report-accepted-123';
  }
}

class _Journal implements HumanProfileReportJournal {
  final data=<String,PendingHumanProfileReport>{};
  String key(String user,String handle)=>'$user:$handle';
  @override
  Future<PendingHumanProfileReport?> read(String userId,String handle) async =>
    data[key(userId,handle)];
  @override
  Future<void> write(
    String userId,String handle,PendingHumanProfileReport report,
  ) async { data[key(userId,handle)]=report; }
  @override
  Future<void> clear(String userId,String handle) async {
    data.remove(key(userId,handle));
  }
}

ProviderContainer _container(_Transport transport,_Journal journal)=>ProviderContainer(
  overrides:[
    sessionProvider.overrideWith(_SignedIn.new),
    humanProfileReportTransportProvider.overrideWithValue(transport),
    humanProfileReportJournalProvider.overrideWithValue(journal),
  ],
);

Future<void> _pump(WidgetTester tester,ProviderContainer container) async {
  await tester.pumpWidget(UncontrolledProviderScope(
    container:container,
    child:MaterialApp(
      theme:buildMasanawaTheme(brightness:Brightness.light),
      home:const Scaffold(body:HumanProfileReportSheet(
        handle:'amina',reporterUserId:'user-a',
      )),
    ),
  ));
  await tester.pumpAndSettle();
}

void main(){
  test('pending report parses stable ID and exact reason; malformed journal fails closed',(){
    final draft=PendingHumanProfileReport(
      requestId:PendingHumanProfileReport.freshId(),
      reason:TalkSafetyReportReason.spam,
      detail:'spam details',
      createdAt:DateTime.now().toUtc().subtract(const Duration(minutes:1)),
    );
    final restored=PendingHumanProfileReport.parse(draft.serialize());
    expect(restored?.requestId,draft.requestId);
    expect(restored?.reason,TalkSafetyReportReason.spam);
    expect(PendingHumanProfileReport.parse('{"reason":"fake"}'),isNull);
  });

  testWidgets('restores a possibly committed report after app restart', (tester) async {
    final transport=_Transport();
    final journal=_Journal();
    final saved=PendingHumanProfileReport(
      requestId:PendingHumanProfileReport.freshId(),
      reason:TalkSafetyReportReason.spam,
      detail:'Saved before a previous network failure',
      createdAt:DateTime.now().toUtc().subtract(const Duration(minutes:1)),
    );
    journal.data['user-a:amina']=saved;
    final container=_container(transport,journal);
    addTearDown(container.dispose);
    await _pump(tester,container);
    expect(find.text('Retry same report'),findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('human-safety-report')));
    await tester.tap(find.byKey(const ValueKey('human-safety-report')));
    await tester.pumpAndSettle();
    expect(transport.ids,[saved.requestId]);
    expect(journal.data,isEmpty);
    expect(find.byKey(const ValueKey('human-safety-accepted')),findsOneWidget);
  });

  testWidgets('ambiguous report retry retains request ID until server acceptance', (tester) async {
    final transport=_Transport()..ambiguousOnce=true;
    final journal=_Journal();
    final container=_container(transport,journal);
    addTearDown(container.dispose);
    await _pump(tester,container);
    await tester.tap(find.byKey(const ValueKey('human-safety-reason')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Spam').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('human-safety-report')));
    await tester.tap(find.byKey(const ValueKey('human-safety-report')));
    await tester.pumpAndSettle();
    expect(transport.ids.length,1);
    expect(journal.data.length,1);
    expect(find.textContaining('Outcome not confirmed'),findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('human-safety-report')));
    await tester.pumpAndSettle();
    expect(transport.ids.length,2);
    expect(transport.ids[1],transport.ids[0]);
    expect(journal.data,isEmpty);
    expect(find.byKey(const ValueKey('human-safety-accepted')),findsOneWidget);
  });

  testWidgets('account switch disables private safety mutation', (tester) async {
    final transport=_Transport();
    final container=_container(transport,_Journal());
    addTearDown(container.dispose);
    await _pump(tester,container);
    (container.read(sessionProvider.notifier) as _SignedIn).switchTo('user-b');
    await tester.pumpAndSettle();
    expect(find.textContaining('Your account changed'),findsOneWidget);
    expect(find.byKey(const ValueKey('human-safety-report')),findsNothing);
  });
}

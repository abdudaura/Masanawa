import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/messages/human_dm_controller.dart';
import 'package:masanawa/src/messages/human_dm_outbox.dart';
import 'package:masanawa/src/messages/human_dm_screen.dart';
import 'package:masanawa/src/messages/human_dm_transport.dart';
import 'package:masanawa/src/state/session_state.dart';

const user=AuthUser(
  id:'user_alice',name:'Alice',locale:'en',status:'ACTIVE',role:'CITIZEN',
  isNewUser:false,createdAt:'2026-10-08T00:00:00Z',
);
const tokens=AuthTokens(
  accessToken:'test-session-token',refreshToken:'test-refresh',
  accessExpiresIn:900,user:user,
);
class _Session extends SessionController {
  @override SessionState build()=>const SessionSignedIn(user,tokens);
}
class _MemoryOutbox implements HumanDmOutbox {
  final rows=<String,List<HumanDmPending>>{};
  String key(String u,String c)=>'$u:$c';
  @override Future<List<HumanDmPending>> load(String u,String c) async=>
      List.of(rows[key(u,c)]??[]);
  @override Future<void> save(String u,String c,List<HumanDmPending> pending) async {
    rows[key(u,c)]=List.of(pending);
  }
  @override Future<void> clear(String u,String c) async {rows.remove(key(u,c));}
}
class _Transport implements HumanDmTransport {
  final delivered=<String,HumanDmMessage>{};
  String? openedFor;
  bool failSend=false;
  @override Future<String> open(String otherUserId) async {
    openedFor=otherUserId;
    return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  }
  @override Future<List<HumanDmThread>> inbox({int limit=40}) async=>[];
  @override Future<HumanDmPage> history(String c,{int limit=40,int? beforeSequence}) async=>
      HumanDmPage(delivered.values.toList(),null);
  @override Future<HumanDmMessage> send(String c,{required String clientMessageId,required String text}) async {
    if(failSend)throw StateError('server unavailable');
    final m=HumanDmMessage(
      conversationId:c,messageId:clientMessageId,sequence:delivered.length+1,
      clientMessageId:clientMessageId,senderUserId:user.id,text:text,
      createdAt:DateTime.utc(2026,10,8,11,0),editedAt:null,deletedAt:null,
    );
    delivered[clientMessageId]=m;
    return m;
  }
  @override Future<int> read(String c,int upToSequence) async=>upToSequence;
  @override Future<HumanDmMessage> edit(String c,String id,String text) async=>
      throw UnimplementedError();
  @override Future<HumanDmMessage> remove(String c,String id) async=>
      throw UnimplementedError();
}
Widget app(_Transport api,Widget screen)=>ProviderScope(overrides:[
  sessionProvider.overrideWith(_Session.new),
  humanDmTransportProvider.overrideWithValue(api),
  humanDmOutboxProvider.overrideWithValue(_MemoryOutbox()),
],child:MaterialApp(home:screen));
void main(){
  testWidgets('human text is shown only after actual server acknowledgement',(tester) async {
    final api=_Transport();
    await tester.pumpWidget(app(api,const HumanDmThreadScreen(
      conversationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',otherDisplayName:'Bob')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField),'Hello Bob');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(find.text('Hello Bob'),findsOneWidget);
    expect(find.text('Not confirmed'),findsNothing);
    expect(api.delivered.length,1);
  });
  testWidgets('server outage leaves retryable pending text, not fake sent',(tester) async {
    final api=_Transport()..failSend=true;
    await tester.pumpWidget(app(api,const HumanDmThreadScreen(
      conversationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',otherDisplayName:'Bob')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField),'Must not appear as sent');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(find.text('Not confirmed'),findsOneWidget);
    expect(find.text('Retry send'),findsOneWidget);
    expect(api.delivered,isEmpty);
  });
  testWidgets('contact action opens only server-authorized conversation',(tester) async {
    final api=_Transport();
    await tester.pumpWidget(app(api,const Scaffold(body:HumanDmOpenContactAction(
      otherUserId:'user_bob',label:'Bob'))));
    await tester.tap(find.text('Message'));
    await tester.pumpAndSettle();
    expect(api.openedFor,'user_bob');
    expect(find.text('Bob'),findsOneWidget);
  });
}


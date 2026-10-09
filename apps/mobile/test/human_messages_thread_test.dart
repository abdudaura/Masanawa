import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_messages/human_dm_controller.dart';
import 'package:masanawa/src/human_messages/human_dm_models.dart';
import 'package:masanawa/src/human_messages/human_dm_screens.dart';
import 'package:masanawa/src/human_messages/human_dm_transport.dart';

class FakeHumanDmTransport implements HumanDmTransport{
  final attempts=<String>[];
  bool failFirst=true;
  final messages=<HumanDmMessage>[];
  @override Future<String> open(String otherUserId) async=>'11111111-1111-4111-8111-111111111111';
  @override Future<List<HumanDmConversation>> inbox({String? before}) async=>[];
  @override Future<HumanDmPage> history(String id,{String? before}) async=>
    HumanDmPage(messages:List.of(messages));
  @override Future<HumanDmMessage> send(String conversationId,String requestId,String body) async{
    attempts.add(requestId);
    if(failFirst){failFirst=false;throw const FormatException('offline');}
    final m=HumanDmMessage(messageId:'22222222-2222-4222-8222-222222222222',
      conversationId:conversationId,sequence:'1',senderUserId:'user_self',
      clientRequestId:requestId,body:body,createdAt:DateTime.utc(2026,10,8),
      editedAt:null,deletedAt:null);
    messages.add(m);return m;
  }
  @override Future<HumanDmMessage> edit(String id,String body) async=>
    throw UnimplementedError();
  @override Future<HumanDmMessage> remove(String id) async=>
    throw UnimplementedError();
  @override Future<String> read(String id,String throughSequence) async=>throughSequence;
}
void main(){
  test('uncertain failure retains same idempotency key across retry',() async{
    final fake=FakeHumanDmTransport(), controller=HumanDmThreadController(
      conversationId:'11111111-1111-4111-8111-111111111111',transport:fake);
    expect(await controller.send(' Hello '),isFalse);
    expect(controller.pendingBody,'Hello');
    expect(controller.pendingRequestId,isNotNull);
    expect(await controller.send('Hello'),isTrue);
    expect(fake.attempts,hasLength(2));
    expect(fake.attempts[0],fake.attempts[1]);
    expect(controller.messages.single.body,'Hello');
    expect(controller.pendingRequestId,isNull);
    controller.dispose();
  });
  testWidgets('human thread shows failed pending send then retry with same request id',(tester) async{
    final fake=FakeHumanDmTransport();
    await tester.pumpWidget(MaterialApp(home:HumanDmThreadScreen(
      conversationId:'11111111-1111-4111-8111-111111111111',
      otherDisplayName:'Bob',currentUserId:'user_self',transport:fake)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last,'Hello Bob');
    await tester.tap(find.byTooltip('Send text message'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Not yet sent:'),findsOneWidget);
    expect(find.text('Retry same message'),findsOneWidget);
    await tester.tap(find.text('Retry same message'));
    await tester.pumpAndSettle();
    expect(fake.attempts,hasLength(2));
    expect(fake.attempts[0],fake.attempts[1]);
    expect(find.text('Hello Bob'),findsWidgets);
  });
}

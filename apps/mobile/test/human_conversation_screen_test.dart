import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_conversation_screen.dart';
import 'package:masanawa/src/messages/human_messages_controller.dart';
import 'package:masanawa/src/messages/human_messages_transport.dart';

class _Pending implements HumanMessagePendingStore {
  HumanPendingSend? value;
  @override
  Future<HumanPendingSend?> read({required String userId,required String conversationId}) async=>value;
  @override
  Future<void> write({required String userId,required String conversationId,required HumanPendingSend value}) async{this.value=value;}
  @override
  Future<void> clear({required String userId,required String conversationId}) async{value=null;}
}
class _Transport extends Fake implements HumanMessagesTransport {
  int tries=0;
  @override
  Future<HumanMessagePageDto> history({required String conversationId,int limit=30,String? before}) async=>
    HumanMessagePageDto(messages:[],nextCursor:null);
  @override
  Future<HumanMessageDto> send({required String conversationId,required String requestId,required String text}) async {
    tries++;
    if(tries==1)throw StateError('offline');
    return HumanMessageDto.fromJson({
      'conversationId':conversationId,'messageId':'message-12345678',
      'senderUserId':'owner-a','text':text,'revision':1,
      'createdAt':'2026-10-08T10:00:00Z','editedAt':null,'deletedAt':null,
    });
  }
}
void main(){
  testWidgets('person thread never claims delivery before the Gateway receipt, and retries the same operation',(tester)async{
    final pending=_Pending(),transport=_Transport();
    final controller=HumanConversationController(
      ownerUserId:'owner-a',conversationId:'conv-12345678',
      transport:transport,pendingStore:pending,activeUserId:()=>'owner-a',
    );
    await tester.pumpWidget(MaterialApp(home:HumanConversationScreen(
      controller:controller,otherDisplayName:'Human friend')));
    await tester.pumpAndSettle();
    expect(find.text('Human friend'),findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('human-dm-compose')),'Hello');
    await tester.tap(find.byKey(const ValueKey('human-dm-send')));
    await tester.pumpAndSettle();
    expect(transport.tries,1);
    expect(pending.value?.text,'Hello');
    expect(find.text('Delivery not confirmed'),findsOneWidget);
    // Recover persisted request rather than treating the failed POST as success.
    expect(pending.value?.text,'Hello');
    final retry=find.widgetWithText(TextButton,'Retry').first;
    await tester.tap(retry);
    await tester.pumpAndSettle();
    expect(transport.tries,2);
    expect(pending.value,isNull);
    expect(find.text('Delivery not confirmed'),findsNothing);
    expect(find.text('Hello'),findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}

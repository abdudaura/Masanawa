import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_messages_controller.dart';
import 'package:masanawa/src/messages/human_messages_transport.dart';

final _received=HumanMessageDto.fromJson({
  'conversationId':'conv-12345678','messageId':'message-12345678',
  'senderUserId':'owner-a','text':'Hello',
  'createdAt':'2026-10-08T10:00:00Z','editedAt':null,'deletedAt':null,'revision':1,
});
class _Store implements HumanMessagePendingStore {
  final Map<String,HumanPendingSend> records={};
  bool failWrite=false;
  String key(String userId,String conversationId)=>'$userId|$conversationId';
  @override
  Future<HumanPendingSend?> read({required String userId,required String conversationId}) async =>
    records[key(userId,conversationId)];
  @override
  Future<void> write({required String userId,required String conversationId,required HumanPendingSend value}) async {
    if(failWrite)throw StateError('secure storage unavailable');
    records[key(userId,conversationId)]=value;
  }
  @override
  Future<void> clear({required String userId,required String conversationId}) async {
    records.remove(key(userId,conversationId));
  }
}
class _Transport extends Fake implements HumanMessagesTransport {
  _Transport(this.onSend);
  final Future<HumanMessageDto> Function(String,String,String) onSend;
  @override
  Future<HumanMessageDto> send({required String conversationId,required String requestId,required String text}) =>
    onSend(conversationId,requestId,text);
  @override
  Future<HumanMessagePageDto> history({required String conversationId,int limit=30,String? before}) async =>
    HumanMessagePageDto(messages:[],nextCursor:null);
}
HumanConversationController _controller(_Store store,_Transport transport,{String? Function()? owner}) =>
  HumanConversationController(ownerUserId:'owner-a',conversationId:'conv-12345678',
    transport:transport,pendingStore:store,activeUserId:owner??()=>'owner-a');
void main(){
  test('crash/lost-response keeps encrypted pending id and retries without a new request',() async {
    final store=_Store();
    final ids=<String>[];
    var count=0;
    Future<HumanMessageDto> send(String _,String requestId,String __)async{
      ids.add(requestId);count++;
      if(count==1)throw StateError('offline after committed send');
      return _received;
    }
    final original=_controller(store,_Transport(send));
    expect(await original.send('Hello'),isFalse);
    expect(store.records.values.single.requestId,ids.single);
    original.dispose();
    final restarted=_controller(store,_Transport(send));
    await restarted.open();
    expect(restarted.pending?.requestId,ids.single);
    expect(await restarted.retryPending(),isTrue);
    expect(ids,hasLength(2));
    expect(ids.last,ids.first);
    expect(store.records,isEmpty);
    expect(restarted.messages.single.messageId,'message-12345678');
  });
  test('unconfirmed message refuses a changed-body new request id',() async {
    final store=_Store();
    var sends=0;
    final controller=_controller(store,_Transport((_,__,___)async{
      sends++;throw StateError('offline');
    }));
    expect(await controller.send('Hello'),isFalse);
    expect(await controller.send('Different message'),isFalse);
    expect(sends,1);
    expect(controller.error,contains('Retry'));
    expect(store.records.values.single.text,'Hello');
  });
  test('secure-storage failure never starts a network POST',() async {
    final store=_Store()..failWrite=true;
    var sends=0;
    final controller=_controller(store,_Transport((_,__,___)async{
      sends++;return _received;
    }));
    expect(await controller.send('Hello'),isFalse);
    expect(sends,0);
    expect(controller.pending,isNull);
  });
  test('switching accounts during the network reply cannot show another account message',() async {
    final store=_Store();
    final started=Completer<void>();
    final complete=Completer<HumanMessageDto>();
    var active='owner-a';
    final controller=_controller(store,_Transport((_,__,___){
      started.complete();return complete.future;
    }),owner:()=>active);
    final pending=controller.send('Hello');
    await started.future;
    active='owner-b';
    complete.complete(_received);
    expect(await pending,isFalse);
    expect(controller.messages,isEmpty);
    expect(store.records.values.single.text,'Hello');
    await expectLater(controller.retryPending(),throwsStateError);
  });
  test('unmatched sender acknowledgement is not claimed as delivered',() async {
    final store=_Store();
    final wrong=HumanMessageDto.fromJson({
      'conversationId':'conv-12345678','messageId':'message-12345678',
      'senderUserId':'owner-b','text':'Hello',
      'createdAt':'2026-10-08T10:00:00Z','editedAt':null,'deletedAt':null,'revision':1,
    });
    final controller=_controller(store,_Transport((_,__,___)async=>wrong));
    expect(await controller.send('Hello'),isFalse);
    expect(store.records,isNotEmpty);
    expect(controller.messages,isEmpty);
  });
  test('bad recovery payload is rejected rather than allocating a new request id',() {
    expect(()=>HumanPendingSend.fromJson('{"requestId":"bad","text":"Hello"}'),throwsFormatException);
    expect(()=>HumanPendingSend.fromJson('{"requestId":"request-123456","text":""}'),throwsFormatException);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_dm_controller.dart';
import 'package:masanawa/src/messages/human_dm_outbox.dart';
import 'package:masanawa/src/messages/human_dm_transport.dart';

class _Outbox implements HumanDmOutbox {
  final pending=<String,List<HumanDmPending>>{};
  String key(String u,String c)=>'$u:$c';
  @override
  Future<List<HumanDmPending>> load(String u,String c) async=>
      List.of(pending[key(u,c)]??[]);
  @override
  Future<void> save(String u,String c,List<HumanDmPending> rows) async{
    pending[key(u,c)]=List.of(rows);
  }
  @override
  Future<void> clear(String u,String c) async{pending.remove(key(u,c));}
}
class _Transport implements HumanDmTransport {
  final sent=<String,HumanDmMessage>{};
  int attempts=0;
  bool loseAcknowledgment=false;
  bool blocked=false;
  @override Future<String> open(String otherUserId) async=>'thread-id';
  @override Future<List<HumanDmThread>> inbox({int limit=40}) async=>[];
  @override Future<HumanDmPage> history(String c,{int limit=40,int? beforeSequence}) async=>
      HumanDmPage(sent.values.where((m)=>m.conversationId==c).toList(),null);
  @override Future<HumanDmMessage> send(String c,{required String clientMessageId,required String text}) async{
    attempts++;
    if(blocked)throw StateError('contact revoked');
    final prior=sent[clientMessageId];
    final result=prior??HumanDmMessage(conversationId:c,messageId:clientMessageId,
      sequence:sent.length+1,clientMessageId:clientMessageId,senderUserId:'user_alice',
      text:text,createdAt:DateTime.utc(2026,10,8),editedAt:null,deletedAt:null);
    sent[clientMessageId]=result;
    if(loseAcknowledgment)throw StateError('Connection lost after server commit');
    return result;
  }
  @override Future<int> read(String c,int s) async=>s;
  @override Future<HumanDmMessage> edit(String c,String id,String text) async=>
      throw UnimplementedError();
  @override Future<HumanDmMessage> remove(String c,String id) async=>
      throw UnimplementedError();
}
Future<void> drain() async{
  await Future<void>.delayed(const Duration(milliseconds:20));
}
void main() {
  test('no fake success on lost ack; retry preserves UUID and server has one message',() async {
    final api=_Transport()..loseAcknowledgment=true;
    final box=_Outbox();
    final controller=HumanDmController('user_alice','thread-id',api,box,isAccountCurrent:()=>true);
    await drain();
    await controller.send('Hello');
    expect(controller.state.pending,hasLength(1));
    expect(controller.state.error,contains('not confirmed'));
    expect(api.sent.length,1);
    final id=controller.state.pending.single.id;
    api.loseAcknowledgment=false;
    await controller.retry(id);
    expect(api.sent.length,1);
    expect(api.attempts,2);
    expect(controller.state.pending,isEmpty);
    expect(controller.state.messages.single.clientMessageId,id);
    controller.dispose();
  });
  test('restart keeps pending per user and recovers confirmation on sync',() async {
    final api=_Transport()..loseAcknowledgment=true;
    final box=_Outbox();
    final first=HumanDmController('user_alice','thread-id',api,box,isAccountCurrent:()=>true);
    await drain();
    await first.send('My pending text');
    first.dispose();
    expect((await box.load('user_alice','thread-id')).length,1);
    final second=HumanDmController('user_alice','thread-id',api,box,isAccountCurrent:()=>true);
    await drain();
    expect(second.state.pending,isEmpty);
    expect(second.state.messages.single.text,'My pending text');
    expect((await box.load('user_bob','thread-id')),isEmpty);
    second.dispose();
  });
  test('server block is shown as error, never reported sent',() async {
    final api=_Transport()..blocked=true;
    final box=_Outbox();
    final controller=HumanDmController('user_alice','thread-id',api,box,isAccountCurrent:()=>true);
    await drain();
    await controller.send('Do not deliver');
    expect(controller.state.messages,isEmpty);
    expect(controller.state.pending.length,1);
    expect(controller.state.error,contains('not confirmed'));
    controller.dispose();
  });

  test('simultaneous sends never overwrite encrypted pending intents',() async {
    final api=_Transport()..blocked=true;
    final box=_Outbox();
    final controller=HumanDmController('user_alice','thread-id',api,box,isAccountCurrent:()=>true);
    await drain();
    await Future.wait([controller.send('First'),controller.send('Second')]);
    final saved=await box.load('user_alice','thread-id');
    expect(saved.length,2);
    expect(saved.map((p)=>p.text).toSet(),{'First','Second'});
    expect(saved.map((p)=>p.id).toSet().length,2);
    controller.dispose();
  });

  test('a switched or signed-out account cannot send under the new bearer',() async {
    final api=_Transport();
    final box=_Outbox();
    var active=true;
    final controller=HumanDmController('user_alice','thread-id',api,box,
      isAccountCurrent:()=>active);
    await drain();
    active=false;
    await controller.send('Alice private text');
    expect(api.attempts,0);
    expect(api.sent,isEmpty);
    expect(await box.load('user_alice','thread-id'),isEmpty);
    controller.dispose();
  });
}


import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_api.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_controller.dart';

class TestDrafts extends MasanaChatDraftStore {
  TestDrafts(): super(const FlutterSecureStorage());
  Map<String,dynamic>? current;
  bool rejectWrites=false;
  @override
  Future<Map<String,dynamic>?> read(String a,String c) async=>current;
  @override
  Future<void> write(String a,String c,Map<String,dynamic> value) async {
    if (rejectWrites) throw StateError('secure storage unavailable');
    current=value;
  }
  @override
  Future<void> clear(String a,String c) async {current=null;}
}
class ControlledChatApi extends MasanaChatApi {
  ControlledChatApi():super(Dio());
  final started=Completer<void>();
  final settled=Completer<String>();
  int turnCount=0;
  @override
  Future<String> open(String id) async =>
    'character-session_0199f0d0-0000-7000-8000-000000000001';
  @override
  Future<String> turn({
    required String characterId,required String sessionId,
    required String text,required String requestId,
  }) {
    turnCount++;
    if (!started.isCompleted) started.complete();
    return settled.future;
  }
  @override
  Future<void> close(String characterId,String sessionId) async {}
}

class DelayedReadDrafts extends TestDrafts {
  final release=Completer<void>();
  int readCalls=0;
  @override
  Future<Map<String,dynamic>?> read(String a,String c) async {
    readCalls++;
    await release.future;
    return super.read(a,c);
  }
}
class DelayedFirstWriteDrafts extends TestDrafts {
  final release=Completer<void>();
  int writeCalls=0;
  @override
  Future<void> write(String a,String c,Map<String,dynamic> value) async {
    writeCalls++;
    if (writeCalls==1) await release.future;
    await super.write(a,c,value);
  }
}

void main(){
  test('J03 no turn can reach gateway when secure outbox write fails',() async{
    final store=TestDrafts()..rejectWrites=true;
    final api=ControlledChatApi();
    final controller=MasanaChatController(
      api:api,drafts:store,accountId:'fan-a',characterId:'teacher');
    await controller.restore();
    await controller.send('Hello');
    await Future<void>.delayed(Duration.zero);
    expect(api.turnCount,0);
    expect(controller.error,contains('cannot be saved'));
    controller.dispose();
  });
  test('J16 account switch discards old in-flight Masana response',() async{
    final store=TestDrafts();
    final api=ControlledChatApi();
    final controller=MasanaChatController(
      api:api,drafts:store,accountId:'fan-a',characterId:'teacher');
    await controller.restore();
    await controller.send('Hello');
    await api.started.future;
    await controller.clearForAccountSwitch();
    api.settled.complete('Old fan response');
    await Future<void>.delayed(Duration.zero);
    expect(controller.turns,isEmpty);
    expect(store.current,isNull);
    controller.dispose();
  });
  test('J03 simultaneous restores coalesce and cannot overwrite new send',() async{
    final store=DelayedReadDrafts();
    final api=ControlledChatApi();
    final controller=MasanaChatController(
      api:api,drafts:store,accountId:'fan-a',characterId:'teacher');
    final readOne=controller.restore();
    final readTwo=controller.restore();
    final send=controller.send('First question');
    expect(store.readCalls,1);
    store.release.complete();
    await Future.wait([readOne,readTwo,send]);
    await api.started.future;
    expect(controller.turns.length,1);
    expect(store.current?['turns'],hasLength(1));
    api.settled.complete('Teacher replied');
    await Future<void>.delayed(Duration.zero);
    controller.dispose();
  });
  test('J03 queued saves remain in order under slow secure storage',() async{
    final store=DelayedFirstWriteDrafts();
    final api=ControlledChatApi();
    final controller=MasanaChatController(
      api:api,drafts:store,accountId:'fan-a',characterId:'teacher');
    await controller.restore();
    final first=controller.send('one');
    final second=controller.send('two');
    store.release.complete();
    await Future.wait([first,second]);
    await api.started.future;
    expect(store.current?['turns'],hasLength(2));
    expect(controller.turns.map((v)=>v.text),['one','two']);
    api.settled.complete('Ready');
    await Future<void>.delayed(Duration.zero);
    controller.dispose();
  });

}

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
}

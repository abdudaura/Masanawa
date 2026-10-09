import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_calls/human_call_controller.dart';
import 'package:masanawa/src/human_calls/human_call_models.dart';
import 'package:masanawa/src/human_calls/human_call_room.dart';
import 'package:masanawa/src/human_calls/human_call_transport.dart';

const _uuid='11111111-1111-4111-8111-111111111111';
const _conversation='22222222-2222-4222-8222-222222222222';
HumanCall _call({HumanCallState state=HumanCallState.ringing,
    HumanCallKind kind=HumanCallKind.audio})=>HumanCall(
  callId:_uuid,conversationId:_conversation,
  callerUserId:'user_a',calleeUserId:'user_b',
  kind:kind,state:state,
  createdAt:DateTime.utc(2026,10,9,5),
  answeredAt:state==HumanCallState.active?DateTime.utc(2026,10,9,5,0,3):null,
);
class _Transport implements HumanCallTransport {
  HumanCall current=_call();
  bool failStart=false;
  int credentialsCount=0;
  int calls=0;
  final keys=<String>[];
  Completer<HumanCall>? pending;
  @override
  Future<HumanCall> start({required String conversationId,required String requestId,
    required HumanCallKind kind}) async {
    calls++;
    keys.add(requestId);
    if(failStart)throw StateError('network unknown');
    return current;
  }
  @override
  Future<HumanCall> get(String callId) async {
    if(pending!=null)return pending!.future;
    return current;
  }
  @override
  Future<HumanCall> act(String callId,String action) async {
    current=_call(state:action=='accept'?HumanCallState.active:
      action=='decline'?HumanCallState.declined:HumanCallState.ended);
    return current;
  }
  @override
  Future<HumanCallCredentials> credentials(String callId) async {
    credentialsCount++;
    return HumanCallCredentials(
      serverUrl:'wss://example.com/',
      participantToken:'token',
      roomName:'human-call_$_uuid',
      participantIdentity:'opaque',
      expiresAt:DateTime.utc(2099),
    );
  }
  @override
  Future<List<HumanCall>> recent() async=>[current];
}
class _Room implements HumanCallRoom {
  @override
  bool connected=false;
  int joins=0,closes=0;
  @override
  Future<void> connect(HumanCallCredentials c,HumanCallKind k) async {
    connected=true;joins++;
  }
  @override
  Future<void> close() async {connected=false;closes++;}
  @override
  Future<void> setMuted(bool value) async {}
  @override
  Future<void> setCameraEnabled(bool value) async {}
  @override
  Future<void> flipCamera() async {}
  @override
  Future<void> setSpeaker(bool value) async {}
}
HumanCallController _controller({
  required _Transport t,required _Room r,
  required String user,required bool Function() active,
  Future<bool> Function(HumanCallKind)? permission,
})=>HumanCallController(
  currentUserId:user,transport:t,room:r,
  isCurrentSession:active,
  requestPermissions:permission??(_)=>Future.value(true),
  pollInterval:const Duration(days:1),
);

void main(){
  test('ringing does not activate microphone or mint a token',() async {
    final t=_Transport(),r=_Room();
    final c=_controller(t:t,r:r,user:'user_a',active:()=>true);
    await c.start(_conversation,HumanCallKind.audio);
    expect(c.call?.state,HumanCallState.ringing);
    expect(t.credentialsCount,0);
    expect(r.joins,0);
    c.dispose();
  });
  test('uncertain start retries exact same durable request ID within session',() async {
    final t=_Transport()..failStart=true,r=_Room();
    final c=_controller(t:t,r:r,user:'user_a',active:()=>true);
    await c.start(_conversation,HumanCallKind.audio);
    t.failStart=false;
    await c.start(_conversation,HumanCallKind.audio);
    expect(t.keys,hasLength(2));
    expect(t.keys[0],t.keys[1]);
    c.dispose();
  });
  test('callee denied mic cannot accidentally accept or connect',() async {
    final t=_Transport(),r=_Room();
    final c=_controller(t:t,r:r,user:'user_b',active:()=>true,
      permission:(_)=>Future.value(false));
    await c.load(_uuid);
    await c.accept();
    expect(c.call?.state,HumanCallState.ringing);
    expect(t.credentialsCount,0);
    expect(r.joins,0);
    c.dispose();
  });
  test('callee accepts and joins only after explicit permission',() async {
    final t=_Transport(),r=_Room();
    final c=_controller(t:t,r:r,user:'user_b',active:()=>true);
    await c.load(_uuid);
    await c.accept();
    expect(c.call?.state,HumanCallState.active);
    expect(t.credentialsCount,1);
    expect(r.joins,1);
    await c.end();
    expect(r.connected,isFalse);
    expect(c.call?.state,HumanCallState.ended);
    c.dispose();
  });
  test('server ending a call closes local media on refresh',() async {
    final t=_Transport()..current=_call(state:HumanCallState.active),
      r=_Room();
    final c=_controller(t:t,r:r,user:'user_a',active:()=>true);
    await c.load(_uuid);
    await c.refresh();
    expect(r.connected,isTrue);
    t.current=_call(state:HumanCallState.ended);
    await c.refresh();
    expect(r.connected,isFalse);
    c.dispose();
  });
  test('late response after sign-out never restores an old call',() async {
    final t=_Transport(),r=_Room();
    t.pending=Completer<HumanCall>();
    var user='user_a';
    final c=_controller(t:t,r:r,user:'user_a',
      active:()=>user=='user_a');
    final pending=c.load(_uuid);
    await Future<void>.delayed(Duration.zero);
    user='user_b';
    t.pending!.complete(_call(state:HumanCallState.active));
    await pending;
    expect(c.call,isNull);
    expect(r.joins,0);
    c.dispose();
  });
}

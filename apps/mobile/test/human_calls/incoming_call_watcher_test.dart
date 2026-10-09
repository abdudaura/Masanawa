import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_calls/human_call_entries.dart';
import 'package:masanawa/src/human_calls/human_call_models.dart';
import 'package:masanawa/src/human_calls/human_call_transport.dart';

const id='11111111-1111-4111-8111-111111111111';
class _Transport implements HumanCallTransport {
  List<HumanCall> calls=[];
  Completer<List<HumanCall>>? pending;
  int reads=0;
  @override
  Future<List<HumanCall>> recent() {
    reads++;
    return pending?.future??Future.value(calls);
  }
  @override
  Future<HumanCall> get(String callId)=>throw UnimplementedError();
  @override
  Future<HumanCall> act(String callId,String action)=>throw UnimplementedError();
  @override
  Future<HumanCall> start({required String conversationId,required String requestId,
    required HumanCallKind kind})=>throw UnimplementedError();
  @override
  Future<HumanCallCredentials> credentials(String callId)=>throw UnimplementedError();
}
HumanCall call(String user,HumanCallState state)=>HumanCall(
  callId:id,conversationId:'22222222-2222-4222-8222-222222222222',
  callerUserId:'user_a',calleeUserId:user,
  kind:HumanCallKind.audio,state:state,
  createdAt:DateTime.utc(2026,10,9,5),
);

void main(){
  test('only a current authenticated recipient sees ringing',() async {
    final t=_Transport()..calls=[call('user_other',HumanCallState.ringing)];
    final w=HumanIncomingCallWatcher(
      transport:t,currentUserId:'user_b',isCurrentSession:()=>true,
      interval:const Duration(days:1),
    );
    w.start();await w.refresh();
    expect(w.incoming,isNull);
    t.calls=[call('user_b',HumanCallState.ringing)];
    await w.refresh();
    expect(w.incoming?.callId,id);
    t.calls=[call('user_b',HumanCallState.missed)];
    await w.refresh();
    expect(w.incoming,isNull);
    w.dispose();
  });
  test('sign-out clears invitation and rejects a late backend response',() async {
    final t=_Transport()..pending=Completer<List<HumanCall>>();
    var active=true;
    final w=HumanIncomingCallWatcher(
      transport:t,currentUserId:'user_b',
      isCurrentSession:()=>active,interval:const Duration(days:1),
    );
    w.start();
    final future=w.refresh();
    active=false;
    w.stop();
    t.pending!.complete([call('user_b',HumanCallState.ringing)]);
    await future;
    expect(w.incoming,isNull);
    w.dispose();
  });
}

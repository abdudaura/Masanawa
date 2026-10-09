import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_calls/human_call_models.dart';

const callId='11111111-1111-4111-8111-111111111111';
const threadId='22222222-2222-4222-8222-222222222222';
Map<String,dynamic> record({String state='ringing',String kind='audio'})=> {
  'callId':callId,'conversationId':threadId,'callerUserId':'alice',
  'calleeUserId':'bob','kind':kind,'state':state,
  'createdAt':'2026-10-09T09:00:00.000Z','answeredAt':null,'endedAt':null,
};
Map<String,dynamic> token()=> {
  'server_url':'wss://livekit.example/',
  'participant_token':'signed-provider-token',
  'room_name':'human-call_$callId',
  'participant_identity':'opaque-hash',
  'expires_at':'2099-01-01T00:00:00Z',
};

void main(){
  test('human calling parses only known states with actual answer time',(){
    final created=HumanCall.fromJson(record());
    expect(created.kind,HumanCallKind.audio);
    expect(created.state,HumanCallState.ringing);
    expect(created.terminal,isFalse);
    expect(()=>HumanCall.fromJson(record(state:'active')),throwsFormatException);
    final active=record(state:'active')..['answeredAt']='2026-10-09T09:00:05Z';
    expect(HumanCall.fromJson(active).answeredAt,isNotNull);
    expect(()=>HumanCall.fromJson(record(state:'unknown')),throwsFormatException);
    expect(()=>HumanCall.fromJson(record(kind:'screen_share')),throwsFormatException);
  });
  test('call credential rejects impersonation, plaintext and credential URLs',(){
    final credentials=HumanCallCredentials.fromJson(token(),callId);
    expect(credentials.roomName,'human-call_$callId');
    for (final endpoint in [
      'ws://livekit.example/',
      'https://livekit.example/',
      'wss://user:pass@livekit.example/',
      'wss://livekit.example/?access_token=secret',
      'wss://livekit.example/#fragment',
      'wss://livekit.example/custom-room-path',
    ]){
      expect(()=>HumanCallCredentials.fromJson(
        token()..['server_url']=endpoint,callId),throwsFormatException);
    }
    expect(()=>HumanCallCredentials.fromJson(
      token()..['room_name']='public-talk_$callId',callId),throwsFormatException);
    expect(()=>HumanCallCredentials.fromJson(
      token()..['expires_at']='2020-01-01T00:00:00Z',callId),throwsFormatException);
    expect(()=>HumanCallCredentials.fromJson(
      token()..['participant_token']='',callId),throwsFormatException);
  });
}

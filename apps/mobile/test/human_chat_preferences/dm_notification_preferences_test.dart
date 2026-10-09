import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_preferences/dm_notification_preferences.dart';

const id='a0000000-0000-4000-8000-000000000001';
const settings=DmNotificationSettings(conversationId:id,version:0,mute:DmMuteMode.off,preview:DmPreviewMode.hidden);
class Stub implements DmNotificationTransport{
 Future<DmNotificationSettings> Function(String)? read;
 Future<DmNotificationSettings> Function(DmNotificationSettings)? write;
 final calls=<String>[];
 @override
 Future<DmNotificationSettings> get({required String authorizationHeader,required String conversationId}){
  calls.add('get');return read!(conversationId);
 }
 @override
 Future<DmNotificationSettings> put({required String authorizationHeader,required DmNotificationSettings existing,
  required DmMuteMode mute,required DmPreviewMode preview,DateTime? until}){
  calls.add('put');return write!(existing);
 }
 @override
 Future<bool> canOpen({required String authorizationHeader,required String conversationId})async=>false;
}
void main(){
 test('reject malformed, unsupported or inconsistent preferences',(){
  expect(()=>DmNotificationSettings.fromJson({'conversationId':id,'version':0,'muteMode':'forever',
   'preview':'hidden','mutedUntil':'2026-10-01'}),throwsFormatException);
  expect(()=>DmNotificationSettings.fromJson({'conversationId':id,'version':0,'muteMode':'off',
   'preview':'plaintext'}),throwsA(anything));
 });
 test('no optimistic success after unconfirmed version',()async{
  final stub=Stub()..read=(_)=>Future.value(settings)..write=(_)=>Future.value(settings);
  final c=DmNotificationPreferencesController(stub);
  await c.load(accountKey:'A',authorizationHeader:'Bearer A',conversationId:id);
  expect(c.state,DmPreferenceState.ready);
  await c.save(accountKey:'A',authorizationHeader:'Bearer A',conversationId:id,
   mute:DmMuteMode.forever,preview:DmPreviewMode.hidden);
  expect(c.state,DmPreferenceState.uncertain);expect(c.current,isNull);expect(stub.calls,['get','put']);c.dispose();
 });
 test('logout/account switch ignores a late authenticated response',()async{
  final pending=Completer<DmNotificationSettings>();
  final stub=Stub()..read=(_)=>pending.future;
  final c=DmNotificationPreferencesController(stub);
  final work=c.load(accountKey:'A',authorizationHeader:'Bearer A',conversationId:id);
  c.clear();pending.complete(settings);await work;
  expect(c.current,isNull);expect(c.state,DmPreferenceState.idle);c.dispose();
 });
}

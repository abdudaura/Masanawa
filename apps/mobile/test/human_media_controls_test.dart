import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media/human_voice_controls.dart';
import 'package:masanawa/src/human_media/human_voice_controller.dart';
import 'package:masanawa/src/human_media/human_voice_models.dart';
import 'package:masanawa/src/human_media/human_voice_transport.dart';

class _DeniedMicrophone implements HumanVoiceCapture {
 bool started=false;
 @override Future<bool> permission() async=>false;
 @override Future<void> start(String path) async{started=true;throw StateError('Denied');}
 @override Future<String?> stop() async=>null;
 @override Future<void> dispose() async{}
}
class _VoiceApi implements HumanVoiceTransport {
 int listCount=0, sendCount=0;
 @override Future<List<HumanVoiceNote>> list(String id,{String? before,int limit=30}) async{
  listCount++;
  return const [];
 }
 @override Future<HumanVoiceNote> send(String id,String request,Uint8List ogg) async{
  sendCount++;throw StateError('Must not upload');
 }
 @override Future<Uint8List> read(String messageId) async=>throw StateError('Not used');
 @override Future<void> remove(String messageId) async=>throw StateError('Not used');
}
void main(){
 testWidgets('voice recording requires deliberate tap and denied mic has recoverable text path',
  (tester) async{
   final voiceApi=_VoiceApi(),capture=_DeniedMicrophone();
   await tester.pumpWidget(MaterialApp(home:Scaffold(
    body:HumanVoiceNotesPanel(
      conversationId:'00000000-0000-4000-8000-000000000001',
      currentUserId:'user_abc',transport:voiceApi,capture:capture,
    ),
   )));
   await tester.pumpAndSettle();
   expect(capture.started,false);
   expect(voiceApi.listCount,1);
   await tester.tap(find.byTooltip('Record private voice note'));
   await tester.pumpAndSettle();
   expect(find.textContaining('Microphone permission denied'),findsOneWidget);
   expect(capture.started,false);
   expect(voiceApi.sendCount,0);
 });
}

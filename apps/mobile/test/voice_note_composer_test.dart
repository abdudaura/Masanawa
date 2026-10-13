import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:masanawa/src/core/voice_note_recorder.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/voice_note_composer.dart';
class _Native extends Mock implements AudioRecorder {}
class _Recorder extends VoiceNoteRecorder {
 _Recorder() : super(recorder: _Native());
 bool cancelled = false;
 @override Future<void> start({bool Function()? isOwnerCurrent}) async {state=VoiceNoteState.recording;notifyListeners();}
 @override Future<ChatAttachment?> stop() async {state=VoiceNoteState.ready;note=const ChatAttachment(kind:'voice',path:'/private/note.m4a',sizeBytes:16,durationMs:1200);notifyListeners();return note;}
 @override Future<void> cancel() async {cancelled=true;state=VoiceNoteState.idle;notifyListeners();}
 @override void retain() {}
}
void main() {
 for(final scale in [1.0,2.0]) {
  testWidgets('record then send dispatches one voice note at 320px ${scale}x', (tester) async {
   tester.view.physicalSize=const Size(320,800);tester.view.devicePixelRatio=1;
   addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
   final recorder=_Recorder();final sent=<ChatAttachment>[];
   await tester.pumpWidget(MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),home:Builder(builder:(context)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:TextScaler.linear(scale)),child:Scaffold(body:VoiceNoteComposer(recorder:recorder,isOwnerCurrent:()=>true,onSend:(note) async {sent.add(note);return true;}))))));
   await tester.pumpAndSettle();
   expect(find.text('Recording voice note'),findsOneWidget);
   await tester.tap(find.text('Send voice note'));await tester.pumpAndSettle();
   expect(sent,hasLength(1));expect(sent.single.kind,'voice');expect(sent.single.path,endsWith('.m4a'));
   expect(tester.takeException(),isNull);
  });
 }
 testWidgets('cancel never submits recording', (tester) async {
  final recorder=_Recorder();var sent=false;
  await tester.pumpWidget(MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),home:Scaffold(body:VoiceNoteComposer(recorder:recorder,isOwnerCurrent:()=>true,onSend:(_) async {sent=true;return true;}))));
  await tester.pumpAndSettle();await tester.tap(find.text('Cancel'));await tester.pumpAndSettle();
  expect(sent,false);expect(recorder.cancelled,true);
 });
 testWidgets('changed account cannot submit audio recorded by previous account', (tester) async {
  final recorder=_Recorder();var current=true;var sent=false;
  await tester.pumpWidget(MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),home:Scaffold(body:VoiceNoteComposer(recorder:recorder,isOwnerCurrent:()=>current,onSend:(_) async {sent=true;return true;}))));
  await tester.pumpAndSettle();current=false;
  await tester.tap(find.text('Send voice note'));await tester.pumpAndSettle();
  expect(sent,false);expect(recorder.cancelled,true);
 });
}

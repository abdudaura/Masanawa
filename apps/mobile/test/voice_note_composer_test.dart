import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:just_audio/just_audio.dart';
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
class _PreviewAudio extends Mock implements AudioPlayer {}

void main() {
 testWidgets('finished recording can be previewed locally without uploading or starting a call', (tester) async {
  final recorder = _Recorder();
  final player = _PreviewAudio();
  final sent = <ChatAttachment>[];
  when(() => player.setFilePath(any())).thenAnswer((_) async => const Duration(seconds: 1));
  when(() => player.play()).thenAnswer((_) async {});
  when(() => player.dispose()).thenAnswer((_) async {});
  await tester.pumpWidget(MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),
    home:Scaffold(body:VoiceNoteComposer(recorder:recorder,previewPlayer:player,
      isOwnerCurrent:()=>true,onSend:(note) async {sent.add(note);return true;}))));
  await tester.pumpAndSettle();
  expect(find.text('Play voice note'),findsNothing);
  await tester.tap(find.text('Stop'));
  await tester.pumpAndSettle();
  expect(find.text('Play voice note'),findsOneWidget);
  await tester.tap(find.text('Play voice note'));
  await tester.pumpAndSettle();
  verify(() => player.setFilePath('/private/note.m4a')).called(1);
  verify(() => player.play()).called(1);
  expect(sent,isEmpty);
  expect(tester.takeException(),isNull);
 });
 testWidgets('preview playback errors do not send recorded audio', (tester) async {
  final recorder = _Recorder();
  final player = _PreviewAudio();
  when(() => player.setFilePath(any())).thenThrow(StateError('offline preview'));
  when(() => player.dispose()).thenAnswer((_) async {});
  var sent = false;
  await tester.pumpWidget(MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),
    home:Scaffold(body:VoiceNoteComposer(recorder:recorder,previewPlayer:player,
      isOwnerCurrent:()=>true,onSend:(_) async {sent=true;return true;}))));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Stop'));await tester.pumpAndSettle();
  await tester.tap(find.text('Play voice note'));await tester.pumpAndSettle();
  expect(find.textContaining('recording could not be played'),findsOneWidget);
  expect(sent,false);
 });
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

import 'dart:async';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:masanawa/src/core/voice_note_recorder.dart';

class _Recorder extends Mock implements AudioRecorder {}
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  late _Recorder native;
  late VoiceNoteRecorder recorder;
  late String output;
  setUpAll(() => registerFallbackValue(const RecordConfig()));
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('voice-note-test-');
    native = _Recorder();
    when(() => native.hasPermission()).thenAnswer((_) async => true);
    when(() => native.start(any(), path: any(named: 'path'))).thenAnswer((call) async {
      output = call.namedArguments[#path] as String;
      await File(output).writeAsBytes([1, 2, 3, 4]);
    });
    when(() => native.stop()).thenAnswer((_) async => output);
    when(() => native.cancel()).thenAnswer((_) async {});
    when(() => native.dispose()).thenAnswer((_) async {});
    recorder = VoiceNoteRecorder(recorder: native, directory: () async => directory);
  });
  tearDown(() async {
    await recorder.close();
    await directory.delete(recursive: true);
  });
  test('records a real local file and hands off voice bytes without a call grant', () async {
    await recorder.start();
    expect(recorder.state, VoiceNoteState.recording);
    final note = await recorder.stop();
    expect(note!.kind, 'voice');
    expect(note.path, endsWith('.m4a'));
    expect(note.sizeBytes, 4);
    expect(await File(note.path).readAsBytes(), [1, 2, 3, 4]);
    recorder.retain();
    await recorder.close();
    expect(await File(note.path).exists(), true, reason: 'Offline/retry owns the sent file now.');
  });
  test('cancel removes unfinished audio instead of submitting it', () async {
    await recorder.start();
    await recorder.cancel();
    expect(recorder.state, VoiceNoteState.idle);
    expect(await File(output).exists(), false);
    verifyNever(() => native.stop());
  });
  test('only actual denied permission reports a permission failure', () async {
    when(() => native.hasPermission()).thenAnswer((_) async => false);
    await recorder.start();
    expect(recorder.state, VoiceNoteState.failed);
    expect(recorder.error, contains('permission'));
    verifyNever(() => native.start(any(), path: any(named: 'path')));
  });
  test('granted permission and native failure do not blame denied permission', () async {
    when(() => native.start(any(), path: any(named: 'path'))).thenThrow(StateError('encoder unavailable'));
    await recorder.start();
    expect(recorder.state, VoiceNoteState.failed);
    expect(recorder.error, isNot(contains('permission')));
  });
  test('empty recording cannot be sent', () async {
    when(() => native.start(any(), path: any(named: 'path'))).thenAnswer((call) async {
      output = call.namedArguments[#path] as String;
      await File(output).writeAsBytes([]);
    });
    await recorder.start();
    expect(await recorder.stop(), isNull);
    expect(recorder.state, VoiceNoteState.failed);
  });
  test('account change during permission wait never opens the microphone', () async {
    final permission = Completer<bool>();
    var current = true;
    when(() => native.hasPermission()).thenAnswer((_) => permission.future);
    final starting = recorder.start(isOwnerCurrent: () => current);
    current = false;
    permission.complete(true);
    await starting;
    verifyNever(() => native.start(any(), path: any(named: 'path')));
    expect(recorder.state, VoiceNoteState.idle);
  });
  test('cancel during native startup releases late microphone and deletes file', () async {
    final started = Completer<void>();
    final finish = Completer<void>();
    when(() => native.start(any(), path: any(named: 'path'))).thenAnswer((call) async {
      output = call.namedArguments[#path] as String;
      started.complete();
      await finish.future;
      await File(output).writeAsBytes([1, 2]);
    });
    final opening = recorder.start();
    await started.future;
    final cancelling = recorder.cancel();
    finish.complete();
    await Future.wait([opening, cancelling]);
    expect(await File(output).exists(), false);
    expect(recorder.state, VoiceNoteState.idle);
  });
}

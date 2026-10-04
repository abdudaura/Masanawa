import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/core/live_voice_session.dart';

class _Recorder extends Mock implements AudioRecorder {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Recorder recorder;
  late LiveVoiceSession session;

  setUp(() {
    recorder = _Recorder();
    when(() => recorder.stop()).thenAnswer((_) async => null);
    when(() => recorder.dispose()).thenAnswer((_) async {});
    session = LiveVoiceSession(
      grant: AgentLiveVoiceGrant(token: 'unused',
          websocketUrl: 'wss://example.invalid', model: 'test', voiceName: 'Bodi',
          expiresAt: DateTime.now().add(const Duration(minutes: 1))),
      characterName: 'Gwani', recorder: recorder,
    );
  });
  tearDown(() async => session.close());

  test('mute selected before setup remains selected', () async {
    await session.mute(true);
    expect(session.muted, isTrue);
    await session.mute(false);
    expect(session.muted, isFalse);
    verifyNever(() => recorder.hasPermission());
  });

  test('concurrent closure releases the recorder once and prevents restart', () async {
    await Future.wait([session.close(), session.close()]);
    await session.start();
    verify(() => recorder.dispose()).called(1);
    verifyNever(() => recorder.hasPermission());
  });

  test('backgrounding ends the call and releases microphone custody', () async {
    session.didChangeAppLifecycleState(AppLifecycleState.paused);
    await session.close();
    verify(() => recorder.stop()).called(1);
    verify(() => recorder.dispose()).called(1);
  });
}

  import 'dart:async';

  import 'package:flutter_test/flutter_test.dart';
  import 'package:mocktail/mocktail.dart';
  import 'package:record/record.dart';
  import 'package:masanawa/src/agents/agent_shell.dart';
  import 'package:masanawa/src/core/live_voice_session.dart';

  class _Recorder extends Mock implements AudioRecorder {}

  void main() {
    TestWidgetsFlutterBinding.ensureInitialized();
    setUpAll(() {
      registerFallbackValue(const RecordConfig(encoder: AudioEncoder.pcm16bits));
    });

    late _Recorder recorder;
    late LiveVoiceSession session;

    setUp(() {
      recorder = _Recorder();
      when(() => recorder.stop()).thenAnswer((_) async => null);
      when(() => recorder.dispose()).thenAnswer((_) async {});
      session = LiveVoiceSession(
        grant: AgentLiveVoiceGrant(
          token: 'unused',
          websocketUrl: 'wss://example.invalid',
          model: 'test',
          voiceName: 'Bodi',
          expiresAt: DateTime.now().add(const Duration(minutes: 1)),
        ),
        characterName: 'Gwani',
        recorder: recorder,
      );
    });

    tearDown(() async => session.close());

    test(
      'denied microphone has a typed permission stage and legacy error',
      () async {
      when(() => recorder.hasPermission()).thenAnswer((_) async => false);

      final failure = expectLater(
        session.failures,
        emits(predicate<LiveVoiceFailure>(
          (event) =>
              event.stage == LiveVoiceFailureStage.permission &&
              event.message.contains('Microphone permission'),
        )),
      );
      final message = expectLater(
        session.errors,
        emits('Microphone permission is required for live voice.'),
      );
      final readiness = expectLater(session.ready, throwsStateError);

      await expectLater(session.start(), throwsStateError);
      await Future.wait([failure, message, readiness]);
      verify(() => recorder.hasPermission()).called(1);
      verifyNever(() => recorder.startStream(any()));
    },
  );

  test(
    'permission channel failure does not masquerade as network failure',
    () async {
    when(() => recorder.hasPermission()).thenThrow(StateError('plugin missing'));

    final failure = expectLater(
      session.failures,
      emits(predicate<LiveVoiceFailure>(
        (event) =>
            event.stage == LiveVoiceFailureStage.permission &&
            event.message.contains('Could not check microphone permission'),
      )),
    );
    final readiness = expectLater(session.ready, throwsStateError);

    await expectLater(session.start(), throwsStateError);
    await Future.wait([failure, readiness]);
    verifyNever(() => recorder.startStream(any()));
    },
  );

  test(
    'concurrent start is single-flight even when permission is pending',
    () async {
    final permission = Completer<bool>();
    when(() => recorder.hasPermission()).thenAnswer((_) => permission.future);

    final first = session.start();
    final second = session.start();
    permission.complete(false);

    await Future.wait([
      expectLater(first, throwsStateError),
      expectLater(second, throwsStateError),
    ]);
    verify(() => recorder.hasPermission()).called(1);
    verify(() => recorder.dispose()).called(1);
    verifyNever(() => recorder.startStream(any()));
    },
  );
}

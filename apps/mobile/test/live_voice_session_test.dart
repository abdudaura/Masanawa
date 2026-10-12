import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
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

  test('closing preserves readiness failure for callers', () async {
    final failure = expectLater(session.ready, throwsStateError);
    await session.close();
    await failure;
  });

  test('mute selected before setup remains selected', () async {
    await session.mute(true);
    expect(session.muted, isTrue);
    await session.mute(false);
    expect(session.muted, isFalse);
    verifyNever(() => recorder.hasPermission());
  });

  test(
    'concurrent closure releases the recorder once and prevents restart',
    () async {
      await Future.wait([session.close(), session.close()]);
      await session.start();
      verify(() => recorder.dispose()).called(1);
      verifyNever(() => recorder.hasPermission());
    },
  );

  test('backgrounding ends the call and releases microphone custody', () async {
    session.didChangeAppLifecycleState(AppLifecycleState.paused);
    await session.close();
    verify(() => recorder.stop()).called(1);
    verify(() => recorder.dispose()).called(1);
  });
  test(
    'teardown callback runs once even when recorder cleanup fails',
    () async {
      var closed = 0;
      when(() => recorder.stop()).thenThrow(StateError('native stop failed'));
      final reported = LiveVoiceSession(
        grant: session.grant,
        characterName: 'Gwani',
        recorder: recorder,
        onClosed: () {
          closed++;
        },
      );
      await Future.wait([reported.close(), reported.close()]);
      expect(closed, 1);
    },
  );
  test(
    'shared microphone session never stops or disposes shared custody',
    () async {
      final shared = LiveVoiceSession(
        grant: session.grant,
        characterName: 'Gwani',
        recorder: recorder,
        sharedMicrophone: const Stream<Uint8List>.empty(),
      );
      await shared.close();
      verifyNever(() => recorder.stop());
      verifyNever(() => recorder.dispose());
    },
  );
  test('shared session reports connected only after server setup', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final peer = Completer<WebSocket>();
    final listener = server.listen((request) async {
      peer.complete(await WebSocketTransformer.upgrade(request));
    });
    var connected = 0;
    var closed = 0;
    final microphone = StreamController<Uint8List>.broadcast();
    final live = LiveVoiceSession(
      grant: AgentLiveVoiceGrant(
        token: 'unused',
        websocketUrl: 'ws://127.0.0.1:${server.port}',
        model: 'test',
        voiceName: 'Bodi',
        expiresAt: DateTime.now().add(const Duration(minutes: 1)),
      ),
      characterName: 'Gwani',
      sharedMicrophone: microphone.stream,
      sendGreeting: false,
      onConnected: () {
        connected++;
      },
      onClosed: () {
        closed++;
      },
    );
    try {
      await live.start();
      final socket = await peer.future;
      expect(connected, 0);
      socket.add(jsonEncode({'setupComplete': {}}));
      await live.ready.timeout(const Duration(seconds: 2));
      expect(connected, 1);
      final interrupted = live.states.firstWhere(
        (state) => state == LiveVoiceState.interrupted,
      );
      socket.add(jsonEncode({'setupComplete': {}}));
      socket.add(
        jsonEncode({
          'serverContent': {'interrupted': true},
        }),
      );
      await interrupted.timeout(const Duration(seconds: 2));
      expect(connected, 1);
      await live.close();
      expect(closed, 1);
      await socket.close();
    } finally {
      await live.close();
      await microphone.close();
      await listener.cancel();
      await server.close(force: true);
    }
  });
  for (final useDeadline in [false, true]) {
    test(
      useDeadline
          ? 'absolute permission expiry bounds an otherwise longer call'
          : 'consented duration ends a connected native session without UI custody',
      () async {
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        final peer = Completer<WebSocket>();
        final listener = server.listen((request) async {
          peer.complete(await WebSocketTransformer.upgrade(request));
        });
        final ended = Completer<void>();
        final input = StreamController<Uint8List>.broadcast();
        final live = LiveVoiceSession(
          grant: AgentLiveVoiceGrant(
            token: 'unused',
            websocketUrl: 'ws://127.0.0.1:${server.port}',
            model: 'test',
            voiceName: 'Bodi',
            expiresAt: DateTime.now().add(const Duration(minutes: 1)),
          ),
          characterName: 'Gwani',
          sharedMicrophone: input.stream,
          sendGreeting: false,
          maxDuration: useDeadline
              ? const Duration(minutes: 1)
              : const Duration(milliseconds: 100),
          endAt: useDeadline
              ? DateTime.now().add(const Duration(milliseconds: 100))
              : null,
          onClosed: () {
            if (!ended.isCompleted) ended.complete();
          },
        );
        try {
          await live.start();
          final socket = await peer.future;
          socket.add(jsonEncode({'setupComplete': {}}));
          // Keep a live shared input subscription until the timer closes it.
          await live.ready.timeout(const Duration(seconds: 2));
          await ended.future.timeout(const Duration(seconds: 2));
          await live.close();
          await socket.close();
        } finally {
          await live.close();
          await input.close();
          await listener.cancel();
          await server.close(force: true);
        }
      },
    );
  }
}

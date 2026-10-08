import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_live.dart';
import 'package:masanawa/src/talks/talk_live_audio_session.dart';
import 'package:masanawa/src/talks/talk_live_room.dart';

class _Transport implements TalkLiveTransport {
  _Transport({required this.role, this.canPublishAudio = false});

  final TalkLiveRole role;
  bool canPublishAudio;
  bool failNextToken = false;
  bool sessionEndedOnConnect = false;
  Completer<void>? connectGate;
  int heartbeats = 0;
  int disconnects = 0;
  TalkLiveLifecycle heartbeatState = TalkLiveLifecycle.live;

  TalkLiveSessionView _session(TalkLiveLifecycle state) => TalkLiveSessionView(
    sessionId: 'talk-live_test-session',
    talkId: 'talk-1',
    role: role,
    state: state,
    canPublishAudio: canPublishAudio && state == TalkLiveLifecycle.live,
    canHearAudio: state != TalkLiveLifecycle.ended,
    aiGenerationAllowed:
        role == TalkLiveRole.host && state == TalkLiveLifecycle.live,
  );

  @override
  Future<TalkLiveSessionView> connect(String talkId) async {
    await connectGate?.future;
    return _session(
      sessionEndedOnConnect ? TalkLiveLifecycle.ended : TalkLiveLifecycle.live,
    );
  }

  @override
  Future<TalkLiveSessionView> heartbeat({
    required String talkId,
    required String sessionId,
  }) async {
    heartbeats += 1;
    return _session(heartbeatState);
  }

  @override
  Future<TalkLiveStateView> disconnect({
    required String talkId,
    required String sessionId,
  }) async {
    disconnects += 1;
    return const TalkLiveStateView(
      talkId: 'talk-1',
      state: TalkLiveLifecycle.reconnecting,
      hostConnected: false,
      listenerCount: 0,
      aiGenerationAllowed: false,
    );
  }

  @override
  Future<TalkLiveMediaCredentials> mediaToken({
    required String talkId,
    required String sessionId,
  }) async {
    if (failNextToken) {
      failNextToken = false;
      throw StateError('Simulated media-token rejection');
    }
    return TalkLiveMediaCredentials(
      serverUrl: 'wss://live.example.test',
      participantToken: 'token',
      roomName: talkId,
      participantIdentity: 'user:' + sessionId,
      expiresAt: DateTime(2030),
    );
  }

  @override
  Future<TalkLiveStateView> state(String talkId) async => TalkLiveStateView(
    talkId: talkId,
    state: heartbeatState,
    hostConnected: heartbeatState == TalkLiveLifecycle.live,
    listenerCount: 1,
    aiGenerationAllowed:
        role == TalkLiveRole.host && heartbeatState == TalkLiveLifecycle.live,
  );
}

class _Room implements TalkLiveRoom {
  bool? publishMicrophone;
  final List<bool> microphone = [];
  int closes = 0;
  bool failNextConnect = false;
  int connects = 0;

  @override
  Future<void> connect({
    required TalkLiveMediaCredentials credentials,
    required bool publishMicrophone,
  }) async {
    connects += 1;
    if (failNextConnect) {
      failNextConnect = false;
      throw StateError('Simulated LiveKit connection failure');
    }
    this.publishMicrophone = publishMicrophone;
  }

  @override
  Future<void> setMicrophoneEnabled(bool enabled) async {
    microphone.add(enabled);
  }

  @override
  Future<void> close() async {
    closes += 1;
  }
}

void main() {
  test(
    'listener subscribes to audio without microphone publish authority',
    () async {
      final transport = _Transport(role: TalkLiveRole.listener);
      final room = _Room();
      final session = TalkLiveAudioSession(
        talkId: 'talk-1',
        transport: transport,
        room: room,
        heartbeatInterval: const Duration(hours: 1),
      );

      await session.start();

      expect(room.publishMicrophone, isFalse);
      expect(session.role, TalkLiveRole.listener);
      expect(session.status, TalkLiveAudioStatus.listening);

      await session.close();
      expect(transport.disconnects, 1);
      expect(room.closes, 1);
    },
  );

  test(
    'Host publishes microphone and can mute without changing authority',
    () async {
      final transport = _Transport(
        role: TalkLiveRole.host,
        canPublishAudio: true,
      );
      final room = _Room();
      final session = TalkLiveAudioSession(
        talkId: 'talk-1',
        transport: transport,
        room: room,
        heartbeatInterval: const Duration(hours: 1),
      );

      await session.start();
      expect(room.publishMicrophone, isTrue);
      expect(session.status, TalkLiveAudioStatus.publishing);

      await session.setMuted(true);
      expect(session.muted, isTrue);
      expect(room.microphone.last, isFalse);

      await session.setMuted(false);
      expect(session.muted, isFalse);
      expect(room.microphone.last, isTrue);

      await session.close();
    },
  );

  test(
    'admitted Speaker can publish and mute only with server permission',
    () async {
      final transport = _Transport(
        role: TalkLiveRole.speaker,
        canPublishAudio: true,
      );
      final room = _Room();
      final session = TalkLiveAudioSession(
        talkId: 'talk-1',
        transport: transport,
        room: room,
        heartbeatInterval: const Duration(milliseconds: 10),
      );
      await session.start();
      expect(room.publishMicrophone, isTrue);
      await session.setMuted(true);
      expect(room.microphone.last, isFalse);
      await session.setMuted(false);
      expect(room.microphone.last, isTrue);
      transport.canPublishAudio = false;
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(session.status, TalkLiveAudioStatus.listening);
      expect(room.microphone.last, isFalse);
      await session.setMuted(false);
      expect(room.microphone.last, isFalse);
      await session.close();
    },
  );

  test(
    'Speaker JSON role preserves granted authority and unknown roles listen',
    () {
      final json = <String, dynamic>{
        'role': 'speaker',
        'canPublishAudio': true,
      };
      expect(TalkLiveSessionView.fromJson(json).role, TalkLiveRole.speaker);
      expect(
        TalkLiveSessionView.fromJson({...json, 'role': 'unknown'}).role,
        TalkLiveRole.listener,
      );
    },
  );

  test('heartbeat reconnect grace pauses Host microphone', () async {
    final transport = _Transport(
      role: TalkLiveRole.host,
      canPublishAudio: true,
    );
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
      heartbeatInterval: const Duration(milliseconds: 10),
    );

    await session.start();
    transport.heartbeatState = TalkLiveLifecycle.reconnecting;

    await Future<void>.delayed(const Duration(milliseconds: 25));

    expect(transport.heartbeats, greaterThan(0));
    expect(session.status, TalkLiveAudioStatus.reconnecting);
    expect(room.microphone, contains(false));

    await session.close();
  });

  test(
    'ended heartbeat closes media instead of keeping synthetic audio alive',
    () async {
      final transport = _Transport(role: TalkLiveRole.listener);
      final room = _Room();
      final session = TalkLiveAudioSession(
        talkId: 'talk-1',
        transport: transport,
        room: room,
        heartbeatInterval: const Duration(milliseconds: 10),
      );

      await session.start();
      transport.heartbeatState = TalkLiveLifecycle.ended;

      await Future<void>.delayed(const Duration(milliseconds: 25));

      expect(session.status, TalkLiveAudioStatus.ended);
      expect(room.closes, greaterThan(0));

      await session.close();
    },
  );
  test('failed media connection releases session and permits explicit retry', () async {
    final transport = _Transport(role: TalkLiveRole.listener);
    final room = _Room()..failNextConnect = true;
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
      heartbeatInterval: const Duration(hours: 1),
    );

    await session.start();
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(transport.disconnects, 1);
    expect(room.closes, 1);
    expect(session.errorMessage, contains('try again'));

    await session.start();
    expect(room.connects, 2);
    expect(session.status, TalkLiveAudioStatus.listening);
    expect(session.errorMessage, isNull);

    await session.close();
    expect(transport.disconnects, 2);
  });

  test('media token rejection cleans up before a successful retry', () async {
    final transport = _Transport(role: TalkLiveRole.listener)
      ..failNextToken = true;
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
      heartbeatInterval: const Duration(hours: 1),
    );

    await session.start();
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(room.connects, 0);
    expect(transport.disconnects, 1);

    await session.start();
    expect(session.status, TalkLiveAudioStatus.listening);
    expect(room.connects, 1);
    expect(session.errorMessage, isNull);

    await session.close();
    expect(transport.disconnects, 2);
  });

  test('ended session releases server lease without opening media', () async {
    final transport = _Transport(role: TalkLiveRole.listener)
      ..sessionEndedOnConnect = true;
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
      heartbeatInterval: const Duration(hours: 1),
    );

    await session.start();
    expect(session.status, TalkLiveAudioStatus.ended);
    expect(room.connects, 0);
    expect(transport.disconnects, 1);

    await session.close();
    expect(transport.disconnects, 1);
  });

  test('close during pending server connect releases late session', () async {
    final gate = Completer<void>();
    final transport = _Transport(role: TalkLiveRole.listener)
      ..connectGate = gate;
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
    );

    final starting = session.start();
    await session.close();
    gate.complete();
    await starting;

    expect(transport.disconnects, 1);
    expect(room.connects, 0);
    expect(session.status, TalkLiveAudioStatus.ended);
  });

}

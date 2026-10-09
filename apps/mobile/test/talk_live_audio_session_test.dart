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
  DateTime? credentialsExpireAt;
  String credentialUrl = 'wss://live.example.test';
  Completer<void>? connectGate;
  Completer<void>? mediaTokenGate;
  Completer<void>? mediaTokenEntered;
  Completer<void>? heartbeatGate;
  Completer<void>? heartbeatEntered;
  int heartbeats = 0;
  bool failHeartbeat = false;
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
    if (heartbeatEntered != null && !heartbeatEntered!.isCompleted) {
      heartbeatEntered!.complete();
    }
    await heartbeatGate?.future;
    if (failHeartbeat) throw StateError('Simulated network heartbeat failure');
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
    if (mediaTokenEntered != null && !mediaTokenEntered!.isCompleted) {
      mediaTokenEntered!.complete();
    }
    await mediaTokenGate?.future;
    if (failNextToken) {
      failNextToken = false;
      throw StateError('Simulated media-token rejection');
    }
    return TalkLiveMediaCredentials(
      serverUrl: credentialUrl,
      participantToken: 'token',
      roomName: talkId,
      participantIdentity: 'user:' + sessionId,
      expiresAt: credentialsExpireAt ?? DateTime(2030),
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
  bool failNextMicrophone = false;
  Completer<void>? mediaConnectGate;
  Completer<void>? mediaConnectEntered;
  int connects = 0;

  @override
  Future<void> connect({
    required TalkLiveMediaCredentials credentials,
    required bool publishMicrophone,
  }) async {
    connects += 1;
    mediaConnectEntered?.complete();
    await mediaConnectGate?.future;
    if (failNextConnect) {
      failNextConnect = false;
      throw StateError('Simulated LiveKit connection failure');
    }
    this.publishMicrophone = publishMicrophone;
  }

  @override
  Future<void> setMicrophoneEnabled(bool enabled) async {
    microphone.add(enabled);
    if (failNextMicrophone) {
      failNextMicrophone = false;
      throw StateError('Simulated microphone hardware failure');
    }
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

  test('close while media connects tears down late room without duplicate disconnect', () async {
    final gate = Completer<void>();
    final transport = _Transport(role: TalkLiveRole.host, canPublishAudio: true);
    final entered = Completer<void>();
    final room = _Room()
      ..mediaConnectGate = gate
      ..mediaConnectEntered = entered;
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
    );

    final starting = session.start();
    await entered.future.timeout(const Duration(seconds: 2));
    await session.close();
    gate.complete();
    await starting;

    expect(transport.disconnects, 1);
    expect(room.closes, 2);
    expect(session.status, TalkLiveAudioStatus.ended);
  });

  test('expired media token never opens LiveKit and can recover', () async {
    final transport = _Transport(role: TalkLiveRole.listener)
      ..credentialsExpireAt = DateTime(2020);
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
    );

    await session.start();
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(room.connects, 0);
    expect(transport.disconnects, 1);

    transport.credentialsExpireAt = DateTime(2030);
    await session.start();
    expect(session.status, TalkLiveAudioStatus.listening);
    expect(room.connects, 1);
    await session.close();
  });

  test('invalid websocket endpoint cannot publish microphone', () async {
    final transport = _Transport(
      role: TalkLiveRole.host,
      canPublishAudio: true,
    )..credentialUrl = 'https://invalid.example.test';
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1',
      transport: transport,
      room: room,
    );

    await session.start();
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(room.connects, 0);
    expect(transport.disconnects, 1);
    await session.close();
  });

  test('heartbeat failure revokes host microphone publish authority', () async {
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
    expect(session.status, TalkLiveAudioStatus.publishing);
    transport.failHeartbeat = true;
    await Future<void>.delayed(const Duration(milliseconds: 35));
    expect(transport.heartbeats, greaterThan(0));
    expect(session.status, TalkLiveAudioStatus.reconnecting);
    expect(room.microphone, contains(false));

    final changesBefore = room.microphone.length;
    await session.setMuted(false);
    expect(room.microphone.length, changesBefore);
    await session.close();
  });

  test('close during late media-token response does not reopen media or leak session',
      () async {
    final tokenGate = Completer<void>();
    final entered = Completer<void>();
    final transport = _Transport(role: TalkLiveRole.host, canPublishAudio: true)
      ..mediaTokenGate = tokenGate
      ..mediaTokenEntered = entered;
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1', transport: transport, room: room,
      heartbeatInterval: const Duration(hours: 1),
    );
    final starting = session.start();
    await entered.future.timeout(const Duration(seconds: 2));
    await session.close();
    tokenGate.complete();
    await starting;
    expect(session.status, TalkLiveAudioStatus.ended);
    expect(transport.disconnects, 1);
    expect(room.connects, 0);
  });

  test('microphone control failure revokes lease and allows explicit safe rejoin',
      () async {
    final transport = _Transport(role: TalkLiveRole.host, canPublishAudio: true);
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1', transport: transport, room: room,
      heartbeatInterval: const Duration(hours: 1),
    );
    await session.start();
    expect(session.status, TalkLiveAudioStatus.publishing);
    room.failNextMicrophone = true;
    await session.setMuted(true);
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(session.errorMessage, contains('Rejoin'));
    expect(session.muted, isTrue);
    expect(room.closes, 1);
    expect(transport.disconnects, 1);

    final updates = room.microphone.length;
    await session.setMuted(false);
    expect(room.microphone.length, updates);
    await session.start();
    expect(session.status, TalkLiveAudioStatus.publishing);
    expect(room.connects, 2);
    await session.close();
    expect(transport.disconnects, 2);
  });

  test('failed microphone shutdown during server reconnect tears down media',
      () async {
    final transport = _Transport(role: TalkLiveRole.host, canPublishAudio: true);
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1', transport: transport, room: room,
      heartbeatInterval: const Duration(milliseconds: 10),
    );
    await session.start();
    room.failNextMicrophone = true;
    transport.heartbeatState = TalkLiveLifecycle.reconnecting;
    await Future<void>.delayed(const Duration(milliseconds: 35));
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(session.errorMessage, contains('Rejoin'));
    expect(room.closes, 1);
    expect(transport.disconnects, 1);
    await session.close();
  });

  test('late heartbeat cannot restore microphone grants after mute failure',
      () async {
    final entered = Completer<void>();
    final heartbeatGate = Completer<void>();
    final transport = _Transport(role: TalkLiveRole.host, canPublishAudio: true)
      ..heartbeatGate = heartbeatGate
      ..heartbeatEntered = entered;
    final room = _Room();
    final session = TalkLiveAudioSession(
      talkId: 'talk-1', transport: transport, room: room,
      heartbeatInterval: const Duration(milliseconds: 10),
    );
    await session.start();
    await entered.future.timeout(const Duration(seconds: 2));
    room.failNextMicrophone = true;
    await session.setMuted(true);
    expect(session.status, TalkLiveAudioStatus.failed);
    heartbeatGate.complete();
    await Future<void>.delayed(const Duration(milliseconds: 15));
    expect(session.status, TalkLiveAudioStatus.failed);
    expect(room.microphone, contains(false)); // revoke attempted the hardware mute
    final updates = room.microphone.length;
    await session.setMuted(false);
    expect(room.microphone.length, updates);
    await session.close();
    expect(transport.disconnects, 1);
  });

}


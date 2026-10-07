import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_replay_playback.dart';

class _Transport implements TalkReplayPlaybackTransport {
  int loads = 0;
  bool fail = false;

  @override
  Future<TalkReplayPlaybackCredentials> load(String talkId) async {
    loads += 1;
    if (fail) throw StateError('unavailable');
    return TalkReplayPlaybackCredentials(
      url: 'https://signed.example/replay-$loads.ogg',
      expiresAt: DateTime(2026, 10, 7, 12),
      contentType: 'audio/ogg',
    );
  }
}

class _Player implements TalkReplayAudioPlayer {
  final positionsController = StreamController<Duration>.broadcast(sync: true);
  final durationsController =
      StreamController<Duration?>.broadcast(sync: true);
  final statesController =
      StreamController<TalkReplayPlayerState>.broadcast(sync: true);
  final errorsController = StreamController<Object>.broadcast(sync: true);

  int loads = 0;
  int plays = 0;
  int pauses = 0;
  int closes = 0;
  String? lastUrl;
  Duration? lastSeek;

  @override
  Stream<Duration> get positions => positionsController.stream;

  @override
  Stream<Duration?> get durations => durationsController.stream;

  @override
  Stream<TalkReplayPlayerState> get states => statesController.stream;

  @override
  Stream<Object> get errors => errorsController.stream;

  @override
  Future<Duration?> load(String url) async {
    loads += 1;
    lastUrl = url;
    durationsController.add(const Duration(minutes: 2));
    return const Duration(minutes: 2);
  }

  @override
  Future<void> play() async {
    plays += 1;
    statesController.add(TalkReplayPlayerState.playing);
  }

  @override
  Future<void> pause() async {
    pauses += 1;
    statesController.add(TalkReplayPlayerState.paused);
  }

  @override
  Future<void> seek(Duration position) async {
    lastSeek = position;
    positionsController.add(position);
  }

  @override
  Future<void> close() async {
    closes += 1;
    await positionsController.close();
    await durationsController.close();
    await statesController.close();
    await errorsController.close();
  }
}

void main() {
  test('first Play loads a fresh signed URL and Pause does not refetch', () async {
    final transport = _Transport();
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-1',
      transport: transport,
      player: player,
    );

    expect(session.snapshot.status, TalkReplayPlaybackStatus.idle);
    await session.toggle();

    expect(transport.loads, 1);
    expect(player.loads, 1);
    expect(player.plays, 1);
    expect(player.lastUrl, 'https://signed.example/replay-1.ogg');
    expect(session.snapshot.status, TalkReplayPlaybackStatus.playing);

    await session.toggle();

    expect(player.pauses, 1);
    expect(transport.loads, 1);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.paused);

    await session.close();
    expect(player.closes, 1);
  });

  test('completed replay fetches a new signed URL before replaying', () async {
    final transport = _Transport();
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-1',
      transport: transport,
      player: player,
    );

    await session.toggle();
    player.statesController.add(TalkReplayPlayerState.completed);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.completed);

    await session.toggle();

    expect(transport.loads, 2);
    expect(player.lastUrl, 'https://signed.example/replay-2.ogg');
    await session.close();
  });

  test('Retry fetches fresh credentials after failure', () async {
    final transport = _Transport()..fail = true;
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-1',
      transport: transport,
      player: player,
    );

    await session.toggle();
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    expect(transport.loads, 1);

    transport.fail = false;
    await session.retry();

    expect(transport.loads, 2);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.playing);
    await session.close();
  });

  test('seek uses the loaded replay duration', () async {
    final transport = _Transport();
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-1',
      transport: transport,
      player: player,
    );

    await session.toggle();
    await session.seekTo(.5);

    expect(player.lastSeek, const Duration(minutes: 1));
    await session.close();
  });

  test('playback envelope rejects non-OGG or malformed credentials', () {
    expect(
      () => TalkReplayPlaybackCredentials.fromJson({
        'url': 'https://signed.example/replay.ogg',
        'expiresAt': '2026-10-07T12:00:00Z',
        'contentType': 'audio/ogg',
      }),
      returnsNormally,
    );
    expect(
      () => TalkReplayPlaybackCredentials.fromJson({
        'url': '',
        'expiresAt': 'not-a-date',
        'contentType': 'audio/mp3',
      }),
      throwsFormatException,
    );
  });
}

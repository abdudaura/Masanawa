import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_replay_playback.dart';

class _Transport implements TalkReplayPlaybackTransport {
  int loads = 0;
  bool fail = false;
  DateTime? expiry;

  @override
  Future<TalkReplayPlaybackCredentials> load(String talkId) async {
    loads += 1;
    if (fail) throw StateError('unavailable');
    return TalkReplayPlaybackCredentials(
      url: 'https://signed.example/replay-$loads.ogg',
      expiresAt: expiry ?? DateTime.now().toUtc().add(const Duration(minutes: 5)),
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
  Completer<void>? holdPlay;
  Completer<void>? holdSeek;
  Completer<void>? startedSeek;

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
    if (holdPlay != null) await holdPlay!.future;
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
    startedSeek?.complete();
    if (holdSeek != null) await holdSeek!.future;
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
      canAccess: () => true,
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
      canAccess: () => true,
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
      canAccess: () => true,
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
      canAccess: () => true,
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
  test('paused expired playback reacquires server permission and seeks to saved position', () async {
    var clock = DateTime.utc(2026, 10, 7, 10);
    final transport = _Transport()
      ..expiry = clock.add(const Duration(minutes: 5));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      canAccess: () => true,
      talkId: 'talk-1', transport: transport, player: player,
      now: () => clock,
    );
    await session.toggle();
    await session.seekTo(.5);
    await session.toggle();
    expect(session.snapshot.status, TalkReplayPlaybackStatus.paused);
    clock = clock.add(const Duration(minutes: 6));
    transport.expiry = clock.add(const Duration(minutes: 5));

    await session.toggle();

    expect(transport.loads, 2);
    expect(player.loads, 2);
    expect(player.lastSeek, const Duration(minutes: 1));
    expect(player.plays, 2);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.playing);
    await session.close();
  });

  test('server revocation after signed link expiry fails closed without replaying cached URL', () async {
    var clock = DateTime.utc(2026, 10, 7, 10);
    final transport = _Transport()
      ..expiry = clock.add(const Duration(minutes: 2));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      canAccess: () => true,
      talkId: 'talk-1', transport: transport, player: player,
      now: () => clock,
    );
    await session.toggle();
    await session.toggle();
    clock = clock.add(const Duration(minutes: 4));
    transport.fail = true;

    await session.toggle();

    expect(transport.loads, 2);
    expect(player.plays, 1);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    transport.fail = false;
    transport.expiry = clock.add(const Duration(minutes: 5));
    await session.retry();
    expect(player.plays, 2);
    await session.close();
  });

  test('expired credentials are never handed to the audio player', () async {
    final clock = DateTime.utc(2026, 10, 7, 10);
    final transport = _Transport()..expiry = clock.add(const Duration(seconds: 10));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      canAccess: () => true,
      talkId: 'talk-1', transport: transport, player: player,
      now: () => clock,
    );
    await session.toggle();
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    expect(player.loads, 0);
    expect(player.plays, 0);
    await session.close();
  });

  test('seek on expired authorization refreshes but never autoplays a paused recording', () async {
    var clock = DateTime.utc(2026, 10, 7, 10);
    final transport = _Transport()
      ..expiry = clock.add(const Duration(minutes: 2));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      canAccess: () => true,
      talkId: 'talk-1', transport: transport, player: player,
      now: () => clock,
    );
    await session.toggle();
    await session.toggle();
    clock = clock.add(const Duration(minutes: 4));
    transport.expiry = clock.add(const Duration(minutes: 5));
    await session.seekTo(.25);
    expect(transport.loads, 2);
    expect(player.lastSeek, const Duration(seconds: 30));
    expect(player.plays, 1);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.paused);
    await session.close();
  });

  test('playback does not lock pause while the audio player future is pending', () async {
    final transport = _Transport();
    final player = _Player()..holdPlay = Completer<void>();
    final session = TalkReplayPlaybackSession(
      canAccess: () => true,
      talkId: 'talk-1', transport: transport, player: player,
    );
    await session.toggle();
    await session.toggle();
    expect(player.pauses, 1);
    player.holdPlay!.complete();
    await session.close();
  });

  test('only HTTPS credential URLs without embedded user information or fragments are accepted', () {
    for (final url in [
      'http://signed.example/replay.ogg',
      'https://user:pass@signed.example/replay.ogg',
      'https://signed.example/replay.ogg#fragment',
      'file:///recording.ogg',
    ]) {
      expect(
        () => TalkReplayPlaybackCredentials.fromJson({
          'url': url,
          'expiresAt': '2026-10-07T12:00:00Z',
          'contentType': 'audio/ogg',
        }),
        throwsFormatException,
      );
    }
  });

  test('revocation during refreshed paused seek never republishes a signed replay link', () async {
    var clock = DateTime.utc(2026, 10, 7, 10);
    var authorized = true;
    final transport = _Transport()
      ..expiry = clock.add(const Duration(minutes: 5));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-private',
      transport: transport,
      player: player,
      now: () => clock,
      canAccess: () => authorized,
    );
    await session.toggle();
    await session.seekTo(.5);
    await session.toggle();
    clock = clock.add(const Duration(minutes: 6));
    transport.expiry = clock.add(const Duration(minutes: 5));
    player.holdSeek = Completer<void>();
    player.startedSeek = Completer<void>();

    final pending = session.seekTo(.25);
    await player.startedSeek!.future;
    authorized = false; // Account switch while native player is seeking.
    player.holdSeek!.complete();
    await pending;

    expect(transport.loads, 2);
    expect(player.lastSeek, const Duration(seconds: 30));
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    expect(player.plays, 1);
    expect(player.pauses, greaterThanOrEqualTo(2));
    await session.close();
  });

  test('signature expiry during refreshed paused seek fails without cached playback', () async {
    var clock = DateTime.utc(2026, 10, 7, 10);
    final transport = _Transport()
      ..expiry = clock.add(const Duration(minutes: 5));
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-private',
      transport: transport,
      player: player,
      now: () => clock,
      canAccess: () => true,
    );
    await session.toggle();
    await session.seekTo(.5);
    await session.toggle();
    clock = clock.add(const Duration(minutes: 6));
    transport.expiry = clock.add(const Duration(minutes: 5));
    player.holdSeek = Completer<void>();
    player.startedSeek = Completer<void>();

    final pending = session.seekTo(.25);
    await player.startedSeek!.future;
    clock = clock.add(const Duration(minutes: 5)); // Signed link expires mid-seek.
    player.holdSeek!.complete();
    await pending;

    expect(transport.loads, 2);
    expect(player.lastSeek, const Duration(seconds: 30));
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    expect(player.plays, 1);
    await session.close();
  });

  test('account switch revokes even a still-valid cached replay link', () async {
    var authorized = true;
    final transport = _Transport();
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-private', transport: transport, player: player,
      canAccess: () => authorized,
    );
    await session.toggle();
    await session.toggle();
    expect(player.plays, 1);
    authorized = false;
    await session.toggle();
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    expect(player.plays, 1);
    expect(transport.loads, 1);
    expect(player.pauses, greaterThanOrEqualTo(2));
    await session.close();
  });

  test('account revoked during pending credential fetch cannot load or play its result', () async {
    var authorized = true;
    final release = Completer<void>();
    final transport = _DelayedTransport(release);
    final player = _Player();
    final session = TalkReplayPlaybackSession(
      talkId: 'talk-private', transport: transport, player: player,
      canAccess: () => authorized,
    );
    final pending = session.toggle();
    authorized = false;
    release.complete();
    await pending;
    expect(player.loads, 0);
    expect(player.plays, 0);
    expect(session.snapshot.status, TalkReplayPlaybackStatus.failed);
    await session.close();
  });

}

class _DelayedTransport implements TalkReplayPlaybackTransport {
  _DelayedTransport(this.release);
  final Completer<void> release;

  @override
  Future<TalkReplayPlaybackCredentials> load(String talkId) async {
    await release.future;
    return TalkReplayPlaybackCredentials(
      url: 'https://signed.example/protected.ogg',
      expiresAt: DateTime.now().toUtc().add(const Duration(minutes: 5)),
      contentType: 'audio/ogg',
    );
  }
}


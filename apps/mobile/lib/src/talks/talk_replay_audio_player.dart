import 'package:just_audio/just_audio.dart';

import 'talk_replay_playback.dart';

class JustAudioTalkReplayPlayer implements TalkReplayAudioPlayer {
  JustAudioTalkReplayPlayer() : _player = AudioPlayer();

  final AudioPlayer _player;

  @override
  Stream<Duration> get positions => _player.positionStream;

  @override
  Stream<Duration?> get durations => _player.durationStream;

  @override
  Stream<TalkReplayPlayerState> get states =>
      _player.playerStateStream.map((state) {
        if (state.processingState == ProcessingState.completed) {
          return TalkReplayPlayerState.completed;
        }
        return state.playing
            ? TalkReplayPlayerState.playing
            : TalkReplayPlayerState.paused;
      }).distinct();

  @override
  Stream<Object> get errors => _player.errorStream.cast<Object>();

  @override
  Future<Duration?> load(String url) => _player.setUrl(url);

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> close() => _player.dispose();
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../state/story_radio_state.dart';
import '../../story_radio/story_radio.dart';
import '../../theme/masanawa_theme.dart';

class StoryRadioPlayer extends ConsumerStatefulWidget {
  const StoryRadioPlayer({
    super.key,
    required this.episode,
    this.initialPositionSeconds = 0,
    this.onNextEpisode,
  });

  final StoryRadioEpisode episode;
  final int initialPositionSeconds;
  final VoidCallback? onNextEpisode;

  @override
  ConsumerState<StoryRadioPlayer> createState() => _StoryRadioPlayerState();
}

class _StoryRadioPlayerState extends ConsumerState<StoryRadioPlayer> {
  late final AudioPlayer _player;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<PlayerState>? _stateSubscription;
  int _lastSavedSecond = -1;
  String? _error;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _prepare();
  }

  Future<void> _prepare() async {
    try {
      await _player.setUrl(widget.episode.audioUrl);
      final initial = widget.initialPositionSeconds
          .clamp(0, widget.episode.durationSeconds)
          .toInt();
      if (initial > 0) {
        await _player.seek(Duration(seconds: initial));
      }

      _positionSubscription = _player.positionStream.listen((position) {
        if (!mounted) return;
        setState(() {});
        final seconds = position.inSeconds
            .clamp(0, widget.episode.durationSeconds)
            .toInt();
        if (seconds > 0 &&
            seconds != _lastSavedSecond &&
            seconds % 15 == 0) {
          _lastSavedSecond = seconds;
          unawaited(
            ref.read(storyRadioProvider.notifier).saveProgress(
                  episode: widget.episode,
                  positionSeconds: seconds,
                  completed: false,
                ),
          );
        }
      });

      _stateSubscription = _player.playerStateStream.listen((state) {
        if (!mounted) return;
        setState(() {});
        if (state.processingState == ProcessingState.completed) {
          unawaited(
            ref.read(storyRadioProvider.notifier).saveProgress(
                  episode: widget.episode,
                  positionSeconds: widget.episode.durationSeconds,
                  completed: true,
                ),
          );
        }
      });

      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'This episode could not be played.';
        });
      }
    }
  }

  Future<void> _toggle() async {
    if (_player.playing) {
      await _player.pause();
      await _persistNow();
    } else {
      if (_player.processingState == ProcessingState.completed) {
        await _player.seek(Duration.zero);
      }
      await _player.play();
    }
    if (mounted) setState(() {});
  }

  Future<void> _persistNow() async {
    final seconds = _player.position.inSeconds
        .clamp(0, widget.episode.durationSeconds)
        .toInt();
    await ref.read(storyRadioProvider.notifier).saveProgress(
          episode: widget.episode,
          positionSeconds: seconds,
          completed: _player.processingState == ProcessingState.completed,
        );
  }

  Future<void> _seek(double value) async {
    final seconds = value
        .round()
        .clamp(0, widget.episode.durationSeconds)
        .toInt();
    await _player.seek(Duration(seconds: seconds));
    if (mounted) setState(() {});
  }

  Future<void> _setSpeed(double speed) async {
    await _player.setSpeed(speed);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _stateSubscription?.cancel();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          _error!,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted),
        ),
      );
    }

    final position = _player.position.inSeconds
        .clamp(0, widget.episode.durationSeconds)
        .toInt();
    final completed =
        _player.processingState == ProcessingState.completed;

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(20, 16, 20, 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: u.structuralBorder,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 22),
          CircleAvatar(
            radius: 38,
            backgroundColor: u.brand.withValues(alpha: .10),
            child: Icon(
              Icons.auto_stories_rounded,
              color: u.brand,
              size: 34,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            widget.episode.title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'Season ' +
                widget.episode.seasonNumber.toString() +
                ' · Episode ' +
                widget.episode.episodeNumber.toString(),
            style: TextStyle(
              color: u.textMuted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 22),
          Slider(
            value: position.toDouble(),
            max: widget.episode.durationSeconds.toDouble(),
            onChanged: (value) => unawaited(_seek(value)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _format(position),
                style: TextStyle(color: u.textMuted, fontSize: 11),
              ),
              Text(
                _format(widget.episode.durationSeconds),
                style: TextStyle(color: u.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              PopupMenuButton<double>(
                tooltip: 'Playback speed',
                initialValue: _player.speed,
                onSelected: (speed) => unawaited(_setSpeed(speed)),
                itemBuilder: (context) => const [
                  PopupMenuItem(value: 1.0, child: Text('1×')),
                  PopupMenuItem(value: 1.25, child: Text('1.25×')),
                  PopupMenuItem(value: 1.5, child: Text('1.5×')),
                  PopupMenuItem(value: 2.0, child: Text('2×')),
                ],
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    _player.speed.toStringAsFixed(
                          _player.speed == _player.speed.roundToDouble()
                              ? 0
                              : 2,
                        ) +
                        '×',
                    style: TextStyle(
                      color: u.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              IconButton.filled(
                onPressed: _toggle,
                iconSize: 34,
                padding: const EdgeInsets.all(16),
                icon: Icon(
                  _player.playing
                      ? Icons.pause_rounded
                      : completed
                          ? Icons.replay_rounded
                          : Icons.play_arrow_rounded,
                ),
                tooltip: _player.playing ? 'Pause' : 'Play',
              ),
              const SizedBox(width: 16),
              IconButton(
                onPressed: widget.episode.nextEpisodeId == null
                    ? null
                    : widget.onNextEpisode,
                icon: const Icon(Icons.skip_next_rounded),
                tooltip: 'Next episode',
              ),
            ],
          ),
          if (completed && widget.episode.nextEpisodeId != null) ...[
            const SizedBox(height: 12),
            FilledButton.tonalIcon(
              onPressed: widget.onNextEpisode,
              icon: const Icon(Icons.skip_next_rounded),
              label: const Text('Next episode'),
            ),
          ],
        ],
      ),
    );
  }

  String _format(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return minutes.toString() +
        ':' +
        seconds.toString().padLeft(2, '0');
  }
}

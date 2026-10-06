import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/story_radio_state.dart';
import '../../story_radio/story_radio.dart';
import '../../theme/masanawa_theme.dart';
import 'story_radio_player.dart';

class StoryRadioEpisodeScreen extends ConsumerStatefulWidget {
  const StoryRadioEpisodeScreen({
    super.key,
    required this.seriesId,
    required this.episodeId,
    required this.onOpenEpisode,
  });

  final String seriesId;
  final String episodeId;
  final void Function(String seriesId, String episodeId) onOpenEpisode;

  @override
  ConsumerState<StoryRadioEpisodeScreen> createState() =>
      _StoryRadioEpisodeScreenState();
}

class _StoryRadioEpisodeScreenState
    extends ConsumerState<StoryRadioEpisodeScreen> {
  StoryRadioEpisode? _episode;
  StoryListeningProgress? _progress;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void didUpdateWidget(covariant StoryRadioEpisodeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.seriesId == widget.seriesId &&
        oldWidget.episodeId == widget.episodeId) {
      return;
    }
    setState(() {
      _episode = null;
      _progress = null;
      _error = null;
    });
    Future.microtask(_load);
  }

  Future<void> _load() async {
    try {
      final series = await ref
          .read(storyRadioProvider.notifier)
          .loadSeries(widget.seriesId);
      if (!mounted) return;
      final episode = series?.episodeById(widget.episodeId);
      if (episode == null) {
        setState(() => _error = 'This episode is not available.');
        return;
      }
      final home = ref.read(storyRadioProvider).home;
      final progress = home?.continueProgress?.episodeId == episode.id
          ? home!.continueProgress
          : null;
      setState(() {
        _episode = episode;
        _progress = progress;
      });
      await ref.read(storyRadioProvider.notifier).loadReactions(episode.id);
    } catch (_) {
      if (mounted) setState(() => _error = 'This episode could not be loaded.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final episode = _episode;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Story Radio')),
      body: episode == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: u.textMuted),
                      ),
                    ),
            )
          : Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: StoryRadioPlayer(
                  key: ValueKey(episode.id),
                  episode: episode,
                  initialPositionSeconds: _progress?.positionSeconds ?? 0,
                  onNextEpisode: episode.nextEpisodeId == null
                      ? null
                      : () => widget.onOpenEpisode(
                            episode.seriesId,
                            episode.nextEpisodeId!,
                          ),
                ),
              ),
            ),
    );
  }
}

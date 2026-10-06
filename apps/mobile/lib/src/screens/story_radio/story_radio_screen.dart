import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/story_radio_state.dart';
import '../../story_radio/story_radio.dart';
import '../../theme/masanawa_theme.dart';

class StoryRadioScreen extends ConsumerStatefulWidget {
  const StoryRadioScreen({
    super.key,
    this.onOpenSeries,
    this.onContinue,
  });

  final void Function(StoryRadioSeriesCard series)? onOpenSeries;
  final void Function(StoryListeningProgress progress)? onContinue;

  @override
  ConsumerState<StoryRadioScreen> createState() => _StoryRadioScreenState();
}

class _StoryRadioScreenState extends ConsumerState<StoryRadioScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(storyRadioProvider.notifier).loadHome());
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final state = ref.watch(storyRadioProvider);
    final home = state.home;

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Story Radio')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(storyRadioProvider.notifier).loadHome(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Text(
              'Listen to stories, one episode at a time.',
              style: TextStyle(color: u.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 18),
            if (state.loadingHome && home == null)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (home == null)
              _EmptyState(message: state.error ?? 'No published stories yet.')
            else ...[
              if (home.continueProgress != null) ...[
                const _SectionTitle(title: 'Continue listening'),
                const SizedBox(height: 8),
                _ContinueCard(
                  progress: home.continueProgress!,
                  onTap: () =>
                      widget.onContinue?.call(home.continueProgress!),
                ),
                const SizedBox(height: 20),
              ],
              if (home.featured != null) ...[
                const _SectionTitle(title: 'Featured'),
                const SizedBox(height: 8),
                _SeriesTile(
                  series: home.featured!,
                  featured: true,
                  onTap: () =>
                      widget.onOpenSeries?.call(home.featured!),
                ),
                const SizedBox(height: 20),
              ],
              const _SectionTitle(title: 'Series'),
              const SizedBox(height: 8),
              if (home.series.isEmpty)
                const _EmptyState(message: 'No published series yet.')
              else
                for (final series in home.series)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: _SeriesTile(
                      series: series,
                      onTap: () => widget.onOpenSeries?.call(series),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class StoryRadioSeriesScreen extends ConsumerStatefulWidget {
  const StoryRadioSeriesScreen({
    super.key,
    required this.seriesId,
    this.onPlayEpisode,
  });

  final String seriesId;
  final void Function(StoryRadioEpisode episode)? onPlayEpisode;

  @override
  ConsumerState<StoryRadioSeriesScreen> createState() =>
      _StoryRadioSeriesScreenState();
}

class _StoryRadioSeriesScreenState
    extends ConsumerState<StoryRadioSeriesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(storyRadioProvider.notifier).loadSeries(widget.seriesId),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final state = ref.watch(storyRadioProvider);
    final series = state.seriesById[widget.seriesId];
    final loading = state.loadingSeriesId == widget.seriesId;

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Story Radio')),
      body: series == null
          ? Center(
              child: loading
                  ? const CircularProgressIndicator()
                  : Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        state.error ?? 'This series is not available.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: u.textMuted),
                      ),
                    ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _SeriesHeader(series: series),
                const SizedBox(height: 22),
                const _SectionTitle(title: 'Episodes'),
                const SizedBox(height: 8),
                for (final episode in series.episodes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: _EpisodeTile(
                      episode: episode,
                      reactions: state.reactionsByEpisodeId[episode.id],
                      onPlay: () =>
                          widget.onPlayEpisode?.call(episode),
                      onReact: (reaction) => ref
                          .read(storyRadioProvider.notifier)
                          .react(
                            episodeId: episode.id,
                            reaction: reaction,
                          ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Text(
      title,
      style: TextStyle(
        color: u.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _ContinueCard extends StatelessWidget {
  const _ContinueCard({
    required this.progress,
    required this.onTap,
  });

  final StoryListeningProgress progress;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            border: Border.all(color: u.structuralBorder),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: u.brand.withValues(alpha: .12),
                child: Icon(Icons.play_arrow_rounded, color: u.brand),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      progress.completed
                          ? 'Play next episode'
                          : 'Resume episode',
                      style: TextStyle(
                        color: u.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: progress.fraction),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: u.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeriesTile extends StatelessWidget {
  const _SeriesTile({
    required this.series,
    required this.onTap,
    this.featured = false,
  });

  final StoryRadioSeriesCard series;
  final VoidCallback onTap;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(featured ? 20 : 16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(featured ? 20 : 16),
        child: Container(
          padding: EdgeInsets.all(featured ? 16 : 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(featured ? 20 : 16),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: featured ? 30 : 24,
                backgroundColor: u.brand.withValues(alpha: .10),
                child: Icon(
                  featured
                      ? Icons.auto_stories_rounded
                      : Icons.headphones_rounded,
                  color: u.brand,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      series.title,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: featured ? 16 : 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (series.description.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        series.description,
                        maxLines: featured ? 2 : 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      series.episodeCount.toString() +
                          ' episodes · ' +
                          series.language,
                      style: TextStyle(
                        color: u.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: u.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeriesHeader extends StatelessWidget {
  const _SeriesHeader({required this.series});

  final StoryRadioSeries series;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          height: 150,
          decoration: BoxDecoration(
            color: u.brand.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Icon(
            Icons.auto_stories_rounded,
            size: 56,
            color: u.brand,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          series.title,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          series.episodes.length.toString() +
              ' episodes · ' +
              series.language,
          style: TextStyle(color: u.textMuted, fontSize: 12),
        ),
        if (series.description.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            series.description,
            style: TextStyle(color: u.textMuted, height: 1.45),
          ),
        ],
        if (series.audienceLabel != null) ...[
          const SizedBox(height: 10),
          Text(
            series.audienceLabel!,
            style: TextStyle(color: u.textMuted, fontSize: 11),
          ),
        ],
      ],
    );
  }
}

class _EpisodeTile extends StatelessWidget {
  const _EpisodeTile({
    required this.episode,
    required this.onPlay,
    required this.onReact,
    this.reactions,
  });

  final StoryRadioEpisode episode;
  final VoidCallback onPlay;
  final void Function(StoryReaction reaction) onReact;
  final StoryReactionSummary? reactions;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final minutes = (episode.durationSeconds / 60).ceil();

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton.filledTonal(
            onPressed: onPlay,
            icon: const Icon(Icons.play_arrow_rounded),
            tooltip: 'Play episode',
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Season ' +
                      episode.seasonNumber.toString() +
                      ' · Episode ' +
                      episode.episodeNumber.toString(),
                  style: TextStyle(
                    color: u.textMuted,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  episode.title,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (episode.description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    episode.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: u.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
                const SizedBox(height: 7),
                Text(
                  minutes.toString() + ' min',
                  style: TextStyle(
                    color: u.textMuted,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuButton<StoryReaction>(
            tooltip: 'React',
            initialValue: reactions?.mine,
            onSelected: onReact,
            itemBuilder: (context) => const [
              PopupMenuItem(
                value: StoryReaction.like,
                child: Text('👍 Like'),
              ),
              PopupMenuItem(
                value: StoryReaction.love,
                child: Text('❤️ Love'),
              ),
              PopupMenuItem(
                value: StoryReaction.funny,
                child: Text('😄 Funny'),
              ),
              PopupMenuItem(
                value: StoryReaction.thoughtful,
                child: Text('💭 Thoughtful'),
              ),
            ],
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Icon(
                reactions?.mine == null
                    ? Icons.add_reaction_outlined
                    : Icons.add_reaction,
                color: reactions?.mine == null ? u.textMuted : u.brand,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
      child: Column(
        children: [
          Icon(Icons.headphones_outlined, size: 40, color: u.textMuted),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted),
          ),
        ],
      ),
    );
  }
}

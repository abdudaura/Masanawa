import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';

class TalkHomeScreen extends ConsumerWidget {
  const TalkHomeScreen({
    super.key,
    this.onOpenTalk,
    this.onOpenSearch,
    this.onOpenGwani,
    this.embeddedInShell = false,
  });

  final void Function(TalkDiscoveryItem talk)? onOpenTalk;
  final VoidCallback? onOpenSearch;
  final VoidCallback? onOpenGwani;
  /// Hide the inner toolbar when the shared root header is visible.
  final bool embeddedInShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: u.surfaceCard,
        appBar: AppBar(
          toolbarHeight: embeddedInShell ? 0 : null,
          primary: !embeddedInShell,
          title: embeddedInShell ? null : const Text('Masanawa'),
          actions: embeddedInShell ? null : [
            IconButton(
              tooltip: 'Search',
              onPressed: onOpenSearch,
              icon: const Icon(Icons.search_rounded),
            ),
            IconButton(
              tooltip: 'Ask Gwani',
              onPressed: onOpenGwani,
              icon: const Icon(Icons.graphic_eq_rounded),
            ),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Explore'),
              Tab(text: 'Live Talks'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _TalkFeed(
              feed: TalkFeedKind.explore,
              onOpenTalk: onOpenTalk,
              bottomInset: embeddedInShell ? 100 : 28,
            ),
            _TalkFeed(
              feed: TalkFeedKind.live,
              onOpenTalk: onOpenTalk,
              bottomInset: embeddedInShell ? 100 : 28,
            ),
          ],
        ),
      ),
    );
  }
}

class _TalkFeed extends ConsumerWidget {
  const _TalkFeed({
    required this.feed,
    required this.onOpenTalk,
    required this.bottomInset,
  });

  final TalkFeedKind feed;
  final void Function(TalkDiscoveryItem talk)? onOpenTalk;
  final double bottomInset;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncTalks = ref.watch(talkFeedProvider(feed));
    final u = context.masanawa;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(talkFeedProvider(feed));
        await ref.read(talkFeedProvider(feed).future);
      },
      child: asyncTalks.when(
        loading: () => ListView(
          key: ValueKey('talk-feed-' + feed.name),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(12, 12, 12, bottomInset),
          children: const [
            _TalkCardSkeleton(),
            SizedBox(height: 12),
            _TalkCardSkeleton(),
          ],
        ),
        error: (_, __) => ListView(
          key: ValueKey('talk-feed-' + feed.name),
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(24, 80, 24, bottomInset),
          children: [
            Icon(Icons.wifi_off_rounded, color: u.textMuted, size: 38),
            const SizedBox(height: 12),
            Text(
              'Couldn’t load Talks right now.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Pull down to try again.',
              textAlign: TextAlign.center,
              style: TextStyle(color: u.textMuted),
            ),
          ],
        ),
        data: (talks) {
          if (talks.isEmpty) {
            return ListView(
              key: ValueKey('talk-feed-' + feed.name),
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(24, 96, 24, bottomInset),
              children: [
                Icon(
                  feed == TalkFeedKind.live
                      ? Icons.podcasts_rounded
                      : Icons.explore_outlined,
                  color: u.textMuted,
                  size: 42,
                ),
                const SizedBox(height: 14),
                Text(
                  feed == TalkFeedKind.live
                      ? 'No Live Talks yet.'
                      : 'Nothing to explore yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  feed == TalkFeedKind.live
                      ? 'Start a Talk and be the first conversation people can join.'
                      : 'New Talks and replays will appear here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted),
                ),
              ],
            );
          }

          // Product invariant: discovery is one vertical column. Never turn
          // this into a horizontal carousel/grid.
          return ListView.separated(
            key: ValueKey('talk-feed-' + feed.name),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(10, 10, 10, bottomInset),
            itemCount: talks.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final talk = talks[index];
              return TalkFeedCard(
                key: ValueKey('talk-card-' + talk.id),
                talk: talk,
                onTap: onOpenTalk == null ? null : () => onOpenTalk!(talk),
              );
            },
          );
        },
      ),
    );
  }
}

class TalkFeedCard extends StatelessWidget {
  const TalkFeedCard({
    super.key,
    required this.talk,
    this.onTap,
  });

  final TalkDiscoveryItem talk;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = talk.heroImageUrl?.trim();

    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: u.structuralBorder),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (image != null && image.isNotEmpty)
                AspectRatio(
                  aspectRatio: 16 / 7,
                  child: Image.network(
                    image,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        _TalkVisualFallback(live: talk.isLive),
                  ),
                )
              else
                SizedBox(
                  height: 106,
                  width: double.infinity,
                  child: _TalkVisualFallback(live: talk.isLive),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _StatusPill(live: talk.isLive),
                        const Spacer(),
                        Icon(
                          Icons.headphones_rounded,
                          size: 15,
                          color: u.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _compactCount(talk.listenerCount),
                          style: TextStyle(
                            color: u.textMuted,
                            fontSize: 12.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      talk.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 18,
                        height: 1.15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (talk.summary.trim().isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        talk.summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 13,
                          height: 1.25,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _ParticipantStack(talk: talk),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            talk.hostName.isEmpty
                                ? 'Masanawa Talk'
                                : talk.hostName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: u.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (talk.commentCount > 0) ...[
                          Icon(
                            Icons.mode_comment_outlined,
                            size: 15,
                            color: u.textMuted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _compactCount(talk.commentCount),
                            style: TextStyle(
                              color: u.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        FilledButton.icon(
                          onPressed: onTap,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(92, 38),
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                          ),
                          icon: Icon(
                            talk.isLive
                                ? Icons.headphones_rounded
                                : Icons.play_arrow_rounded,
                            size: 18,
                          ),
                          label: Text(talk.isLive ? 'Listen' : 'Play'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TalkVisualFallback extends StatelessWidget {
  const _TalkVisualFallback({required this.live});
  final bool live;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            u.brandStrong.withValues(alpha: .88),
            u.brand.withValues(alpha: .35),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(
          live ? Icons.graphic_eq_rounded : Icons.headphones_rounded,
          color: Colors.white,
          size: 42,
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.live});
  final bool live;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: live
            ? u.emergency.withValues(alpha: .12)
            : u.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        live ? 'LIVE' : 'REPLAY',
        style: TextStyle(
          color: live ? u.emergency : u.textMuted,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          letterSpacing: .5,
        ),
      ),
    );
  }
}

class _ParticipantStack extends StatelessWidget {
  const _ParticipantStack({required this.talk});
  final TalkDiscoveryItem talk;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final participants = talk.participants.take(3).toList(growable: false);
    if (participants.isEmpty) {
      return CircleAvatar(
        radius: 17,
        backgroundColor: u.brandStrong,
        child: Text(
          talk.hostName.trim().isEmpty
              ? 'M'
              : talk.hostName.trim().substring(0, 1).toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
    }
    return SizedBox(
      width: 35.0 + ((participants.length - 1) * 20),
      height: 36,
      child: Stack(
        children: [
          for (var i = 0; i < participants.length; i++)
            Positioned(
              left: i * 20,
              child: _Avatar(participant: participants[i]),
            ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.participant});
  final TalkParticipantPreview participant;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = participant.avatarUrl?.trim();
    return CircleAvatar(
      radius: 18,
      backgroundColor: u.surfaceCard,
      child: CircleAvatar(
        radius: 16,
        backgroundColor: participant.kind == TalkParticipantKind.human
            ? u.brandStrong
            : u.surfaceMuted,
        backgroundImage:
            image != null && image.isNotEmpty ? NetworkImage(image) : null,
        child: image == null || image.isEmpty
            ? Icon(
                participant.kind == TalkParticipantKind.human
                    ? Icons.person_rounded
                    : participant.kind == TalkParticipantKind.expert
                        ? Icons.verified_rounded
                        : Icons.auto_awesome_rounded,
                size: 17,
                color: participant.kind == TalkParticipantKind.human
                    ? Colors.white
                    : u.brandStrong,
              )
            : null,
      ),
    );
  }
}

class _TalkCardSkeleton extends StatelessWidget {
  const _TalkCardSkeleton();

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      height: 228,
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(18),
      ),
    );
  }
}

String _compactCount(int value) {
  if (value >= 1000000) {
    final number = value / 1000000;
    return number.toStringAsFixed(number >= 10 ? 0 : 1) + 'M';
  }
  if (value >= 1000) {
    final number = value / 1000;
    return number.toStringAsFixed(number >= 10 ? 0 : 1) + 'K';
  }
  return value.toString();
}


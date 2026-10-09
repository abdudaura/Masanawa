import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../library/talk_library.dart';
import '../../state/talk_library_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';
import '../talks/talk_home_screen.dart';

enum _MyTalksMode { live, replays, drafts }

class MyTalksScreen extends ConsumerStatefulWidget {
  const MyTalksScreen({super.key, this.onOpenTalk, this.onOpenDraft});

  final void Function(TalkDiscoveryItem talk)? onOpenTalk;
  final void Function(TalkDraftPreview draft)? onOpenDraft;

  @override
  ConsumerState<MyTalksScreen> createState() => _MyTalksScreenState();
}

class _MyTalksScreenState extends ConsumerState<MyTalksScreen> {
  _MyTalksMode _mode = _MyTalksMode.live;

  Future<void> _refresh() async {
    ref.invalidate(myTalksProvider);
    await ref.read(myTalksProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final asyncView = ref.watch(myTalksProvider);

    return Scaffold(
      key: const ValueKey('my-talks-screen'),
      backgroundColor: u.surfaceCard,
      appBar: AppBar(title: const Text('My Talks')),
      body: asyncView.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _LibraryState(
          icon: Icons.wifi_off_rounded,
          title: 'Couldn’t load your Talks.',
          subtitle: 'Pull down to try again.',
          onRefresh: _refresh,
        ),
        data: (view) {
          final modes = <_MyTalksMode>[
            _MyTalksMode.live,
            _MyTalksMode.replays,
            if (view.drafts.isNotEmpty) _MyTalksMode.drafts,
          ];
          if (!modes.contains(_mode)) _mode = _MyTalksMode.live;

          return Column(
            children: [
              _ModeChips(
                modes: modes,
                selected: _mode,
                onSelected: (value) => setState(() => _mode = value),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: switch (_mode) {
                    _MyTalksMode.live => _TalkList(
                      talks: view.live,
                      emptyTitle: 'You’re not live right now.',
                      emptySubtitle:
                          'Start a Talk when you have something worth discussing.',
                      onOpenTalk: widget.onOpenTalk,
                    ),
                    _MyTalksMode.replays => _TalkList(
                      talks: view.replays,
                      emptyTitle: 'No replays yet.',
                      emptySubtitle:
                          'Ended Talks that remain published will appear here.',
                      onOpenTalk: widget.onOpenTalk,
                    ),
                    _MyTalksMode.drafts => _DraftList(
                      drafts: view.drafts,
                      onOpenDraft: widget.onOpenDraft,
                    ),
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ModeChips extends StatelessWidget {
  const _ModeChips({
    required this.modes,
    required this.selected,
    required this.onSelected,
  });

  final List<_MyTalksMode> modes;
  final _MyTalksMode selected;
  final ValueChanged<_MyTalksMode> onSelected;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      width: double.infinity,
      color: u.surfaceCard,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      child: Wrap(
        spacing: 7,
        children: [
          for (final mode in modes)
            ChoiceChip(
              key: ValueKey('my-talks-' + mode.name),
              label: Text(switch (mode) {
                _MyTalksMode.live => 'Live',
                _MyTalksMode.replays => 'Replays',
                _MyTalksMode.drafts => 'Drafts',
              }),
              selected: selected == mode,
              onSelected: (_) => onSelected(mode),
            ),
        ],
      ),
    );
  }
}

class _TalkList extends StatelessWidget {
  const _TalkList({
    required this.talks,
    required this.emptyTitle,
    required this.emptySubtitle,
    required this.onOpenTalk,
  });

  final List<TalkDiscoveryItem> talks;
  final String emptyTitle;
  final String emptySubtitle;
  final void Function(TalkDiscoveryItem talk)? onOpenTalk;

  @override
  Widget build(BuildContext context) {
    if (talks.isEmpty) {
      return _LibraryState(
        icon: Icons.podcasts_outlined,
        title: emptyTitle,
        subtitle: emptySubtitle,
      );
    }

    return ListView.separated(
      key: const ValueKey('my-talks-list'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 28),
      itemCount: talks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final talk = talks[index];
        return TalkFeedCard(
          key: ValueKey('owned-talk-' + talk.id),
          talk: talk,
          onTap: onOpenTalk == null ? null : () => onOpenTalk!(talk),
        );
      },
    );
  }
}

class _DraftList extends StatelessWidget {
  const _DraftList({required this.drafts, required this.onOpenDraft});

  final List<TalkDraftPreview> drafts;
  final void Function(TalkDraftPreview draft)? onOpenDraft;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 28),
      itemCount: drafts.length,
      separatorBuilder: (_, __) =>
          Divider(height: 1, indent: 58, color: u.structuralBorder),
      itemBuilder: (context, index) {
        final draft = drafts[index];
        final label = draft.title.trim().isNotEmpty
            ? draft.title.trim()
            : draft.topic.trim().isNotEmpty
            ? draft.topic.trim()
            : 'Untitled Talk';
        return Material(
          color: u.surfaceCard,
          child: ListTile(
            key: ValueKey('talk-draft-' + draft.id),
            onTap: onOpenDraft == null ? null : () => onOpenDraft!(draft),
            leading: CircleAvatar(
              backgroundColor: u.surfaceMuted,
              child: Icon(Icons.edit_outlined, color: u.brandStrong),
            ),
            title: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              'Draft · ' + _dateLabel(draft.updatedAt),
              style: TextStyle(color: u.textMuted),
            ),
            trailing: onOpenDraft == null
                ? null
                : Icon(Icons.chevron_right_rounded, color: u.textMuted),
          ),
        );
      },
    );
  }
}

class _LibraryState extends StatelessWidget {
  const _LibraryState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onRefresh,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final list = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 90, 28, 28),
      children: [
        Icon(icon, size: 42, color: u.textMuted),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 13),
        ),
      ],
    );
    return onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

String _dateLabel(DateTime value) {
  final local = value.toLocal();
  return local.day.toString().padLeft(2, '0') +
      '/' +
      local.month.toString().padLeft(2, '0') +
      '/' +
      local.year.toString();
}


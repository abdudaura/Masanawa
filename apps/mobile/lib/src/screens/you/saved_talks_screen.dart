import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_library_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';
import '../talks/talk_home_screen.dart';

class SavedTalksScreen extends ConsumerWidget {
  const SavedTalksScreen({super.key, this.onOpenTalk});

  final void Function(TalkDiscoveryItem talk)? onOpenTalk;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final asyncTalks = ref.watch(savedTalksProvider);

    Future<void> refresh() async {
      ref.invalidate(savedTalksProvider);
      await ref.read(savedTalksProvider.future);
    }

    return Scaffold(
      key: const ValueKey('saved-talks-screen'),
      backgroundColor: u.surfaceCard,
      appBar: AppBar(title: const Text('Saved Talks')),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: asyncTalks.when(
          loading: () => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(24, 80, 24, 28),
            children: const [Center(child: CircularProgressIndicator())],
          ),
          error: (_, __) => _SavedState(
            icon: Icons.wifi_off_rounded,
            title: 'Couldn’t load Saved Talks.',
            subtitle: 'Pull down to try again.',
          ),
          data: (talks) {
            if (talks.isEmpty) {
              return const _SavedState(
                icon: Icons.bookmark_border_rounded,
                title: 'No Saved Talks yet.',
                subtitle:
                    'Save conversations you want to return to and they’ll appear here.',
              );
            }
            return ListView.separated(
              key: const ValueKey('saved-talks-list'),
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(10, 10, 10, 28),
              itemCount: talks.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final talk = talks[index];
                return TalkFeedCard(
                  key: ValueKey('saved-talk-' + talk.id),
                  talk: talk,
                  onTap: onOpenTalk == null ? null : () => onOpenTalk!(talk),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _SavedState extends StatelessWidget {
  const _SavedState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
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
  }
}


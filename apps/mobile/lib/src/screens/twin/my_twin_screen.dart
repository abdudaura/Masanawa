import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_profile.dart';
import '../../state/my_twin_state.dart';
import '../../theme/masanawa_theme.dart';

class MyTwinScreen extends ConsumerWidget {
  const MyTwinScreen({
    super.key,
    this.onCreateTwin,
    this.onTalkToTwin,
    this.onTeachTwin,
    this.onShareTwin,
    this.onOpenSettings,
  });

  final VoidCallback? onCreateTwin;
  final void Function(String characterId)? onTalkToTwin;
  final void Function(String characterId)? onTeachTwin;
  final void Function(TwinProfile profile)? onShareTwin;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final profile = ref.watch(myTwinProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('My Twin'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            onPressed: onOpenSettings,
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(myTwinProvider.notifier).refresh(),
        child: profile.when(
          loading: () => const _ScrollableCenter(
            child: CircularProgressIndicator(),
          ),
          error: (_, __) => _ScrollableCenter(
            child: Text(
              'My Twin is not available yet.',
              style: TextStyle(color: u.textMuted),
            ),
          ),
          data: (value) {
            if (value == null || !value.hasTwin || value.characterId == null) {
              return _EmptyTwin(onCreateTwin: onCreateTwin);
            }
            return _TwinBody(
              profile: value,
              onTalkToTwin: onTalkToTwin,
              onTeachTwin: onTeachTwin,
              onShareTwin: onShareTwin,
              onDiscoverableChanged: (next) =>
                  ref.read(myTwinProvider.notifier).setDiscoverable(next),
            );
          },
        ),
      ),
    );
  }
}

class _EmptyTwin extends StatelessWidget {
  const _EmptyTwin({required this.onCreateTwin});

  final VoidCallback? onCreateTwin;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 80),
        CircleAvatar(
          radius: 42,
          backgroundColor: u.brand.withValues(alpha: .10),
          child: Icon(Icons.auto_awesome_outlined, color: u.brand, size: 36),
        ),
        const SizedBox(height: 20),
        Text(
          'Create your digital twin',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Teach it about you, share it, and let people talk to your AI representative.',
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, height: 1.45),
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: onCreateTwin,
          child: const Text('Create my twin'),
        ),
      ],
    );
  }
}

class _TwinBody extends StatelessWidget {
  const _TwinBody({
    required this.profile,
    required this.onTalkToTwin,
    required this.onTeachTwin,
    required this.onShareTwin,
    required this.onDiscoverableChanged,
  });

  final TwinProfile profile;
  final void Function(String characterId)? onTalkToTwin;
  final void Function(String characterId)? onTeachTwin;
  final void Function(TwinProfile profile)? onShareTwin;
  final ValueChanged<bool> onDiscoverableChanged;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: u.surfaceCard,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Column(
            children: [
              CircleAvatar(
                radius: 38,
                backgroundColor: u.brand.withValues(alpha: .12),
                child: Text(
                  profile.initials,
                  style: TextStyle(
                    color: u.brand,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                profile.displayName,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 21,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (profile.bio.trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  profile.bio,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: u.textMuted, height: 1.4),
                ),
              ],
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                runSpacing: 6,
                children: [
                  _StatusChip(
                    label: profile.discoverable ? 'Public' : 'Private',
                    icon: profile.discoverable
                        ? Icons.public
                        : Icons.lock_outline,
                  ),
                  if (profile.voiceEnabled)
                    const _StatusChip(
                      label: 'Voice',
                      icon: Icons.graphic_eq,
                    ),
                  if (profile.ownerAccessEnabled)
                    const _StatusChip(
                      label: 'Talk to me',
                      icon: Icons.person_outline,
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _PerformanceCard(summary: profile.summary),
        const SizedBox(height: 12),
        _PrimaryActions(
          onTalk: () => onTalkToTwin?.call(profile.characterId!),
          onTeach: () => onTeachTwin?.call(profile.characterId!),
          onShare: profile.publicUrl == null
              ? null
              : () => onShareTwin?.call(profile),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: u.surfaceCard,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: u.structuralBorder),
          ),
          child: SwitchListTile.adaptive(
            value: profile.discoverable,
            onChanged: onDiscoverableChanged,
            title: const Text('Let people discover my twin'),
            subtitle: const Text(
              'Turn this off to keep your twin out of Explore.',
            ),
          ),
        ),
        if (profile.languages.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Languages',
            style: TextStyle(
              color: u.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: profile.languages
                .map(
                  (language) => Chip(
                    label: Text(language),
                    side: BorderSide(color: u.structuralBorder),
                    backgroundColor: u.surfaceCard,
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }
}

class _PrimaryActions extends StatelessWidget {
  const _PrimaryActions({
    required this.onTalk,
    required this.onTeach,
    required this.onShare,
  });

  final VoidCallback onTalk;
  final VoidCallback onTeach;
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: onTalk,
            icon: const Icon(Icons.chat_bubble_outline),
            label: const Text('Talk'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: onTeach,
            icon: const Icon(Icons.school_outlined),
            label: const Text('Teach'),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.outlined(
          tooltip: 'Share twin',
          onPressed: onShare,
          icon: const Icon(Icons.share_outlined),
        ),
      ],
    );
  }
}

class _PerformanceCard extends StatelessWidget {
  const _PerformanceCard({required this.summary});

  final TwinPerformanceSummary summary;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        children: [
          Expanded(child: _Metric('Visitors', '${summary.visitors}')),
          Expanded(child: _Metric('Chats', '${summary.conversations}')),
          Expanded(child: _Metric('Earned', '${summary.earningsCredits} Cr')),
          if (summary.pendingOwnerRequests > 0)
            Expanded(
              child: _Metric(
                'Needs you',
                '${summary.pendingOwnerRequests}',
              ),
            ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: TextStyle(
            color: u.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 11)),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: u.textMuted),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: u.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * .55,
          child: Center(child: child),
        ),
      ],
    );
  }
}

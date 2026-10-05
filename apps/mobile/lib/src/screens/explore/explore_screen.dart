import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_directory.dart';
import '../../state/twin_directory_state.dart';
import '../../theme/masanawa_theme.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({
    super.key,
    this.onOpenTwin,
  });

  final void Function(TwinDirectoryEntry twin)? onOpenTwin;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(twinDirectoryProvider.notifier).loadInitial(),
    );
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final state = ref.watch(twinDirectoryProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Explore'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(twinDirectoryProvider.notifier).loadInitial(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            TextField(
              controller: _search,
              onChanged: ref.read(twinDirectoryProvider.notifier).setQuery,
              decoration: const InputDecoration(
                hintText: 'Search twins',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 12),
            if (state.loading && state.items.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && state.items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 64),
                child: Text(
                  state.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted),
                ),
              )
            else if (state.items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 64),
                child: Column(
                  children: [
                    Icon(
                      Icons.people_outline,
                      size: 42,
                      color: u.textMuted,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      state.query.isEmpty
                          ? 'No public twins yet.'
                          : 'No twins match your search.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: u.textMuted),
                    ),
                  ],
                ),
              )
            else ...[
              for (final twin in state.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: _TwinCard(
                    twin: twin,
                    onTap: () => widget.onOpenTwin?.call(twin),
                  ),
                ),
              if (state.nextCursor != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton(
                    onPressed: state.loadingMore
                        ? null
                        : () => ref
                            .read(twinDirectoryProvider.notifier)
                            .loadMore(),
                    child: Text(
                      state.loadingMore ? 'Loading…' : 'Show more',
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TwinCard extends StatelessWidget {
  const _TwinCard({
    required this.twin,
    required this.onTap,
  });

  final TwinDirectoryEntry twin;
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
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 25,
                backgroundColor: u.brand.withValues(alpha: .10),
                child: Text(
                  twin.initials,
                  style: TextStyle(
                    color: u.brand,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      twin.displayName,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (twin.bio.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        twin.bio,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                    if (twin.languages.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        twin.languages.take(3).join(' · '),
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      children: [
                        if (twin.voiceEnabled)
                          const _MiniTag(
                            icon: Icons.graphic_eq,
                            label: 'Voice',
                          ),
                        if (twin.ownerAccessEnabled)
                          const _MiniTag(
                            icon: Icons.person_outline,
                            label: 'Owner chat',
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right, color: u.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: u.textMuted),
          const SizedBox(width: 3),
          Text(label, style: TextStyle(color: u.textMuted, fontSize: 10)),
        ],
      ),
    );
  }
}

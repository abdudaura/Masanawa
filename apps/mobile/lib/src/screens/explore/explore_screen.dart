import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_directory.dart';
import '../../state/twin_directory_state.dart';
import '../../theme/masanawa_theme.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, this.onOpenTwin, this.onOpenInternetCafe});

  final void Function(TwinDirectoryEntry twin)? onOpenTwin;
  final VoidCallback? onOpenInternetCafe;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _search = TextEditingController();
  final Set<String> _favorites = <String>{};

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

  void _toggleFavorite(TwinDirectoryEntry twin) {
    setState(() {
      if (!_favorites.add(twin.publicId)) _favorites.remove(twin.publicId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final state = ref.watch(twinDirectoryProvider);
    final twins = state.items;

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Explore')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(twinDirectoryProvider.notifier).loadInitial(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Container(
              color: u.surfaceCard,
              padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
              child: TextField(
                controller: _search,
                onChanged: ref.read(twinDirectoryProvider.notifier).setQuery,
                decoration: InputDecoration(
                  hintText: 'Search Twins',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _search.clear();
                            ref
                                .read(twinDirectoryProvider.notifier)
                                .setQuery('');
                            setState(() {});
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                  filled: true,
                  fillColor: u.surfaceBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: u.brandStrong),
                  ),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 11),
                ),
              ),
            ),
            _ExploreRow(
              key: const ValueKey('explore-room-internet-cafe'),
              title: 'Internet Cafe',
              subtitle: 'Data, airtime, bills and crypto',
              icon: Icons.language_rounded,
              onTap: widget.onOpenInternetCafe,
            ),
            if (state.loading && twins.isEmpty)
              const Padding(
                padding: EdgeInsets.all(36),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && twins.isEmpty)
              _ExploreState(
                text: 'Couldn’t refresh public Twins.',
                action: 'Try again',
                onTap: () =>
                    ref.read(twinDirectoryProvider.notifier).loadInitial(),
              )
            else if (twins.isEmpty)
              _ExploreState(
                text: state.query.isEmpty
                    ? 'No public Twins yet.'
                    : 'No Twins match your search.',
              )
            else
              for (final twin in twins)
                _TwinRow(
                  twin: twin,
                  favorite: _favorites.contains(twin.publicId),
                  onFavorite: () => _toggleFavorite(twin),
                  onTap: () => widget.onOpenTwin?.call(twin),
                ),
            if (state.nextCursor != null)
              TextButton(
                onPressed: state.loadingMore
                    ? null
                    : () => ref.read(twinDirectoryProvider.notifier).loadMore(),
                child: Text(state.loadingMore ? 'Loading…' : 'Load more'),
              ),
          ],
        ),
      ),
    );
  }
}

class _ExploreRow extends StatelessWidget {
  const _ExploreRow({
    super.key,
    required this.title,
    this.subtitle,
    required this.icon,
    this.onTap,
  });
  final String title;
  final String? subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          radius: 22,
          backgroundColor: u.surfaceMuted,
          child: Icon(icon, color: u.brandStrong),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: subtitle == null
            ? null
            : Text(
                subtitle!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: u.textMuted, fontSize: 12.5),
              ),
        trailing: Icon(Icons.chevron_right_rounded, color: u.textMuted),
        shape: Border(bottom: BorderSide(color: u.structuralBorder, width: .7)),
      ),
    );
  }
}

class _TwinRow extends StatelessWidget {
  const _TwinRow({
    required this.twin,
    required this.favorite,
    required this.onFavorite,
    required this.onTap,
  });
  final TwinDirectoryEntry twin;
  final bool favorite;
  final VoidCallback onFavorite;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: u.structuralBorder, width: .7),
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 23,
                backgroundColor: u.brandStrong,
                child: Text(
                  twin.initials,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (twin.bio.trim().isNotEmpty)
                      Text(
                        twin.bio,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: u.textMuted, fontSize: 12.5),
                      ),
                  ],
                ),
              ),
              if (twin.voiceEnabled)
                Icon(Icons.mic_rounded, size: 17, color: u.brandStrong),
              IconButton(
                tooltip: favorite ? 'Remove favorite' : 'Favorite',
                onPressed: onFavorite,
                icon: Icon(
                  favorite
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  color: favorite ? u.brandStrong : u.textMuted,
                  size: 20,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExploreState extends StatelessWidget {
  const _ExploreState({required this.text, this.action, this.onTap});
  final String text;
  final String? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 42),
      child: Column(
        children: [
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted),
          ),
          if (action != null && onTap != null)
            TextButton(onPressed: onTap, child: Text(action!)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_directory.dart';
import '../../state/twin_directory_state.dart';
import '../../theme/masanawa_theme.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({
    super.key,
    this.onOpenTwin,
    this.onOpenInternetCafe,
  });

  final void Function(TwinDirectoryEntry twin)? onOpenTwin;
  final VoidCallback? onOpenInternetCafe;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _search = TextEditingController();
  final Set<String> _favorites = <String>{};
  bool _searching = false;
  int _matchIndex = 0;

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

  void _spin(List<TwinDirectoryEntry> twins) {
    if (twins.isEmpty) return;
    setState(() => _matchIndex = (_matchIndex + 1) % twins.length);
  }

  void _toggleFavorite(TwinDirectoryEntry twin) {
    setState(() {
      if (!_favorites.add(twin.publicId)) {
        _favorites.remove(twin.publicId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final state = ref.watch(twinDirectoryProvider);
    final twins = state.items;
    if (_matchIndex >= twins.length && twins.isNotEmpty) {
      _matchIndex = 0;
    }

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Explore'),
        actions: [
          IconButton(
            tooltip: _searching ? 'Close search' : 'Search Twins',
            onPressed: () {
              setState(() => _searching = !_searching);
              if (!_searching) {
                _search.clear();
                ref.read(twinDirectoryProvider.notifier).setQuery('');
              }
            },
            icon: Icon(_searching ? Icons.close : Icons.search),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(twinDirectoryProvider.notifier).loadInitial(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          children: [
            _ExploreCafeCard(onTap: widget.onOpenInternetCafe),
            const SizedBox(height: 14),
            if (_searching) ...[
              TextField(
                controller: _search,
                autofocus: true,
                onChanged: ref.read(twinDirectoryProvider.notifier).setQuery,
                decoration: const InputDecoration(
                  hintText: 'Find a Twin',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
              const SizedBox(height: 16),
            ] else ...[
              Text(
                'Meet someone new',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Spin through public Twins and start a conversation instantly.',
                style: TextStyle(color: u.textMuted, height: 1.4),
              ),
              const SizedBox(height: 18),
            ],
            if (state.loading && twins.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 90),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (state.error != null && twins.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 72),
                child: Text(
                  state.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted),
                ),
              )
            else if (twins.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 72),
                child: Text(
                  state.query.isEmpty
                      ? 'No public Twins are available yet.'
                      : 'No Twins match your search.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted),
                ),
              )
            else if (_searching)
              ...twins.map(
                (twin) => Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: _SearchTwinTile(
                    twin: twin,
                    favorite: _favorites.contains(twin.publicId),
                    onFavorite: () => _toggleFavorite(twin),
                    onTap: () => widget.onOpenTwin?.call(twin),
                  ),
                ),
              )
            else ...[
              _SpinRail(
                twins: twins,
                selectedIndex: _matchIndex,
                onSelect: (index) => setState(() => _matchIndex = index),
              ),
              const SizedBox(height: 18),
              _MatchedTwinCard(
                twin: twins[_matchIndex],
                favorite: _favorites.contains(twins[_matchIndex].publicId),
                onFavorite: () => _toggleFavorite(twins[_matchIndex]),
                onChat: () => widget.onOpenTwin?.call(twins[_matchIndex]),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => _spin(twins),
                icon: const Icon(Icons.cyclone_rounded),
                label: const Text('Spin for another Twin'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
              ),
              if (state.nextCursor != null) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: state.loadingMore
                      ? null
                      : () => ref.read(twinDirectoryProvider.notifier).loadMore(),
                  child: Text(state.loadingMore ? 'Finding more…' : 'Find more Twins'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _ExploreCafeCard extends StatelessWidget {
  const _ExploreCafeCard({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        key: const ValueKey('explore-room-internet-cafe'),
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 23,
                backgroundColor: u.brand.withValues(alpha: .10),
                child: Icon(Icons.language_outlined, color: u.brand),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Internet Cafe',
                      style: TextStyle(
                        color: u.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Data, airtime, electricity, TV, crypto & more with Gwani',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: u.textMuted, fontSize: 12),
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

class _SpinRail extends StatelessWidget {
  const _SpinRail({
    required this.twins,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<TwinDirectoryEntry> twins;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final visible = twins.take(7).toList(growable: false);
    return SizedBox(
      height: 82,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: visible.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final selected = index == selectedIndex;
          final twin = visible[index];
          return GestureDetector(
            onTap: () => onSelect(index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: selected ? 70 : 58,
              height: selected ? 70 : 58,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? u.brand.withValues(alpha: .12) : u.surfaceCard,
                border: Border.all(
                  color: selected ? u.brand : u.structuralBorder,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Text(
                twin.initials,
                style: TextStyle(
                  color: selected ? u.brand : u.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: selected ? 18 : 15,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MatchedTwinCard extends StatelessWidget {
  const _MatchedTwinCard({
    required this.twin,
    required this.favorite,
    required this.onFavorite,
    required this.onChat,
  });

  final TwinDirectoryEntry twin;
  final bool favorite;
  final VoidCallback onFavorite;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 52,
            backgroundColor: u.brand.withValues(alpha: .10),
            child: Text(
              twin.initials,
              style: TextStyle(
                color: u.brand,
                fontSize: 28,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            twin.displayName,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 21,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (twin.bio.isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(
              twin.bio,
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: u.textMuted, height: 1.4),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (twin.voiceEnabled)
                const _MiniTag(icon: Icons.graphic_eq, label: 'Voice'),
              if (twin.voiceEnabled && twin.ownerAccessEnabled)
                const SizedBox(width: 7),
              if (twin.ownerAccessEnabled)
                const _MiniTag(icon: Icons.person_outline, label: 'Owner access'),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              IconButton.outlined(
                tooltip: favorite ? 'Remove favorite' : 'Favorite Twin',
                onPressed: onFavorite,
                icon: Icon(favorite ? Icons.favorite : Icons.favorite_border),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onChat,
                  icon: const Icon(Icons.chat_bubble_outline),
                  label: const Text('Chat now'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SearchTwinTile extends StatelessWidget {
  const _SearchTwinTile({
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
      borderRadius: BorderRadius.circular(18),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: u.structuralBorder),
        ),
        leading: CircleAvatar(
          backgroundColor: u.brand.withValues(alpha: .10),
          child: Text(twin.initials),
        ),
        title: Text(twin.displayName),
        subtitle: twin.bio.isEmpty
            ? null
            : Text(twin.bio, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: IconButton(
          tooltip: favorite ? 'Remove favorite' : 'Favorite Twin',
          onPressed: onFavorite,
          icon: Icon(favorite ? Icons.favorite : Icons.favorite_border),
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: u.textMuted),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: u.textMuted, fontSize: 11)),
        ],
      ),
    );
  }
}

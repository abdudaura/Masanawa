import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_directory.dart';
import '../../state/twin_directory_state.dart';
import '../../theme/masanawa_theme.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key, this.onOpenTwin});

  /// Shared integration supplies navigation without making this feature own the router.
  final void Function(TwinDirectoryEntry twin)? onOpenTwin;

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final directory = ref.watch(twinDirectoryProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        title: Text(
          'Explore',
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(twinDirectoryProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
          children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (value) =>
                  ref.read(twinDirectoryProvider.notifier).search(value),
              decoration: InputDecoration(
                hintText: 'Search people or twins',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear',
                        onPressed: () {
                          _search.clear();
                          setState(() {});
                          ref.read(twinDirectoryProvider.notifier).search('');
                        },
                        icon: const Icon(Icons.close),
                      ),
                filled: true,
                fillColor: u.surfaceCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide(color: u.structuralBorder),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            Text(
              'Text chat with public twins is free. A twin is an AI representation; '
              'the real owner is not present unless a separate owner session says so.',
              style: TextStyle(color: u.textMuted, fontSize: 12.5, height: 1.35),
            ),
            const SizedBox(height: 14),
            ...directory.when(
              loading: () => const [
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 42),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ],
              error: (_, __) => [
                _MessageCard(
                  message: 'Explore is unavailable right now.',
                  action: TextButton(
                    onPressed: () =>
                        ref.read(twinDirectoryProvider.notifier).refresh(),
                    child: const Text('Retry'),
                  ),
                ),
              ],
              data: (twins) => twins.isEmpty
                  ? const [
                      _MessageCard(
                        message: 'No public twins match your search yet.',
                      ),
                    ]
                  : [
                      for (final twin in twins)
                        _TwinTile(
                          twin: twin,
                          onTap: widget.onOpenTwin == null
                              ? null
                              : () => widget.onOpenTwin!(twin),
                        ),
                    ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TwinTile extends StatelessWidget {
  const _TwinTile({required this.twin, this.onTap});

  final TwinDirectoryEntry twin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = twin.avatarUrl;
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: u.structuralBorder),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: CircleAvatar(
          radius: 25,
          backgroundColor: u.brand,
          foregroundImage:
              image != null && image.isNotEmpty ? NetworkImage(image) : null,
          child: image == null || image.isEmpty
              ? Text(
                  twin.initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                )
              : null,
        ),
        title: Text(
          twin.displayName,
          style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (twin.headline.isNotEmpty)
              Text(
                twin.headline,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: u.textMuted, fontSize: 13),
              ),
            const SizedBox(height: 4),
            Text(
              'AI twin · Free text chat',
              style: TextStyle(color: u.brand, fontSize: 12),
            ),
          ],
        ),
        trailing: Icon(Icons.chat_bubble_outline, color: u.brand),
        onTap: onTap,
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message, this.action});
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
      child: Column(
        children: [
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted),
          ),
          if (action != null) ...[const SizedBox(height: 8), action!],
        ],
      ),
    );
  }
}

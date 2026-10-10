import 'package:flutter/material.dart';
import 'audio_post_transport.dart';

/// AF09 published audio-post feed. Legacy live Talks remain separate resources.
/// AF00 mounts this at the Talks destination; AF05 supplies authorized playback.
class AudioPostFeedScreen extends StatefulWidget {
  const AudioPostFeedScreen({
    super.key,
    required this.transport,
    required this.accountId,
    required this.isCurrentAccount,
    this.onPlayAuthorized,
    this.onCreatePost,
  });
  final AudioPostTransport transport;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  /// Must resolve a short-lived authorized asset URL and obey shared audio focus.
  final Future<void> Function(AudioPost)? onPlayAuthorized;
  final VoidCallback? onCreatePost;

  @override
  State<AudioPostFeedScreen> createState() => _AudioPostFeedScreenState();
}
class _AudioPostFeedScreenState extends State<AudioPostFeedScreen> {
  List<AudioPost> _items = const [];
  String? _next;
  String? _message;
  bool _loading = true, _loadingMore = false, _mine = false;
  int _generation = 0;
  final Set<String> _reacting = {};
  final Set<String> _removing = {};
  bool get _authorized =>
    widget.accountId.trim().isNotEmpty && widget.isCurrentAccount(widget.accountId);

  @override
  void initState() {
    super.initState();
    _load();
  }
  @override
  void didUpdateWidget(covariant AudioPostFeedScreen old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId || old.transport != widget.transport) {
      ++_generation;
      _items = const [];
      _next = null;
      _message = null;
      _reacting.clear();
      _removing.clear();
      _loading = true;
      _load();
    }
  }
  @override
  void dispose() {
    ++_generation;
    super.dispose();
  }
  void _switchFeed(bool mine) {
    if (_mine == mine) return;
    setState(() => _mine = mine);
    _load();
  }
  Future<void> _load({bool more = false}) async {
    if (!_authorized || (more && (_mine || _next == null || _loadingMore))) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final sequence = ++_generation;
    setState(() {
      if (more) _loadingMore = true;
      else {_loading = true; _next = null; _items = const [];}
      _message = null;
    });
    try {
      final page = _mine
          ? AudioPostPage(items: await widget.transport.mine(), nextCursor: null)
          : await widget.transport.discover(cursor: more ? _next : null);
      if (!mounted || sequence != _generation || !_authorized) return;
      final seen = more ? _items.map((e) => e.postId).toSet() : <String>{};
      setState(() {
        _items = List.unmodifiable([
          if (more) ..._items,
          ...page.items.where((e) => (_mine || e.status == 'published') && seen.add(e.postId)),
        ]);
        _next = page.nextCursor;
        _loading = false;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted || sequence != _generation || !_authorized) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _message = 'Could not load audio Talks. Check your connection and retry.';
      });
    }
  }
  Future<void> _remove(AudioPost post) async {
    if (!_authorized || !_mine || _removing.contains(post.postId) ||
        post.status == 'removed') return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove this Talk?'),
        content: const Text('It will no longer appear in public feeds. Stored audio follows the retention policy.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Remove')),
        ],
      ),
    );
    if (confirmed != true || !mounted || !_authorized || !_mine) return;
    setState(() => _removing.add(post.postId));
    try {
      final removed = await widget.transport.removeMine(postId: post.postId);
      if (!mounted || !_authorized || !_mine) return;
      setState(() => _items = List.unmodifiable(_items.map(
        (p) => p.postId == removed.postId ? removed : p,
      )));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Talk removed from public feeds.')),
      );
    } catch (_) {
      if (!mounted || !_authorized || !_mine) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove Talk. Please retry.')),
      );
    } finally {
      if (mounted) setState(() => _removing.remove(post.postId));
    }
  }
  Future<void> _react(AudioPost post, String kind) async {
    if (!_authorized || !_reacting.add(post.postId + kind)) return;
    setState(() {});
    try {
      await widget.transport.react(postId: post.postId, kind: kind, enabled: true);
      if (!mounted || !_authorized) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(kind == 'save' ? 'Saved to your library.' : 'Liked.')),
      );
    } catch (_) {
      if (!mounted || !_authorized) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save that action. Please retry.')),
      );
    } finally {
      if (mounted) setState(() => _reacting.remove(post.postId + kind));
    }
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Talks'),
        actions: [
          IconButton(
            tooltip: 'Refresh audio posts',
            icon: const Icon(Icons.refresh),
            onPressed: _authorized ? () => _load() : null,
          ),
          if (widget.onCreatePost != null)
            IconButton(
              tooltip: 'Record an audio Talk',
              icon: const Icon(Icons.add_circle_outline),
              onPressed: _authorized ? widget.onCreatePost : null,
            ),
        ],
      ),
      body: !_authorized
          ? const Center(child: Text('Sign in to listen to Talks.'))
          : RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      key: const ValueKey('audio-post-discover'),
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 40),
                      children: [
                        Wrap(spacing: 8, children: [
                          ChoiceChip(label: const Text('Discover'), selected: !_mine,
                            onSelected: _authorized ? (_) => _switchFeed(false) : null),
                          ChoiceChip(label: const Text('My Talks'), selected: _mine,
                            onSelected: _authorized ? (_) => _switchFeed(true) : null),
                        ]),
                        const SizedBox(height: 8),
                        if (_message != null)
                          ListTile(
                            title: Text(_message!),
                            trailing: TextButton(
                              onPressed: () => _load(more: _items.isNotEmpty),
                              child: const Text('Retry'),
                            ),
                          ),
                        if (_items.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 70),
                            child: Column(
                              children: [
                                Icon(Icons.graphic_eq, size: 48),
                                SizedBox(height: 14),
                                Text(_mine ? 'No Talks in your library yet.' : 'No published audio Talks yet.'),
                                SizedBox(height: 6),
                                Text('New audio posts will appear here.'),
                              ],
                            ),
                          ),
                        for (final post in _items)
                          Card(
                            key: ValueKey('audio-post-${post.postId}'),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    const Icon(Icons.record_voice_over_outlined),
                                    const SizedBox(width: 8),
                                    Expanded(child: Text(post.authorId,
                                      maxLines: 1, overflow: TextOverflow.ellipsis)),
                                    if (post.authorKind == 'masana')
                                      const Text('AI', semanticsLabel: 'AI-created audio'),
                                  ]),
                                  const SizedBox(height: 8),
                                  Text(post.title, style: Theme.of(context).textTheme.titleMedium),
                                  const SizedBox(height: 6),
                                  Text('${(post.durationMs / 1000).round()} seconds'),
                                  if (_mine) Text('Status: ${post.status}'),
                                  const SizedBox(height: 10),
                                  Wrap(spacing: 8, children: [
                                    if (_mine && post.status != 'removed')
                                      TextButton.icon(
                                        onPressed: _removing.contains(post.postId) ? null : () => _remove(post),
                                        icon: const Icon(Icons.delete_outline),
                                        label: Text(_removing.contains(post.postId) ? 'Removing…' : 'Remove Talk'),
                                      ),
                                    OutlinedButton.icon(
                                      onPressed: widget.onPlayAuthorized == null || post.status != 'published'
                                        ? null : () async {
                                        try { await widget.onPlayAuthorized!(post); }
                                        catch (_) {
                                          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Audio unavailable. Try again.')),
                                          );
                                        }
                                      },
                                      icon: const Icon(Icons.play_arrow),
                                      label: const Text('Listen'),
                                    ),
                                    TextButton.icon(
                                      onPressed: post.status != 'published' || _reacting.contains(post.postId + 'like')
                                          ? null : () => _react(post, 'like'),
                                      icon: const Icon(Icons.favorite_border),
                                      label: const Text('Like'),
                                    ),
                                    TextButton.icon(
                                      onPressed: post.status != 'published' || _reacting.contains(post.postId + 'save')
                                          ? null : () => _react(post, 'save'),
                                      icon: const Icon(Icons.bookmark_border),
                                      label: const Text('Save'),
                                    ),
                                  ]),
                                  if (widget.onPlayAuthorized == null)
                                    const Text('Audio playback is not configured in this build.'),
                                ],
                              ),
                            ),
                          ),
                        if (_next != null)
                          Center(child: TextButton(
                            onPressed: _loadingMore ? null : () => _load(more: true),
                            child: Text(_loadingMore ? 'Loading more…' : 'Load more'),
                          )),
                      ],
                    ),
            ),
    );
  }
}

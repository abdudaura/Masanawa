import 'dart:async';
import 'package:flutter/material.dart';
import 'audio_post_transport.dart';
import 'audio_post_comments_sheet.dart';
import 'audio_post_playback.dart';
import 'audio_post_feed_cache.dart';
import 'follow_button.dart';
import 'following_transport.dart';
import 'audio_post_report_action.dart';

/// AF09 published audio-post feed. Legacy live Talks remain separate resources.
/// AF00 mounts this at the Talks destination; AF05 supplies authorized playback.
class AudioPostFeedScreen extends StatefulWidget {
  const AudioPostFeedScreen({
    super.key,
    required this.transport,
    this.followingTransport,
    required this.accountId,
    required this.isCurrentAccount,
    this.onPlayAuthorized,
    this.playback,
    this.cache,
    this.onCreatePost,
    this.onOpenCreator,
    this.refreshSignal,
    this.reportTransport,
  });
  final AudioPostTransport transport;
  /// Optional until AF00 has registered the authenticated Following routes.
  final CreatorFollowingTransport? followingTransport;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  /// Must resolve a short-lived authorized asset URL and obey shared audio focus.
  final Future<void> Function(AudioPost)? onPlayAuthorized;
  /// AF09 ticket-backed player; AF00 provides it with AF05 focus and AF15 host.
  final AudioPostPlaybackController? playback;
  /// Encrypted account-fenced snapshots are best-effort, never authorizing API writes.
  final PublishedTalkFeedCache? cache;
  final VoidCallback? onCreatePost;
  /// AF09 feature navigation, only when a canonical creator feed is available.
  final void Function(String authorId, String authorKind)? onOpenCreator;
  /// Explicit server refresh after a compose receipt without resetting scroll/tab.
  final Listenable? refreshSignal;
  /// Only mounted when AF00 registered the canonical TalkSafety-backed route.
  final PublishedAudioReportTransport? reportTransport;

  @override
  State<AudioPostFeedScreen> createState() => _AudioPostFeedScreenState();
}
class _AudioPostFeedScreenState extends State<AudioPostFeedScreen> {
  List<AudioPost> _items = const [];
  late PublishedTalkFeedCache _cache;
  bool _fromSnapshot = false, _freshDiscoverRead = false;
  String? _next;
  String? _message;
  bool _loading = true, _loadingMore = false, _mine = false, _saved = false, _following = false;
  int _generation = 0;
  final Set<String> _reacting = {};
  final Set<String> _removing = {};
  // A lost DELETE acknowledgment is not proof of failure; block resubmission
  // until canonical My Talks readback distinguishes removed from still active.
  final Set<String> _uncertainRemovals = {};
  // Closing/replacing a session revokes mounted comment-sheet state immediately.
  final ValueNotifier<int> _commentsSession = ValueNotifier<int>(0);
  bool get _authorized =>
    widget.accountId.trim().isNotEmpty && widget.isCurrentAccount(widget.accountId);

  @override
  void initState() {
    super.initState();
    _cache = widget.cache ?? SecurePublishedTalkFeedCache();
    widget.refreshSignal?.addListener(_refreshFromReceipt);
    _load();
  }

  Future<void> _restoreSnapshot(int sequence) async {
    try {
      final items = await _cache.read(widget.accountId);
      if (items == null || items.isEmpty || !mounted || !_authorized ||
          sequence != _generation || _freshDiscoverRead || _items.isNotEmpty ||
          _mine || _saved || _following) return;
      setState(() { _items = items; _fromSnapshot = true; });
    } catch (_) {
      // Secure-store denial/corruption must not leak or fabricate feed data.
      // The authoritative request can still proceed and show an honest error.
    }
  }
  @override
  void didUpdateWidget(covariant AudioPostFeedScreen old) {
    super.didUpdateWidget(old);
    if (old.refreshSignal != widget.refreshSignal) {
      old.refreshSignal?.removeListener(_refreshFromReceipt);
      widget.refreshSignal?.addListener(_refreshFromReceipt);
    }
    if (old.accountId != widget.accountId || old.transport != widget.transport ||
        old.followingTransport != widget.followingTransport ||
        old.playback != widget.playback || old.cache != widget.cache) {
      final previousCache = _cache;
      if (old.accountId != widget.accountId && old.accountId.isNotEmpty) {
        unawaited(previousCache.clear(old.accountId).catchError((Object _) {}));
      }
      if (old.cache != widget.cache) {
        _cache = widget.cache ?? SecurePublishedTalkFeedCache();
      }
      if (widget.followingTransport == null) _following = false;
      if (old.playback != null) unawaited(old.playback!.stop());
      ++_generation;
      _items = const [];
      _next = null;
      _fromSnapshot = false;
      _freshDiscoverRead = false;
      _message = null;
      _reacting.clear();
      _commentsSession.value++;
      _removing.clear();
      _uncertainRemovals.clear();
      _loading = true;
      _load();
    }
  }
  @override
  void _refreshFromReceipt() {
    if (mounted && _authorized) unawaited(_load());
  }
  void dispose() {
    widget.refreshSignal?.removeListener(_refreshFromReceipt);
    ++_generation;
    _commentsSession.value++;
    if (widget.playback != null) unawaited(widget.playback!.stop());
    _commentsSession.dispose();
    super.dispose();
  }
  void _selectFeed({bool mine = false, bool saved = false, bool following = false}) {
    if (following && widget.followingTransport == null) return;
    if (_mine == mine && _saved == saved && _following == following) return;
    if (widget.playback != null) unawaited(widget.playback!.stop());
    setState(() {
      _mine = mine; _saved = saved; _following = following;
      _items = const []; _next = null;
      _fromSnapshot = false; _freshDiscoverRead = false;
    });
    _load();
  }
  Future<void> _load({bool more = false}) async {
    if (!more && widget.playback != null) unawaited(widget.playback!.stop());
    if (!_authorized || (more && (_mine || _saved || _next == null || _loadingMore))) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final sequence = ++_generation;
    // Never block a cached warm screen on a slow network or disk read.
    if (!more && !_mine && !_saved && !_following && _items.isEmpty) {
      _freshDiscoverRead = false;
      unawaited(_restoreSnapshot(sequence));
    }
    setState(() {
      if (more) _loadingMore = true;
      else { _loading = true; _next = null; }
      _message = null;
    });
    try {
      final page = _following
          ? await widget.followingTransport!.following(cursor: more ? _next : null)
          : _mine
          ? AudioPostPage(items: await widget.transport.mine(), nextCursor: null)
          : _saved
            ? AudioPostPage(items: await widget.transport.saved(), nextCursor: null)
            : await widget.transport.discover(cursor: more ? _next : null);
      if (!mounted || sequence != _generation || !_authorized) return;
      final seen = more ? _items.map((e) => e.postId).toSet() : <String>{};
      setState(() {
        _items = List.unmodifiable([
          if (more) ..._items,
          ...page.items.where((e) => (_mine || e.status == 'published') && seen.add(e.postId)),
        ]);
        _next = page.nextCursor;
        _fromSnapshot = false;
        if (!_mine && !_saved && !_following) _freshDiscoverRead = true;
        _loading = false;
        _loadingMore = false;
      });
      if (!_mine && !_saved && !_following && _authorized) {
        // Best-effort presentation cache; failures never suppress live results.
        unawaited(_cache.write(widget.accountId, _items).catchError((Object _) {}));
      }
    } catch (_) {
      if (!mounted || sequence != _generation || !_authorized) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _message = 'Could not load audio Talks. Check your connection and retry.';
      });
    }
  }
  bool _sameRemovalSession(String account, AudioPostTransport transport, int version) =>
      mounted && _authorized && _mine && _generation == version &&
      widget.accountId == account && identical(widget.transport, transport);

  void _markRemoved(AudioPost value) {
    setState(() {
      _items = List.unmodifiable(_items.map((p) =>
        p.postId == value.postId ? value : p));
      _uncertainRemovals.remove(value.postId);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Talk removed from public feeds.')),
    );
  }

  Future<void> _checkRemovalStatus(AudioPost post) async {
    if (!_authorized || !_mine || _removing.contains(post.postId) ||
        !_uncertainRemovals.contains(post.postId)) return;
    final account = widget.accountId, transport = widget.transport, version = _generation;
    setState(() => _removing.add(post.postId));
    try {
      final history = await transport.mine();
      if (!_sameRemovalSession(account, transport, version)) return;
      final matches = history.where((p) => p.postId == post.postId);
      final value = matches.isEmpty ? null : matches.first;
      if (value?.status == 'removed') {
        _markRemoved(value!);
      } else if (value != null) {
        setState(() => _uncertainRemovals.remove(post.postId));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Talk is still present. You can retry removal.')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Removal status is still unknown. Check again later.')));
      }
    } catch (_) {
      if (_sameRemovalSession(account, transport, version)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not check removal status. Retry when online.')));
      }
    } finally {
      if (_sameRemovalSession(account, transport, version)) {
        setState(() => _removing.remove(post.postId));
      }
    }
  }

  Future<void> _remove(AudioPost post) async {
    if (!_authorized || !_mine || _removing.contains(post.postId) ||
        _uncertainRemovals.contains(post.postId) || post.status == 'removed') return;
    final account = widget.accountId, transport = widget.transport;
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
    if (confirmed != true || !mounted || !_authorized || !_mine ||
        widget.accountId != account || !identical(widget.transport, transport)) return;
    final version = _generation;
    setState(() => _removing.add(post.postId));
    try {
      final removed = await transport.removeMine(postId: post.postId);
      if (_sameRemovalSession(account, transport, version)) _markRemoved(removed);
    } catch (_) {
      if (!_sameRemovalSession(account, transport, version)) return;
      setState(() => _uncertainRemovals.add(post.postId));
      try {
        // No second DELETE: a timeout after commit must not be called failed.
        final history = await transport.mine();
        if (!_sameRemovalSession(account, transport, version)) return;
        final matches = history.where((p) => p.postId == post.postId);
        final value = matches.isEmpty ? null : matches.first;
        if (value?.status == 'removed') {
          _markRemoved(value!);
          return;
        }
        if (value != null) {
          setState(() => _uncertainRemovals.remove(post.postId));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not remove Talk. Please retry.')));
          return;
        }
      } catch (_) {
        // An unavailable readback cannot establish the server outcome.
      }
      if (_sameRemovalSession(account, transport, version)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Removal status unknown. Check status before retrying.')));
      }
    } finally {
      if (_sameRemovalSession(account, transport, version)) {
        setState(() => _removing.remove(post.postId));
      }
    }
  }

  Future<void> _react(AudioPost post, String kind, {bool enabled = true}) async {
    if (!_authorized || !_reacting.add(post.postId + kind)) return;
    setState(() {});
    try {
      await widget.transport.react(postId: post.postId, kind: kind, enabled: enabled);
      if (!mounted || !_authorized) return;
      if (kind == 'save' && !enabled && _saved) {
        setState(() => _items = List.unmodifiable(
          _items.where((item) => item.postId != post.postId),
        ));
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(kind == 'save'
          ? (enabled ? 'Saved to your library.' : 'Removed from saved Talks.')
          : 'Liked.')),
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

  Future<void> _openComments(String postId) async {
    if (!_authorized) return;
    final account = widget.accountId;
    final transport = widget.transport;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.85,
        child: PublishedTalkCommentsSheet(
          key: ValueKey('talk-comments-sheet-' + postId),
          postId: postId,
          accountId: account,
          transport: transport,
          sessionChanges: _commentsSession,
          isCurrentAccount: (id) => mounted && _authorized &&
              id == account && widget.accountId == account &&
              identical(widget.transport, transport),
        ),
      ),
    );
  }

  Widget _reportAction(AudioPost post) {
    final expectedAccount = widget.accountId;
    final transport = widget.reportTransport!;
    return AudioPostReportAction(
      key: ValueKey('talk-report-${post.postId}'),
      postId: post.postId,
      transport: transport,
      enabled: _authorized,
      isAuthorized: () => mounted && widget.accountId == expectedAccount &&
          identical(widget.reportTransport, transport) &&
          widget.isCurrentAccount(expectedAccount),
    );
  }

  Widget _listenButton(AudioPost post) {
    final playback = widget.playback;
    if (playback != null) {
      return AnimatedBuilder(
        animation: playback,
        builder: (context, _) {
          final active = playback.activePostId == post.postId;
          final busy = active && playback.loading;
          final playing = active && playback.playing;
          final enabled = _authorized && playback.accountId == widget.accountId &&
              playback.isAuthorized && post.status == 'published';
          return Column(mainAxisSize: MainAxisSize.min, children: [
            OutlinedButton.icon(
              key: ValueKey('talk-listen-' + post.postId),
              onPressed: enabled ? () => playback.play(post) : null,
              icon: busy
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(playing ? Icons.pause : Icons.play_arrow),
              label: Text(busy ? 'Loading…' : playing ? 'Stop' : 'Listen'),
            ),
            if (active && playback.error != null)
              Text(playback.error!, key: const ValueKey('talk-playback-error')),
          ]);
        },
      );
    }
    return OutlinedButton.icon(
      onPressed: !_authorized || widget.onPlayAuthorized == null ||
          post.status != 'published' ? null : () async {
        try { await widget.onPlayAuthorized!(post); }
        catch (_) {
          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Audio unavailable. Try again.')));
        }
      },
      icon: const Icon(Icons.play_arrow),
      label: const Text('Listen'),
    );
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
              child: _loading && _items.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      key: const ValueKey('audio-post-discover'),
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 40),
                      children: [
                        Wrap(spacing: 8, children: [
                          ChoiceChip(label: const Text('Discover'), selected: !_mine && !_saved && !_following,
                            onSelected: _authorized ? (_) => _selectFeed() : null),
                          if (widget.followingTransport != null)
                            ChoiceChip(label: const Text('Following'), selected: _following,
                              onSelected: _authorized ? (_) => _selectFeed(following: true) : null),
                          ChoiceChip(label: const Text('Saved'), selected: _saved,
                            onSelected: _authorized ? (_) => _selectFeed(saved: true) : null),
                          ChoiceChip(label: const Text('My Talks'), selected: _mine,
                            onSelected: _authorized ? (_) => _selectFeed(mine: true) : null),
                        ]),
                        const SizedBox(height: 8),
                        if (_loading) const LinearProgressIndicator(),
                        if (_fromSnapshot)
                          const ListTile(
                            key: ValueKey('talks-offline-snapshot'),
                            title: Text('Previously viewed Talks · Updating when connected'),
                          ),
                        if (_message != null)
                          ListTile(
                            title: Text(_message!),
                            trailing: TextButton(
                              onPressed: () => _load(),
                              child: const Text('Retry'),
                            ),
                          ),
                        if (_items.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 70),
                            child: Column(
                              children: [
                                const Icon(Icons.graphic_eq, size: 48),
                                const SizedBox(height: 14),
                                Text(_mine ? 'No Talks in your library yet.'
                                  : _saved ? 'No saved Talks yet.'
                                  : _following ? 'No Talks from followed creators yet.'
                                  : 'No published audio Talks yet.'),
                                const SizedBox(height: 6),
                                const Text('New audio posts will appear here.'),
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
                                    Expanded(child: widget.onOpenCreator == null ||
                                            post.status != 'published'
                                        ? Text(post.authorId, maxLines: 1,
                                            overflow: TextOverflow.ellipsis)
                                        : TextButton(
                                            key: ValueKey('talk-creator-${post.postId}'),
                                            onPressed: _authorized
                                                ? () => widget.onOpenCreator!(
                                                    post.authorId, post.authorKind)
                                                : null,
                                            child: Align(
                                              alignment: Alignment.centerLeft,
                                              child: Text(post.authorId, maxLines: 1,
                                                  overflow: TextOverflow.ellipsis),
                                            ),
                                          )),
                                    if (post.authorKind == 'masana')
                                      const Text('AI', semanticsLabel: 'AI-created audio'),
                                  ]),
                                  if (widget.followingTransport != null && !_mine &&
                                      post.status == 'published')
                                    CreatorFollowButton(
                                      key: ValueKey('creator-follow-${post.postId}'),
                                      transport: widget.followingTransport!,
                                      postId: post.postId,
                                      authorId: post.authorId,
                                      authorKind: post.authorKind,
                                      accountId: widget.accountId,
                                      isCurrentAccount: widget.isCurrentAccount,
                                    ),
                                  const SizedBox(height: 8),
                                  Text(post.title, style: Theme.of(context).textTheme.titleMedium),
                                  const SizedBox(height: 6),
                                  Text('${(post.durationMs / 1000).round()} seconds'),
                                  if (post.status == 'published')
                                    Text('${post.likeCount} likes · ${post.commentCount} comments',
                                      semanticsLabel: '${post.likeCount} likes and ${post.commentCount} comments'),
                                  if (_mine) Text('Status: ${post.status}'),
                                  const SizedBox(height: 10),
                                  Wrap(spacing: 8, children: [
                                    if (_mine && post.status != 'removed')
                                      TextButton.icon(
                                        onPressed: _removing.contains(post.postId) ? null :
                                            _uncertainRemovals.contains(post.postId)
                                              ? () => _checkRemovalStatus(post) : () => _remove(post),
                                        icon: Icon(_uncertainRemovals.contains(post.postId)
                                            ? Icons.refresh : Icons.delete_outline),
                                        label: Text(_removing.contains(post.postId)
                                            ? 'Checking…' : _uncertainRemovals.contains(post.postId)
                                            ? 'Check removal status' : 'Remove Talk'),
                                      ),
                                    _listenButton(post),
                                    if (!_mine && post.status == 'published' &&
                                        widget.reportTransport != null)
                                      _reportAction(post),
                                    if (post.status == 'published')
                                      TextButton.icon(
                                        onPressed: () => _openComments(post.postId),
                                        icon: const Icon(Icons.chat_bubble_outline),
                                        label: const Text('Comments'),
                                      ),
                                    TextButton.icon(
                                      onPressed: post.status != 'published' || _reacting.contains(post.postId + 'like')
                                          ? null : () => _react(post, 'like'),
                                      icon: const Icon(Icons.favorite_border),
                                      label: const Text('Like'),
                                    ),
                                    TextButton.icon(
                                      onPressed: post.status != 'published' || _reacting.contains(post.postId + 'save')
                                          ? null : () => _react(post, 'save', enabled: !_saved),
                                      icon: Icon(_saved ? Icons.bookmark_remove_outlined : Icons.bookmark_border),
                                      label: Text(_saved ? 'Unsave' : 'Save'),
                                    ),
                                  ]),
                                  if (widget.onPlayAuthorized == null && widget.playback == null)
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

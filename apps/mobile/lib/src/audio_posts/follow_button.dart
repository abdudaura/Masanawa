import 'package:flutter/material.dart';
import 'audio_post_transport.dart';
import 'following_transport.dart';

/// Account-fenced follow control; never guesses the persisted follow state.
class CreatorFollowButton extends StatefulWidget {
  const CreatorFollowButton({
    super.key,
    required this.transport,
    required this.postId,
    required this.authorId,
    required this.authorKind,
    required this.accountId,
    required this.isCurrentAccount,
  });
  final CreatorFollowingTransport transport;
  final String postId;
  final String authorId;
  final String authorKind;
  final String accountId;
  final bool Function(String accountId) isCurrentAccount;

  @override
  State<CreatorFollowButton> createState() => _CreatorFollowButtonState();
}
class _CreatorFollowButtonState extends State<CreatorFollowButton> {
  bool? _following;
  bool _busy = false;
  bool _failed = false;
  int _generation = 0;
  bool get _allowed =>
      widget.accountId.isNotEmpty && widget.isCurrentAccount(widget.accountId);

  @override
  void initState() { super.initState(); _read(); }

  @override
  void didUpdateWidget(covariant CreatorFollowButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.postId != widget.postId ||
        oldWidget.transport != widget.transport ||
        oldWidget.authorId != widget.authorId ||
        oldWidget.authorKind != widget.authorKind) {
      ++_generation;
      _following = null;
      _failed = false;
      _busy = false;
      _read();
    }
  }
  @override
  void dispose() { ++_generation; super.dispose(); }

  void _accept(CreatorFollowReceipt value) {
    if (value.authorId != widget.authorId ||
        value.authorKind != widget.authorKind) {
      throw const FormatException('Creator changed');
    }
  }

  Future<void> _read() async {
    final current = ++_generation;
    if (!_allowed) {
      if (mounted) setState(() { _failed = false; _following = null; });
      return;
    }
    setState(() { _busy = true; _failed = false; });
    try {
      final receipt = await widget.transport.status(postId: widget.postId);
      if (!mounted || current != _generation || !_allowed) return;
      _accept(receipt);
      setState(() { _following = receipt.following; });
    } catch (_) {
      if (!mounted || current != _generation || !_allowed) return;
      setState(() { _following = null; _failed = true; });
    } finally {
      if (mounted && current == _generation) setState(() => _busy = false);
    }
  }

  Future<void> _set() async {
    if (!_allowed || _busy || _following == null) return;
    final current = ++_generation;
    final desired = !_following!;
    setState(() { _busy = true; _failed = false; });
    try {
      final receipt = await widget.transport.set(
        postId: widget.postId, enabled: desired,
      );
      if (!mounted || current != _generation || !_allowed) return;
      _accept(receipt);
      setState(() { _following = receipt.following; });
    } catch (_) {
      if (!mounted || current != _generation || !_allowed) return;
      setState(() { _failed = true; });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not update follow. Retry without losing your place.'),
      ));
    } finally {
      if (mounted && current == _generation) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_allowed) return const Text('Sign in to follow creators.');
    if (_failed && _following == null) {
      return TextButton.icon(
        onPressed: _busy ? null : _read,
        icon: const Icon(Icons.refresh),
        label: const Text('Retry follow status'),
      );
    }
    return OutlinedButton.icon(
      onPressed: _busy || _following == null ? null : _set,
      icon: Icon(_following == true ? Icons.person_remove_outlined : Icons.person_add_alt_1),
      label: Text(_busy && _following == null ? 'Checking…' :
        _following == true ? 'Following' : 'Follow'),
    );
  }
}

/// Auth-scoped Following destination; AF09 mounts it beside Discover after AF00 wiring.
class AudioFollowingList extends StatefulWidget {
  const AudioFollowingList({
    super.key,
    required this.transport,
    required this.accountId,
    required this.isCurrentAccount,
    required this.onOpenPost,
  });
  final CreatorFollowingTransport transport;
  final String accountId;
  final bool Function(String accountId) isCurrentAccount;
  final void Function(AudioPost post) onOpenPost;

  @override
  State<AudioFollowingList> createState() => _AudioFollowingListState();
}
class _AudioFollowingListState extends State<AudioFollowingList> {
  List<AudioPost> _items = const [];
  String? _next;
  String? _error;
  bool _loading = true, _loadingMore = false;
  int _generation = 0;
  bool get _authorized =>
      widget.accountId.isNotEmpty && widget.isCurrentAccount(widget.accountId);

  @override
  void initState() { super.initState(); _load(); }
  @override
  void didUpdateWidget(covariant AudioFollowingList old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId || old.transport != widget.transport) {
      ++_generation;
      _items = const [];
      _next = null;
      _load();
    }
  }
  @override
  void dispose() { ++_generation; super.dispose(); }

  Future<void> _load({bool more = false}) async {
    if (!_authorized || (more && (_next == null || _loadingMore))) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final current = ++_generation;
    setState(() {
      _error = null;
      if (more) _loadingMore = true;
      else { _loading = true; _items = const []; _next = null; }
    });
    try {
      final page = await widget.transport.following(cursor: more ? _next : null);
      if (!mounted || current != _generation || !_authorized) return;
      final seen = more ? _items.map((e) => e.postId).toSet() : <String>{};
      setState(() {
        _items = List.unmodifiable([
          if (more) ..._items,
          ...page.items.where((e) => e.status == 'published' && seen.add(e.postId)),
        ]);
        _next = page.nextCursor;
      });
    } catch (_) {
      if (!mounted || current != _generation || !_authorized) return;
      setState(() => _error = 'Could not load followed Talks. Check your connection and retry.');
    } finally {
      if (mounted && current == _generation) {
        setState(() { _loading = false; _loadingMore = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_authorized) return const Center(child: Text('Sign in to see followed creators.'));
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        key: const ValueKey('audio-post-following'),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (_error != null)
            ListTile(
              title: Text(_error!),
              trailing: TextButton(
                onPressed: () => _load(more: _items.isNotEmpty),
                child: const Text('Retry'),
              ),
            ),
          if (_items.isEmpty)
            const ListTile(
              title: Text('No Talks from followed creators yet.'),
              subtitle: Text('Follow someone from Discover to see their new audio posts here.'),
            ),
          for (final post in _items)
            ListTile(
              key: ValueKey('following-${post.postId}'),
              title: Text(post.title),
              subtitle: Text('${post.authorId} · ${(post.durationMs / 1000).round()} seconds'
                '${post.authorKind == 'masana' ? ' · AI' : ''}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () { if (_authorized) widget.onOpenPost(post); },
            ),
          if (_next != null)
            Center(child: TextButton(
              onPressed: _loadingMore ? null : () => _load(more: true),
              child: Text(_loadingMore ? 'Loading more…' : 'Load more'),
            )),
        ],
      ),
    );
  }
}

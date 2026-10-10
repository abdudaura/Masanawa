import 'package:flutter/material.dart';

import 'audio_post_transport.dart';
import 'creator_profile_transport.dart';
import 'following_transport.dart';
import 'follow_button.dart';

/// Displays only canonical creator data supplied by AF07 and visible Talks.
/// AF00 composes navigation; media remains bound to the authorized player.
class CreatorProfileScreen extends StatefulWidget {
  const CreatorProfileScreen({
    super.key, required this.transport, required this.accountId,
    required this.isCurrentAccount, required this.authorId,
    required this.authorKind, this.displayName, this.following,
    this.onOpenPost,
  });
  final CreatorProfileTransport transport;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final String authorId;
  final String authorKind;
  final String? displayName;
  final CreatorFollowingTransport? following;
  final ValueChanged<AudioPost>? onOpenPost;

  @override
  State<CreatorProfileScreen> createState() => _CreatorProfileState();
}

class _CreatorProfileState extends State<CreatorProfileScreen> {
  List<AudioPost> _posts = const [];
  String? _next, _error;
  bool _loading = true, _loadingMore = false, _retryMore = false;
  int _generation = 0;
  bool get _authorized => widget.accountId.isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);
  bool get _validCreator =>
      (widget.authorKind == 'human' || widget.authorKind == 'masana') &&
      RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(widget.authorId);

  @override
  void initState() { super.initState(); _load(); }

  @override
  void didUpdateWidget(covariant CreatorProfileScreen old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId ||
        old.authorId != widget.authorId ||
        old.authorKind != widget.authorKind ||
        old.transport != widget.transport) {
      ++_generation;
      _posts = const [];
      _next = null;
      _load();
    }
  }

  @override
  void dispose() { ++_generation; super.dispose(); }

  Future<void> _load({bool more = false}) async {
    if (!_authorized || !_validCreator ||
        (more && (_next == null || _loadingMore))) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final current = ++_generation;
    setState(() {
      _error = null;
      if (more) _loadingMore = true;
      // Keep visible posts during refresh and transient outages. The account
      // change path clears them first, so old-account data cannot appear.
      else { _loading = true; _next = null; }
    });
    try {
      final page = await widget.transport.posts(
        authorId: widget.authorId, authorKind: widget.authorKind,
        cursor: more ? _next : null,
      );
      if (!mounted || !_authorized || current != _generation) return;
      if (page.items.any((p) => p.authorId != widget.authorId ||
          p.authorKind != widget.authorKind || p.status != 'published')) {
        throw const FormatException('Creator feed mismatch');
      }
      final seen = more ? _posts.map((p) => p.postId).toSet() : <String>{};
      setState(() {
        _posts = List.unmodifiable([
          if (more) ..._posts,
          ...page.items.where((p) => seen.add(p.postId)),
        ]);
        _next = page.nextCursor;
        _retryMore = false;
      });
    } catch (_) {
      if (mounted && _authorized && current == _generation) {
        setState(() {
          _retryMore = more;
          _error = 'Could not load this creator’s Talks. Retry when connected.';
        });
      }
    } finally {
      if (mounted && current == _generation) {
        setState(() { _loading = false; _loadingMore = false; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.displayName?.trim();
    final title = name == null || name.isEmpty ? 'Creator' : name;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: !_authorized
        ? const Center(child: Text('Sign in to view creators.'))
        : !_validCreator
        ? const Center(child: Text('This creator is unavailable.'))
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              key: const ValueKey('creator-profile-list'),
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(title, style: Theme.of(context).textTheme.headlineSmall),
                if (widget.authorKind == 'masana')
                  const Text('AI creator · Audio posts'),
                if (_posts.isNotEmpty && widget.following != null)
                  CreatorFollowButton(
                    key: ValueKey('creator-follow-' + _posts.first.postId),
                    transport: widget.following!, postId: _posts.first.postId,
                    authorId: widget.authorId, authorKind: widget.authorKind,
                    accountId: widget.accountId,
                    isCurrentAccount: widget.isCurrentAccount,
                  ),
                if (_loading)
                  const Center(child: CircularProgressIndicator()),
                if (_error != null)
                  ListTile(
                    key: const ValueKey('creator-profile-error'),
                    title: Text(_error!),
                    trailing: TextButton(
                      onPressed: () => _load(more: _retryMore),
                      child: const Text('Retry'),
                    ),
                  ),
                if (!_loading && _posts.isEmpty && _error == null)
                  const ListTile(title: Text('No published Talks yet.')),
                for (final post in _posts)
                  ListTile(
                    key: ValueKey('creator-post-' + post.postId),
                    title: Text(post.title),
                    subtitle: Text(
                      (post.durationMs / 1000).ceil().toString() + ' seconds · ' +
                      post.likeCount.toString() + ' likes · ' +
                      post.commentCount.toString() + ' comments' +
                      (post.listenCount == null
                        ? '' : ' · ${post.listenCount} listens'),
                    ),
                    trailing: widget.onOpenPost == null ? null :
                      const Icon(Icons.chevron_right),
                    onTap: widget.onOpenPost == null ? null :
                      () { if (_authorized) widget.onOpenPost!(post); },
                  ),
                if (_next != null)
                  Center(child: TextButton(
                    key: const ValueKey('creator-profile-more'),
                    onPressed: _loadingMore ? null : () => _load(more: true),
                    child: Text(_loadingMore ? 'Loading more…' : 'Load more'),
                  )),
              ],
            ),
          ),
    );
  }
}

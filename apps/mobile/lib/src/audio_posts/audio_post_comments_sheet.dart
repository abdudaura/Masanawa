import 'package:flutter/material.dart';

import 'audio_post_transport.dart';

/// Authenticated published-Talk comments. Uses the existing Gateway transport;
/// never accepts tenant/account identifiers from a comment payload.
/// AF00/AF09 mount this sheet from the canonical Talk detail/feed destination.
class PublishedTalkCommentsSheet extends StatefulWidget {
  const PublishedTalkCommentsSheet({
    super.key,
    required this.postId,
    required this.accountId,
    required this.isCurrentAccount,
    required this.transport,
    this.newRequestId,
    this.sessionChanges,
  });

  final String postId;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final AudioPostTransport transport;
  /// Injectable for deterministic idempotency/retry tests; must be unique per draft.
  final String Function()? newRequestId;
  /// Feed-owned revocation event: a mounted modal must hide an old account's data.
  final Listenable? sessionChanges;

  @override
  State<PublishedTalkCommentsSheet> createState() => _PublishedTalkCommentsSheetState();
}

class _PublishedTalkCommentsSheetState extends State<PublishedTalkCommentsSheet> {
  final TextEditingController _text = TextEditingController();
  final Set<String> _deleting = <String>{};
  List<AudioPostComment> _comments = const [];
  String? _next, _error, _pendingRequestId, _pendingBody;
  bool _loading = true, _loadingMore = false, _sending = false;
  int _generation = 0, _nonce = 0;

  bool get _authorized => widget.accountId.isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);

  @override
  void initState() {
    super.initState();
    widget.sessionChanges?.addListener(_onSessionChanged);
    _fetch();
  }

  @override
  void didUpdateWidget(covariant PublishedTalkCommentsSheet old) {
    super.didUpdateWidget(old);
    if (old.sessionChanges != widget.sessionChanges) {
      old.sessionChanges?.removeListener(_onSessionChanged);
      widget.sessionChanges?.addListener(_onSessionChanged);
      _onSessionChanged();
    }
    if (old.accountId != widget.accountId ||
        old.postId != widget.postId ||
        old.transport != widget.transport ||
        old.isCurrentAccount != widget.isCurrentAccount) {
      ++_generation;
      _comments = const [];
      _next = null;
      _error = null;
      _text.clear();
      _pendingRequestId = null;
      _pendingBody = null;
      _sending = false;
      _deleting.clear();
      _loading = true;
      _loadingMore = false;
      _fetch();
    }
  }

  void _onSessionChanged() {
    if (!mounted || _authorized) return;
    ++_generation;
    setState(() {
      _comments = const [];
      _next = null;
      _error = null;
      _pendingRequestId = null;
      _pendingBody = null;
      _text.clear();
      _sending = false;
      _deleting.clear();
      _loading = false;
      _loadingMore = false;
    });
  }

  @override
  void dispose() {
    widget.sessionChanges?.removeListener(_onSessionChanged);
    ++_generation;
    _text.dispose();
    super.dispose();
  }

  Future<void> _fetch({bool more = false}) async {
    if (!_authorized || widget.transport is! AudioPostCommentPager ||
        (more && (_next == null || _loadingMore))) {
      if (mounted) setState(() {
        _loading = false;
        _error = !_authorized ? null : 'Comments are unavailable in this version. Please update the app.';
      });
      return;
    }
    final account = widget.accountId;
    final postId = widget.postId;
    final transport = widget.transport;
    final cursor = more ? _next : null;
    final generation = ++_generation;
    setState(() {
      _error = null;
      if (more) _loadingMore = true; else _loading = true;
    });
    try {
      final page = await (transport as AudioPostCommentPager)
          .commentsPage(postId: postId, cursor: cursor);
      if (!mounted || !_authorized || generation != _generation ||
          widget.accountId != account || widget.postId != postId ||
          !identical(widget.transport, transport)) return;
      if (page.items.any((entry) => entry.postId != postId || entry.removed)) {
        throw const FormatException('Comment page does not belong to this Talk');
      }
      final seen = more ? _comments.map((item) => item.commentId).toSet() : <String>{};
      setState(() {
        _comments = List.unmodifiable([
          if (more) ..._comments,
          ...page.items.where((entry) => seen.add(entry.commentId)),
        ]);
        _next = page.nextCursor;
      });
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _error = more
            ? 'Could not load older comments. Retry.'
            : 'Could not load comments. Check your connection and retry.');
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _send() async {
    if (!_authorized || _sending) return;
    final body = _text.text.trim();
    if (body.isEmpty || body.length > 400) {
      setState(() => _error = 'Enter a comment of up to 400 characters.');
      return;
    }
    if (_pendingBody != body) {
      _pendingBody = body;
      _pendingRequestId = widget.newRequestId?.call() ??
          'talk-comment-' + DateTime.now().microsecondsSinceEpoch.toString() +
              '-' + (_nonce++).toString();
    }
    final requestId = _pendingRequestId!;
    final generation = _generation;
    final account = widget.accountId, postId = widget.postId;
    final transport = widget.transport;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final comment = await transport.comment(
        postId: postId, requestId: requestId, body: body);
      if (!mounted || !_authorized || generation != _generation ||
          widget.accountId != account || widget.postId != postId ||
          !identical(widget.transport, transport)) return;
      if (comment.postId != postId || comment.removed) {
        throw const FormatException('Invalid server comment acknowledgement');
      }
      setState(() {
        _comments = List.unmodifiable([
          comment,
          ..._comments.where((item) => item.commentId != comment.commentId),
        ]);
        _pendingRequestId = null;
        _pendingBody = null;
        _text.clear();
        _sending = false;
      });
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        // Keep the exact key for an uncertain accepted write, never double-post.
        setState(() {
          _sending = false;
          _error = 'Comment outcome is unconfirmed. Retry safely.';
        });
      }
    }
  }

  Future<void> _remove(AudioPostComment comment) async {
    if (!_authorized || !comment.isMine || !_deleting.add(comment.commentId)) return;
    setState(() {});
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove your comment?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Remove')),
        ],
      ),
    );
    if (!mounted || !_authorized || confirmed != true) {
      if (mounted) setState(() => _deleting.remove(comment.commentId));
      return;
    }
    final generation = _generation;
    final postId = widget.postId, account = widget.accountId;
    final transport = widget.transport;
    try {
      await transport.removeComment(postId: postId, commentId: comment.commentId);
      if (!mounted || !_authorized || generation != _generation ||
          widget.accountId != account || widget.postId != postId ||
          !identical(widget.transport, transport)) return;
      setState(() {
        _comments = List.unmodifiable(
          _comments.where((item) => item.commentId != comment.commentId));
      });
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _error = 'Could not remove comment. Retry.');
      }
    } finally {
      if (mounted) setState(() => _deleting.remove(comment.commentId));
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: !_authorized
        ? const Center(child: Text('Sign in to read and write Talk comments.'))
        : Column(
            children: [
              ListTile(
                title: const Text('Comments'),
                trailing: IconButton(
                  tooltip: 'Close comments',
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () => _fetch(),
                  child: ListView(
                    key: const ValueKey('talk-comments-list'),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      if (_loading || _loadingMore)
                        const LinearProgressIndicator(),
                      if (_error != null)
                        ListTile(
                          key: const ValueKey('talk-comments-error'),
                          title: Text(_error!),
                          trailing: TextButton(
                            onPressed: _loading || _loadingMore || _sending
                                ? null : () => _fetch(more: _next != null),
                            child: const Text('Retry'),
                          ),
                        ),
                      if (!_loading && _comments.isEmpty)
                        const ListTile(title: Text('No comments yet.')),
                      for (final comment in _comments)
                        ListTile(
                          key: ValueKey('talk-comment-' + comment.commentId),
                          title: Text(comment.isMine ? 'You' : 'Member'),
                          subtitle: Text(comment.body),
                          trailing: comment.isMine
                              ? IconButton(
                                  tooltip: 'Remove your comment',
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: _deleting.contains(comment.commentId)
                                      ? null : () => _remove(comment),
                                )
                              : null,
                        ),
                      if (_next != null)
                        TextButton(
                          key: const ValueKey('talk-comments-more'),
                          onPressed: _loadingMore ? null : () => _fetch(more: true),
                          child: Text(_loadingMore ? 'Loading older…' : 'Load older comments'),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                    12, 8, 12, MediaQuery.viewInsetsOf(context).bottom + 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        key: const ValueKey('talk-comment-input'),
                        controller: _text,
                        maxLength: 400,
                        maxLines: 3,
                        minLines: 1,
                        enabled: !_sending,
                        decoration: const InputDecoration(
                          labelText: 'Write a comment',
                        ),
                        onChanged: (text) {
                          if (text.trim() != _pendingBody) {
                            _pendingBody = null;
                            _pendingRequestId = null;
                          }
                        },
                      ),
                    ),
                    IconButton(
                      key: const ValueKey('talk-comment-send'),
                      tooltip: _sending ? 'Sending comment' : 'Send comment',
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.send_outlined),
                    ),
                  ],
                ),
              ),
            ],
          ),
  );
}

import 'dart:async';

import 'package:flutter/material.dart';

import 'human_chat_models.dart';
import 'human_chat_sync.dart';

/// Isolated C05 thread surface; R17/C08 owns attaching it to /messages and
/// C02 owns authoritative membership/transport. No fake conversations, speech
/// button, transfer button or automatic microphone action.
class CachedHumanChatThread extends StatefulWidget {
  const CachedHumanChatThread({
    super.key,
    required this.sync,
    required this.conversationId,
    required this.title,
  });

  final HumanChatSync sync;
  final String conversationId;
  final String title;

  @override
  State<CachedHumanChatThread> createState() => _CachedHumanChatThreadState();
}

class _CachedHumanChatThreadState extends State<CachedHumanChatThread> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  List<CachedHumanMessage> _messages = const [];
  List<CachedHumanOutboxItem> _outbox = const [];
  String? _warning;
  bool _loading = true;
  bool _syncing = false;
  bool _olderLoading = false;
  bool _hasMoreCached = true;
  int _epoch = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    unawaited(_loadInitial());
  }

  @override
  void didUpdateWidget(CachedHumanChatThread oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sync != widget.sync ||
        oldWidget.conversationId != widget.conversationId) {
      _epoch += 1;
      _messages = const [];
      _outbox = const [];
      _hasMoreCached = true;
      _loading = true;
      _syncing = false;
      _olderLoading = false;
      _warning = null;
      _composer.clear();
      unawaited(_loadInitial());
    }
  }

  Future<void> _loadInitial() async {
    final token = _epoch;
    try {
      // First useful view is local SQL, never a blocking network request.
      final messages = await widget.sync.cachedHistory(widget.conversationId);
      final pending = await widget.sync.cachedOutbox(widget.conversationId);
      if (!mounted || token != _epoch) return;
      setState(() {
        _messages = messages;
        _outbox = pending;
        _loading = false;
        _hasMoreCached = messages.length >= 40;
      });
      unawaited(_refreshFromServer());
    } catch (_) {
      if (!mounted || token != _epoch) return;
      setState(() {
        _warning = 'Saved messages are unavailable on this device.';
        _loading = false;
      });
    }
  }

  Future<void> _refreshFromServer() async {
    if (_syncing) return;
    final token = _epoch;
    setState(() => _syncing = true);
    try {
      await widget.sync.catchUp(widget.conversationId);
      if (!mounted || token != _epoch) return;
      // Do not fetch all messages or destroy scroll position during refresh.
      final page = await widget.sync.cachedHistory(widget.conversationId);
      final pending = await widget.sync.cachedOutbox(widget.conversationId);
      if (!mounted || token != _epoch) return;
      setState(() {
        // Merge the fresh window without dropping older pages already viewed.
        // Stable server IDs prevent duplicate cells across reconnect.
        final known = {for (final m in _messages) m.messageId: m};
        for (final m in page) { known[m.messageId] = m; }
        _messages = known.values.toList()
          ..sort((a, b) => b.sequence.compareTo(a.sequence));
        _outbox = pending;
        _hasMoreCached = page.length >= 40;
        _warning = null;
      });
      unawaited(widget.sync.flushPending().then((_) async {
        if (mounted && token == _epoch) await _refreshOutbox();
      }).catchError((Object _) {}));
    } on HumanChatRejected catch (error) {
      if (!mounted || token != _epoch) return;
      if (error.code == 'ACCESS_REVOKED' ||
          error.code == 'CONVERSATION_DELETED') {
        setState(() {
          _messages = const [];
          _outbox = const [];
          _hasMoreCached = false;
          _warning = 'Access to this conversation was revoked.';
        });
      } else {
        setState(() => _warning =
            'Message access was refused. No new messages were loaded.');
      }
    } catch (_) {
      if (!mounted || token != _epoch) return;
      setState(() => _warning =
          'Offline or unable to sync. Showing locally saved messages.');
    } finally {
      if (mounted && token == _epoch) {
        setState(() => _syncing = false);
      }
    }
  }

  Future<void> _refreshOutbox() async {
    final token = _epoch;
    try {
      final pending = await widget.sync.cachedOutbox(widget.conversationId);
      final latest = await widget.sync.cachedHistory(widget.conversationId);
      if (!mounted || token != _epoch) return;
      setState(() {
        _outbox = pending;
        // Keep already loaded older local history where possible.
        final known = {for (final m in _messages) m.messageId: m};
        for (final m in latest) { known[m.messageId] = m; }
        _messages = known.values.toList()
          ..sort((a, b) => b.sequence.compareTo(a.sequence));
      });
    } catch (_) {
      if (!mounted || token != _epoch) return;
      setState(() => _warning = 'Saved delivery status is unavailable.');
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients || _olderLoading || !_hasMoreCached) return;
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 120) {
      unawaited(_loadOlder());
    }
  }

  Future<void> _loadOlder() async {
    if (_olderLoading || _messages.isEmpty) return;
    final token = _epoch;
    setState(() => _olderLoading = true);
    try {
      final page = await widget.sync.cachedHistory(
        widget.conversationId, beforeSequence: _messages.last.sequence,
      );
      if (!mounted || token != _epoch) return;
      setState(() {
        final seen = _messages.map((m) => m.messageId).toSet();
        _messages = [..._messages, ...page.where((m) => seen.add(m.messageId))];
        _hasMoreCached = page.length >= 40;
      });
    } catch (_) {
      if (mounted && token == _epoch) {
        setState(() => _warning =
            'Older saved messages are unavailable. Reconnect to sync history.');
      }
    } finally {
      if (mounted && token == _epoch) setState(() => _olderLoading = false);
    }
  }

  Future<void> _send() async {
    final text = _composer.text.trim();
    if (text.isEmpty) return;
    final token = _epoch;
    try {
      // Save first so an app kill/network timeout never changes request ID.
      await widget.sync.queueText(widget.conversationId, text);
      if (!mounted || token != _epoch) return;
      _composer.clear();
      await _refreshOutbox();
      unawaited(widget.sync.flushPending().then((_) async {
        if (mounted && token == _epoch) await _refreshOutbox();
      }).catchError((Object _) {
        if (mounted && token == _epoch) {
          setState(() => _warning =
              'Delivery is unconfirmed. Retry uses the same message ID.');
        }
      }));
    } catch (_) {
      if (mounted && token == _epoch) {
        setState(() => _warning =
            'Message could not be saved. Nothing has been sent.');
      }
    }
  }

  @override
  void dispose() {
    _epoch += 1;
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Widget _pendingTile(CachedHumanOutboxItem item) {
    final description = switch (item.status) {
      HumanOutboxStatus.pending => 'Pending send',
      HumanOutboxStatus.unknown => 'Delivery unknown · retry scheduled',
      HumanOutboxStatus.blocked => 'Not sent · recipient unavailable',
    };
    return Semantics(
      label: '${item.body}, $description',
      child: Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(item.body),
                  const SizedBox(height: 4),
                  Text(description, style: Theme.of(context).textTheme.labelSmall),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _messageTile(CachedHumanMessage item) {
    final self = item.senderUserId == widget.sync.userId;
    return Align(
      key: ValueKey('human-message-${item.messageId}'),
      alignment: self ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              item.deleted ? 'Message deleted' : (item.body ?? ''),
              style: item.deleted
                  ? Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontStyle: FontStyle.italic,
                    )
                  : null,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = _outbox.length + _messages.length + (_olderLoading ? 1 : 0);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title), actions: [
        IconButton(
          tooltip: 'Sync messages',
          onPressed: _syncing ? null : _refreshFromServer,
          icon: const Icon(Icons.sync),
        ),
      ]),
      body: SafeArea(
        child: Column(children: [
          if (_syncing) const LinearProgressIndicator(minHeight: 2),
          if (_warning != null)
            MaterialBanner(
              content: Text(_warning!),
              actions: [
                TextButton(
                  onPressed: _refreshFromServer,
                  child: const Text('Retry'),
                ),
              ],
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : count == 0
                    ? const Center(child: Text('No messages saved yet.'))
                    : ListView.builder(
                        controller: _scroll,
                        reverse: true,
                        itemCount: count,
                        itemBuilder: (context, index) {
                          if (index < _outbox.length) {
                            return _pendingTile(_outbox[index]);
                          }
                          final messageIndex = index - _outbox.length;
                          if (messageIndex < _messages.length) {
                            return _messageTile(_messages[messageIndex]);
                          }
                          return const Center(child: CircularProgressIndicator());
                        },
                      ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _composer,
                  maxLines: 4,
                  minLines: 1,
                  maxLength: 4000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Message',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
              IconButton(
                tooltip: 'Send message',
                onPressed: _send,
                icon: const Icon(Icons.send),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

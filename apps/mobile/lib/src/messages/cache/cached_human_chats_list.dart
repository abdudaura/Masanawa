import 'dart:async';

import 'package:flutter/material.dart';

import 'human_chat_models.dart';
import 'human_chat_sync.dart';

/// C05 list projection. R17/C08 owns the real /messages route and supplies
/// onOpenThread only for server-authorized conversation IDs.
class CachedHumanChatsList extends StatefulWidget {
  const CachedHumanChatsList({
    super.key,
    required this.sync,
    required this.onOpenThread,
  });

  final HumanChatSync sync;
  final ValueChanged<CachedHumanThread> onOpenThread;

  @override
  State<CachedHumanChatsList> createState() => _CachedHumanChatsListState();
}

class _CachedHumanChatsListState extends State<CachedHumanChatsList> {
  List<CachedHumanThread> _threads = const [];
  String? _warning;
  bool _loading = true;
  bool _syncing = false;
  int _epoch = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_loadLocal());
  }

  @override
  void didUpdateWidget(CachedHumanChatsList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sync != widget.sync) {
      ++_epoch;
      _threads = const [];
      _warning = null;
      _loading = true;
      _syncing = false;
      unawaited(_loadLocal());
    }
  }

  Future<void> _loadLocal() async {
    final generation = _epoch;
    try {
      final threads = await widget.sync.cachedThreads();
      if (!mounted || generation != _epoch) return;
      setState(() {
        _threads = threads;
        _loading = false;
      });
      unawaited(_refresh());
    } catch (_) {
      if (!mounted || generation != _epoch) return;
      setState(() {
        _threads = const [];
        _warning = 'Saved chats are unavailable on this device.';
        _loading = false;
      });
    }
  }

  Future<void> _refresh() async {
    if (_syncing) return;
    final generation = _epoch;
    setState(() => _syncing = true);
    try {
      await widget.sync.refreshThreads();
      final updated = await widget.sync.cachedThreads();
      if (!mounted || generation != _epoch) return;
      setState(() {
        _threads = updated;
        _warning = null;
      });
    } catch (_) {
      if (!mounted || generation != _epoch) return;
      setState(() => _warning =
          'Could not refresh chats. Saved conversations are available offline.');
    } finally {
      if (mounted && generation == _epoch) {
        setState(() => _syncing = false);
      }
    }
  }

  @override
  void dispose() {
    ++_epoch;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      if (_syncing) const LinearProgressIndicator(minHeight: 2),
      if (_warning != null)
        MaterialBanner(
          content: Text(_warning!),
          actions: [
            TextButton(onPressed: _syncing ? null : _refresh,
                child: const Text('Retry')),
          ],
        ),
      Expanded(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _threads.isEmpty
                ? const Center(
                    child: Text('No saved chats yet. Connect to find messages.'),
                  )
                : ListView.builder(
                    itemCount: _threads.length,
                    itemBuilder: (context, i) {
                      final thread = _threads[i];
                      final label = (thread.displayName?.trim().isNotEmpty ?? false)
                          ? thread.displayName!.trim()
                          : 'Contact unavailable';
                      return ListTile(
                        key: ValueKey('human-thread-${thread.conversationId}'),
                        leading: CircleAvatar(
                          child: Text(label.substring(0, 1).toUpperCase()),
                        ),
                        title: Text(label, maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        subtitle: Text(
                          thread.preview ?? 'Open conversation',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: thread.unreadCount <= 0
                            ? null
                            : Semantics(
                                label: '${thread.unreadCount} unread messages',
                                child: CircleAvatar(
                                  radius: 13,
                                  child: Text(
                                    thread.unreadCount > 99
                                        ? '99+'
                                        : '${thread.unreadCount}',
                                    style: Theme.of(context).textTheme.labelSmall,
                                  ),
                                ),
                              ),
                        onTap: () => widget.onOpenThread(thread),
                      );
                    },
                  ),
      ),
    ]);
  }
}

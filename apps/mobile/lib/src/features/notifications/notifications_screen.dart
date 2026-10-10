import 'package:flutter/material.dart';

import 'notification_repository.dart';

/// C08. AF00 owns adding the bell entry to the current five-tab shell.
/// This screen has no feed publishing, account contacts or human-chat actions.
class FanNotificationsScreen extends StatefulWidget {
  const FanNotificationsScreen({super.key, required this.transport, this.onOpenTarget});
  final FanNotificationTransport transport;
  final void Function(String targetKind, String targetId)? onOpenTarget;

  @override
  State<FanNotificationsScreen> createState() => _FanNotificationsScreenState();
}

class _FanNotificationsScreenState extends State<FanNotificationsScreen> {
  List<FanNotice> _items = [];
  String? _nextCursor;
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;
  bool _offline = false;
  bool _unreadOnly = false;
  final Set<String> _busyIds = {};
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void didUpdateWidget(covariant FanNotificationsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.transport, oldWidget.transport) ||
        widget.transport.ownerAccountId != oldWidget.transport.ownerAccountId ||
        !widget.transport.isCurrentAccount) {
      ++_generation;
      _items = [];
      _nextCursor = null;
      _busyIds.clear();
      _loading = true;
      _offline = false;
      _error = null;
      _refresh();
    }
  }

  Future<void> _refresh() async {
    final gen = ++_generation;
    if (!widget.transport.isCurrentAccount) {
      if (mounted) setState(() {
        _items = []; _nextCursor = null; _error = 'Sign in to see your notifications.';
        _loading = false; _offline = false;
      });
      return;
    }
    setState(() { _loading = _items.isEmpty; _error = null; });
    try {
      final page = await widget.transport.list();
      if (!mounted || gen != _generation || !widget.transport.isCurrentAccount) return;
      setState(() {
        _items = page.items; _nextCursor = page.nextCursor;
        _loading = false; _offline = false; _error = null;
      });
    } catch (_) {
      if (!mounted || gen != _generation) return;
      setState(() {
        _loading = false; _offline = _items.isNotEmpty;
        _error = 'Notifications could not be refreshed.';
        if (!widget.transport.isCurrentAccount) {
          _items = []; _nextCursor = null; _offline = false;
        }
      });
    }
  }

  Future<void> _loadMore() async {
    final cursor = _nextCursor;
    if (cursor == null || _loading || _loadingMore || _offline ||
        !widget.transport.isCurrentAccount) return;
    final gen = _generation;
    setState(() => _loadingMore = true);
    try {
      final page = await widget.transport.list(cursor: cursor);
      if (!mounted || gen != _generation || !widget.transport.isCurrentAccount) return;
      final ids = _items.map((e) => e.id).toSet();
      setState(() {
        _items = [..._items, ...page.items.where((e) => !ids.contains(e.id))];
        _nextCursor = page.nextCursor;
        _error = null;
      });
    } catch (_) {
      if (mounted && gen == _generation) setState(() => _error = 'Could not load more notifications.');
    } finally {
      if (mounted && gen == _generation) setState(() => _loadingMore = false);
    }
  }

  Future<void> _open(FanNotice notice) async {
    if (_busyIds.contains(notice.id) || _offline || !widget.transport.isCurrentAccount) return;
    final gen = _generation;
    setState(() => _busyIds.add(notice.id));
    try {
      if (notice.unread) await widget.transport.markRead(notice.id);
      if (!mounted || gen != _generation || !widget.transport.isCurrentAccount) return;
      setState(() {
        _items = _items.map((e) => e.id == notice.id ? e.copyRead() : e).toList();
      });
      widget.onOpenTarget?.call(notice.targetKind, notice.targetId);
    } catch (_) {
      if (!mounted || gen != _generation) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not mark as read. Try again.')));
    } finally {
      if (mounted && gen == _generation) setState(() => _busyIds.remove(notice.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Account switches must never paint the prior fan's cached rows, including
    // during the frame before the parent disposes this route.
    if (!widget.transport.isCurrentAccount) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: const Center(child: Text('Sign in to see your notifications.')),
      );
    }
    final visible = _unreadOnly ? _items.where((n) => n.unread).toList() : _items;
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        IconButton(tooltip: 'Refresh notifications', icon: const Icon(Icons.refresh),
          onPressed: _refresh),
      ]),
      body: Column(children: [
        Row(children: [
          const SizedBox(width: 12),
          const Text('Unread only'),
          Switch(value: _unreadOnly, onChanged: (v) => setState(() => _unreadOnly = v)),
        ]),
        if (_offline) MaterialBanner(
          content: const Text('Offline: showing the last loaded items. Actions need a connection.'),
          actions: [TextButton(onPressed: _refresh, child: const Text('Retry'))],
        ),
        if (_error != null && _items.isNotEmpty) Padding(
          padding: const EdgeInsets.all(8), child: Text(_error!, textAlign: TextAlign.center)),
        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(key: ValueKey('notifications-loading')))
          : _error != null && _items.isEmpty
              ? _message(Icons.wifi_off, _error!, 'Retry', _refresh)
              : visible.isEmpty
                  ? _message(Icons.notifications_none,
                      _unreadOnly ? 'No unread notifications' : 'No notifications yet',
                      'Refresh', _refresh)
                  : RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: visible.length + (_nextCursor != null ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == visible.length) return Center(
                            child: TextButton(
                              onPressed: _loadingMore ? null : _loadMore,
                              child: Text(_loadingMore ? 'Loading…' : 'Load more')));
                          final n = visible[index];
                          final icon = switch (n.kind) {
                            NoticeKind.commentReply => Icons.comment_outlined,
                            NoticeKind.roomAnswer => Icons.school_outlined,
                            NoticeKind.followedPost => Icons.article_outlined,
                            NoticeKind.subscription => Icons.card_membership_outlined,
                            NoticeKind.wallet => Icons.account_balance_wallet_outlined,
                            NoticeKind.caseUpdate => Icons.support_agent_outlined,
                          };
                          return ListTile(
                            key: ValueKey('notification-${n.id}'),
                            leading: Icon(icon),
                            title: Text(n.title, style: TextStyle(
                              fontWeight: n.unread ? FontWeight.w700 : FontWeight.normal)),
                            subtitle: Text(n.body, maxLines: 3, overflow: TextOverflow.ellipsis),
                            trailing: _busyIds.contains(n.id)
                              ? const SizedBox.square(dimension: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : n.unread ? const Icon(Icons.circle, size: 9) : null,
                            enabled: !_offline && widget.transport.isCurrentAccount,
                            onTap: () => _open(n),
                          );
                        },
                      ),
                    )),
      ]),
    );
  }

  Widget _message(IconData icon, String message, String label, VoidCallback retry) {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 40),
      const SizedBox(height: 12),
      Text(message, textAlign: TextAlign.center),
      const SizedBox(height: 12),
      OutlinedButton(onPressed: retry, child: Text(label)),
    ]));
  }
}

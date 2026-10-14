import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../chat/chat_format.dart';
import '../../core/startup_metrics.dart';
import '../../chat/message_parts.dart';
import '../../features/masana_chat/inbox_search.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../ui/components/masanawa_main_header.dart';
import '../../ui/components/conversation_search_field.dart';

class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  String _snippet(ChatThread thread) {
    if (thread.draft.trim().isNotEmpty) return 'Draft: ${thread.draft.trim()}';
    if (thread.draftVoice != null) return 'Draft: voice note';
    if (thread.draftAttachments.isNotEmpty) {
      final count = thread.draftAttachments.length;
      return count == 1
          ? 'Draft: ${thread.draftAttachments.first.label}'
          : 'Draft: $count attachments';
    }
    final last = thread.lastMessage;
    if (last == null) return '';
    if (last.parts.isNotEmpty) {
      final part = last.parts.last;
      return part.file?.name ??
          part.title ??
          part.body ??
          _partLabel(part.kind);
    }
    if (last.attachment != null) {
      final label = last.attachment!.label;
      return last.text.isEmpty ? label : '$label · ${last.text}';
    }
    return last.text.isEmpty ? '…' : last.text;
  }

  String _partLabel(AgentMessagePartKind kind) => switch (kind) {
    AgentMessagePartKind.audio => 'Voice response',
    AgentMessagePartKind.image => 'Image',
    AgentMessagePartKind.file => 'File',
    AgentMessagePartKind.artifact => 'Work result',
    AgentMessagePartKind.work => 'Work update',
    AgentMessagePartKind.approval => 'Approval needed',
    AgentMessagePartKind.operation => 'Action update',
    AgentMessagePartKind.callResult => 'Call result',
    AgentMessagePartKind.status => 'Status update',
  };

  List<(ChatThread, AgentMessagePart)> _activity(Iterable<ChatThread> threads) {
    final items = <(ChatThread, AgentMessagePart)>[];
    for (final thread in threads) {
      for (final message in thread.messages.reversed) {
        for (final part in message.parts.reversed) {
          final status = part.status?.toLowerCase();
          final activeWork =
              part.kind == AgentMessagePartKind.work &&
              !{'completed', 'fulfilled', 'cancelled'}.contains(status);
          final needsAttention =
              part.kind == AgentMessagePartKind.approval ||
              (part.kind == AgentMessagePartKind.status &&
                  status == 'failed') ||
              status == 'waiting_for_approval' ||
              status == 'waiting_for_input';
          if (activeWork || needsAttention) {
            items.add((thread, part));
          }
        }
      }
    }
    return items.take(20).toList(growable: false);
  }

  Future<void> _showActivity(
    BuildContext context,
    AgentDirectoryState directory,
    List<(ChatThread, AgentMessagePart)> items,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(
              title: Text('Agent activity'),
              subtitle: Text('Work, approvals and items needing attention'),
            ),
            for (final item in items)
              Builder(
                builder: (_) {
                  final agent = directory.find(item.$1.characterId);
                  final part = item.$2;
                  return ListTile(
                    leading: Icon(
                      part.kind == AgentMessagePartKind.approval
                          ? Icons.approval_outlined
                          : part.status == 'failed'
                          ? Icons.error_outline
                          : Icons.work_outline,
                    ),
                    title: Text(
                      part.title ??
                          (agent?.displayName ?? 'Agent') +
                              (part.kind == AgentMessagePartKind.approval
                                  ? ' needs approval'
                                  : ' is working'),
                    ),
                    subtitle: Text(
                      part.body ?? part.status ?? 'Open conversation',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      context.push('/chat/${item.$1.characterId}');
                    },
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _threadActions(
    BuildContext context,
    WidgetRef ref,
    ChatThread thread,
  ) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: Icon(
                thread.pinned ? Icons.push_pin_outlined : Icons.push_pin,
              ),
              title: Text(thread.pinned ? 'Unpin' : 'Pin'),
              onTap: () => Navigator.pop(sheetContext, 'pin'),
            ),
            ListTile(
              leading: const Icon(Icons.archive_outlined),
              title: const Text('Archive'),
              onTap: () => Navigator.pop(sheetContext, 'archive'),
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Rename'),
              onTap: () => Navigator.pop(sheetContext, 'rename'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Delete chat'),
              onTap: () => Navigator.pop(sheetContext, 'delete'),
            ),
          ],
        ),
      ),
    );
    if (action == null || !context.mounted) return;
    final ctl = ref.read(aiChatProvider.notifier);
    if (action == 'pin') ctl.togglePin(thread.characterId);
    if (action == 'archive') ctl.toggleArchive(thread.characterId);
    if (action == 'delete') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Delete chat?'),
          content: const Text(
            'This removes the conversation and its local drafts from this device.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (confirmed == true) ctl.clearThread(thread.characterId);
    }
    if (action == 'rename') {
      if (!context.mounted) return;
      final editor = TextEditingController(text: thread.title ?? '');
      final value = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Rename conversation'),
          content: TextField(controller: editor, autofocus: true),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, editor.text),
              child: const Text('Save'),
            ),
          ],
        ),
      );
      editor.dispose();
      if (value != null) ctl.renameThread(thread.characterId, value);
    }
  }

  Future<void> _showArchived(
    BuildContext context,
    WidgetRef ref,
    AgentDirectoryState directory,
  ) async {
    final archived =
        ref
            .read(aiChatProvider)
            .threads
            .values
            .where((thread) => thread.archived)
            .where((thread) => directory.find(thread.characterId) != null)
            .toList()
          ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: archived.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('No archived chats')),
              )
            : ListView.builder(
                shrinkWrap: true,
                itemCount: archived.length,
                itemBuilder: (_, index) {
                  final thread = archived[index];
                  final agent = directory.find(thread.characterId)!;
                  return ListTile(
                    leading: const Icon(Icons.archive_outlined),
                    title: Text(
                      thread.title?.trim().isNotEmpty == true
                          ? thread.title!
                          : agent.displayName,
                    ),
                    subtitle: Text(
                      _snippet(thread),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: IconButton(
                      tooltip: 'Unarchive',
                      icon: const Icon(Icons.unarchive_outlined),
                      onPressed: () {
                        ref
                            .read(aiChatProvider.notifier)
                            .toggleArchive(thread.characterId);
                        Navigator.pop(sheetContext);
                      },
                    ),
                    onTap: () {
                      Navigator.pop(sheetContext);
                      context.push('/chat/${thread.characterId}');
                    },
                  );
                },
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    MasanawaStartupMetrics.afterFrame('chats_first_frame');
    final u = context.masanawa;
    final chat = ref.watch(aiChatProvider);
    final directory = ref.watch(agentDirectoryProvider);
    final session = ref.watch(sessionProvider);
    final userName = session is SessionSignedIn
        ? session.user.name
        : 'Masanawa';

    final threads = chat.chatList
        .where((thread) => directory.find(thread.characterId) != null)
        .toList();
    final activity = _activity(threads);
    final attention = activity
        .where(
          (item) =>
              item.$2.kind == AgentMessagePartKind.approval ||
              item.$2.status == 'failed' ||
              item.$2.status == 'waiting_for_approval' ||
              item.$2.status == 'waiting_for_input',
        )
        .length;

    final activityLabel = !chat.online
        ? 'Offline · cached conversations available'
        : attention > 0
        ? '$attention need attention · ${activity.length} active'
        : '${activity.length} active work item${activity.length == 1 ? '' : 's'}';
    final activityStyle = TextStyle(color: u.textPrimary, fontSize: 12.5);
    final activityText =
        TextPainter(
          text: TextSpan(text: activityLabel, style: activityStyle),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
        )..layout(
          maxWidth:
              (MediaQuery.sizeOf(context).width -
                      28 -
                      25 -
                      (activity.isNotEmpty ? 18 : 0))
                  .clamp(1, double.infinity),
        );
    final activityHeight = (activityText.height + 16).clamp(
      38.0,
      double.infinity,
    );
    activityText.dispose();

    return Scaffold(
      backgroundColor: u.surfaceCard,
      appBar: masanawaMainHeader(
        context,
        bottom: activity.isEmpty && chat.online
            ? null
            : PreferredSize(
                preferredSize: Size.fromHeight(activityHeight),
                child: InkWell(
                  onTap: activity.isEmpty
                      ? null
                      : () => _showActivity(context, directory, activity),
                  child: Container(
                    width: double.infinity,
                    color: u.surfaceCard,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          chat.online
                              ? Icons.work_outline
                              : Icons.cloud_off_outlined,
                          color: u.textPrimary,
                          size: 17,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(activityLabel, style: activityStyle),
                        ),
                        if (activity.isNotEmpty)
                          Icon(
                            Icons.chevron_right,
                            color: u.textPrimary,
                            size: 18,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
        actions: [
          if (chat.threads.values.any((t) => t.archived))
            IconButton(
              tooltip: 'Archived chats',
              icon: const Icon(Icons.archive_outlined),
              onPressed: () => _showArchived(context, ref, directory),
            ),
          IconButton(
            tooltip: 'Wallet',
            icon: const Icon(Icons.account_balance_wallet_outlined),
            onPressed: () => context.go('/home?tab=wallet'),
          ),
          IconButton(
            tooltip: 'New chat',
            icon: const Icon(Icons.groups_outlined),
            onPressed: () => context.push('/masana'),
          ),
          IconButton(
            tooltip: 'Settings & profile',
            icon: CircleAvatar(
              radius: 14,
              backgroundColor: u.surfaceCard,
              child: Text(
                userName.isNotEmpty ? userName[0].toUpperCase() : 'M',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: _ChatsSearchPane(
        key: ValueKey(session is SessionSignedIn ? session.user.id : 'signed-out'),
        threads: session is SessionSignedIn ? threads : const <ChatThread>[],
        directory: directory,
        online: chat.online,
        accountId: session is SessionSignedIn ? session.user.id : '',
        accessToken: session is SessionSignedIn ? session.tokens.accessToken : '',
        inbox: ref.watch(masanaInboxSearchProvider),
        onOpenRemote: (remote) => context.push('/chat/${remote.characterId}'),
        onRetry: () => ref.read(agentDirectoryProvider.notifier).refresh(),
        resultsBuilder: (visibleThreads) => visibleThreads.isEmpty
          ? _EmptyChats(
              loading: directory.loading,
              error: directory.error,
              hasAgents: directory.agents.isNotEmpty,
              onStart: () => context.push('/masana'),
            )
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(agentDirectoryProvider.notifier).refresh(),
              child: ListView.separated(
                itemCount: visibleThreads.length,
                separatorBuilder: (_, _) =>
                    Divider(height: 1, indent: 76, color: u.structuralBorder),
                itemBuilder: (context, index) {
                  final thread = visibleThreads[index];
                  final agent = directory.find(thread.characterId)!;
                  final last = thread.lastMessage;
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    leading: CircleAvatar(
                      radius: 26,
                      backgroundColor: u.brand,
                      foregroundImage: agent.avatarUrl?.isNotEmpty == true
                          ? NetworkImage(agent.avatarUrl!)
                          : null,
                      child: agent.avatarUrl?.isNotEmpty == true
                          ? null
                          : Text(
                              agent.initial,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 20,
                              ),
                            ),
                    ),
                    title: Row(
                      children: [
                        if (thread.pinned) ...[
                          Icon(Icons.push_pin, size: 14, color: u.brand),
                          const SizedBox(width: 5),
                        ],
                        Expanded(
                          child: Text(
                            thread.title?.trim().isNotEmpty == true
                                ? thread.title!
                                : agent.displayName,
                            style: TextStyle(
                              color: u.textPrimary,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(
                        _snippet(thread),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: u.textMuted, fontSize: 14),
                      ),
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          last == null ? '' : formatChatTime(last.createdAt),
                          style: TextStyle(
                            color: thread.unread > 0 ? u.brand : u.textMuted,
                            fontSize: 12,
                            fontWeight: thread.unread > 0
                                ? FontWeight.w700
                                : FontWeight.w400,
                          ),
                        ),
                        if (thread.unread > 0) ...[
                          const SizedBox(height: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: u.brand,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '${thread.unread}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    onLongPress: () => _threadActions(context, ref, thread),
                    onTap: () => context.push('/chat/${thread.characterId}'),
                  );
                },
              ),
            ),
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Start conversation',
        backgroundColor: u.brand,
        foregroundColor: Colors.white,
        onPressed: () => context.push('/masana'),
        child: const Icon(Icons.mic_none_outlined),
      ),
    );
  }
}


/* Keep zero-network initial rendering from locally authorized chats; C10
 * remote lookups run only for typed searches. Server results use one authenticated
 * tenant/fan authority, and stale query/account/token responses are discarded.
 * AF08 owns shared interceptor refresh hardening, so C10 pins one credential
 * and never retries across an identity replacement. */
class _ChatsSearchPane extends StatefulWidget {
  const _ChatsSearchPane({
    super.key,
    required this.threads,
    required this.directory,
    required this.online,
    required this.accountId,
    required this.accessToken,
    required this.inbox,
    required this.onOpenRemote,
    required this.onRetry,
    required this.resultsBuilder,
  });

  final List<ChatThread> threads;
  final AgentDirectoryState directory;
  final bool online;
  final String accountId;
  final String accessToken;
  final MasanaInboxSearchAccess inbox;
  final void Function(MasanaInboxSearchItem) onOpenRemote;
  final VoidCallback onRetry;
  final Widget Function(List<ChatThread> visibleThreads) resultsBuilder;

  @override
  State<_ChatsSearchPane> createState() => _ChatsSearchPaneState();
}

class _ChatsSearchPaneState extends State<_ChatsSearchPane> {
  final TextEditingController _search = TextEditingController();
  Timer? _debounce;
  int _generation = 0;
  String _query = '';
  List<MasanaInboxSearchItem> _remote = const [];
  bool _serverLoading = false;
  String? _serverError;

  @override
  void didUpdateWidget(covariant _ChatsSearchPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.accountId != oldWidget.accountId ||
        widget.accessToken != oldWidget.accessToken) {
      _debounce?.cancel();
      _generation++;
      _remote = const [];
      _serverLoading = false;
      _serverError = null;
      if (widget.accountId != oldWidget.accountId) {
        _search.clear();
        _query = '';
      } else if (_query.isNotEmpty && widget.online) {
        _queueRemote();
      }
    }
  }

  @override
  void dispose() {
    _generation++;
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  bool _current(int generation, String account, String token, String query) =>
      mounted &&
      generation == _generation &&
      account == widget.accountId &&
      token == widget.accessToken &&
      query == _query;

  void _queueRemote() {
    _debounce?.cancel();
    final generation = ++_generation;
    final query = _query;
    final account = widget.accountId;
    final token = widget.accessToken;
    if (query.isEmpty || !widget.online || account.isEmpty || token.isEmpty) {
      _serverLoading = false;
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () {
      unawaited(_fetchRemote(generation, account, token, query));
    });
  }

  Future<void> _fetchRemote(
      int generation, String account, String token, String query) async {
    if (!_current(generation, account, token, query)) return;
    setState(() => _serverLoading = true);
    try {
      final items = await widget.inbox.search(bearer: token, query: query);
      if (!_current(generation, account, token, query)) return;
      setState(() {
        _remote = items;
        _serverError = null;
        _serverLoading = false;
      });
    } on DioException catch (error) {
      if (!_current(generation, account, token, query)) return;
      final status = error.response?.statusCode;
      setState(() {
        _remote = const [];
        _serverLoading = false;
        _serverError = status == 401 || status == 403
            ? 'Authorization required for server search.'
            : status == 503 || status == 410 || status == 404
                ? 'Server conversations are not available yet. Showing saved chats.'
                : 'Server search unavailable. Showing saved chats.';
      });
    } catch (_) {
      if (!_current(generation, account, token, query)) return;
      setState(() {
        _remote = const [];
        _serverLoading = false;
        _serverError = 'Could not search server conversations. Showing saved chats.';
      });
    }
  }

  void _changed(String raw) {
    final query = raw.trim().toLowerCase();
    if (query == _query) return;
    setState(() {
      _query = query;
      _remote = const [];
      _serverError = null;
      _serverLoading = false;
      _queueRemote();
    });
  }

  void _clear() {
    _search.clear();
    _debounce?.cancel();
    _generation++;
    setState(() {
      _query = '';
      _remote = const [];
      _serverLoading = false;
      _serverError = null;
    });
  }

  void _retryRemote() {
    if (_query.isEmpty || !widget.online) return;
    setState(() {
      _serverError = null;
      _queueRemote();
    });
  }

  Future<void> _toggleRemotePin(MasanaInboxSearchItem item) async {
    final account = widget.accountId;
    final token = widget.accessToken;
    try {
      final revision = await widget.inbox.setPinned(
        bearer: token,
        characterId: item.characterId,
        pinned: !item.pinned,
        expectedRevision: item.revision,
      );
      if (!mounted || account != widget.accountId ||
          token != widget.accessToken) {
        return;
      }
      setState(() {
        _remote = [
          for (final entry in _remote)
            if (entry.characterId == item.characterId)
              entry.withPin(!item.pinned, revision)
            else
              entry,
        ];
      });
    } catch (_) {
      if (!mounted || account != widget.accountId ||
          token != widget.accessToken) {
        return;
      }
      setState(() => _serverError = 'Could not update pin. Retry search.');
    }
  }

  void _openRemote(MasanaInboxSearchItem item) {
    final account = widget.accountId;
    final token = widget.accessToken;
    widget.onOpenRemote(item);
    unawaited(widget.inbox.markRead(
      bearer: token,
      characterId: item.characterId,
    ).then((_) {
      if (mounted && account == widget.accountId &&
          token == widget.accessToken) {
        _retryRemote();
      }
    }).catchError((Object _) {
      // Keep unread visible on failed receipt; do not fabricate a read.
    }));
  }

  @override
  Widget build(BuildContext context) {
    final visible = widget.threads.where((thread) {
      final authorized = widget.directory.find(thread.characterId);
      if (authorized == null) return false;
      if (_query.isEmpty) return true;
      return authorized.displayName.toLowerCase().contains(_query) ||
          (thread.title?.toLowerCase().contains(_query) ?? false) ||
          thread.characterId.toLowerCase().contains(_query);
    }).toList(growable: false);
    final visibleIds = visible.map((item) => item.characterId).toSet();
    final remote = _query.isEmpty
        ? const <MasanaInboxSearchItem>[]
        : _remote.where((row) => !visibleIds.contains(row.characterId))
            .take(50).toList(growable: false);

    return Column(
      children: [
        ConversationSearchField(
          controller: _search,
          hintText: 'Search Masana conversations',
          clearTooltip: 'Clear chat search',
          onChanged: _changed,
          onClear: _clear,
        ),
        if (widget.directory.loading || _serverLoading)
          const LinearProgressIndicator(minHeight: 2),
        if (_query.isNotEmpty && _serverError != null)
          MaterialBanner(
            content: Text(_serverError!),
            actions: [
              TextButton(onPressed: _retryRemote, child: const Text('Retry server search')),
            ],
          ),
        if (remote.isNotEmpty)
          SizedBox(
            height: remote.length == 1 ? 106 : 232,
            child: ListView.builder(
              itemCount: remote.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return const Padding(
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                    child: Text('Other server conversations',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                  );
                }
                final result = remote[index - 1];
                return ListTile(
                  dense: true,
                  key: ValueKey('remote-${result.characterId}'),
                  leading: CircleAvatar(
                    child: Text(result.displayName[0].toUpperCase()),
                  ),
                  title: Text(result.displayName),
                  subtitle: Text(result.lastMessage.isNotEmpty
                      ? result.lastMessage : result.profession,
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: IconButton(
                    tooltip: result.pinned ? 'Unpin server conversation'
                        : 'Pin server conversation',
                    icon: Icon(result.pinned ? Icons.push_pin
                        : Icons.push_pin_outlined),
                    onPressed: () => _toggleRemotePin(result),
                  ),
                  onTap: () => _openRemote(result),
                );
              },
            ),
          ),
        if (widget.directory.error != null && widget.threads.isNotEmpty)
          MaterialBanner(
            content: const Text(
              'Could not refresh Masana contacts. Showing saved conversations.',
            ),
            actions: [
              TextButton(onPressed: widget.onRetry, child: const Text('Retry')),
            ],
          ),
        Expanded(
          child: remote.isNotEmpty && visible.isEmpty
              ? const SizedBox.shrink()
              : _query.isNotEmpty &&
                  visible.isEmpty &&
                  widget.threads.isNotEmpty &&
                  !widget.directory.loading &&
                  !_serverLoading
              ? Center(
                  child: SingleChildScrollView(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Semantics(
                        liveRegion: true,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.search_off_outlined, size: 42),
                            const SizedBox(height: 12),
                            Text(
                              widget.online
                                  ? 'No matching conversations'
                                  : 'No matches in saved conversations',
                              textAlign: TextAlign.center,
                            ),
                            if (!widget.online) ...[
                              const SizedBox(height: 8),
                              const Text(
                                'Offline searches only include chats saved on this device.',
                                textAlign: TextAlign.center,
                              ),
                            ],
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: _clear,
                              child: const Text('Clear search'),
                            ),
                            if (!widget.online)
                              TextButton(
                                onPressed: widget.onRetry,
                                child: const Text('Retry contacts'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                )
              : widget.resultsBuilder(visible),
        ),
      ],
    );
  }
}

class _EmptyChats extends StatelessWidget {
  const _EmptyChats({
    required this.loading,
    required this.onStart,
    required this.hasAgents,
    this.error,
  });

  final bool loading;
  final VoidCallback onStart;
  final bool hasAgents;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.mic_none_outlined, size: 58, color: u.brand),
              const SizedBox(height: 18),
              Text(
                loading && !hasAgents
                    ? 'Loading your agents…'
                    : error ??
                          (hasAgents
                              ? 'Talk to an agent'
                              : 'No agents are available right now.'),
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                hasAgents
                    ? 'Choose an agent to start a conversation.'
                    : 'Your conversations are still here. Please try again shortly.',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: loading && !hasAgents ? null : onStart,
                icon: const Icon(Icons.groups_outlined),
                label: Text(hasAgents ? 'Choose an agent' : 'View agents'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

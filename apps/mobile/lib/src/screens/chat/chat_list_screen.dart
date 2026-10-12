import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../chat/chat_format.dart';
import '../../chat/message_parts.dart';
import '../../finance/crypto_wallet_screen.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../ui/components/masanawa_main_header.dart';

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
      backgroundColor: u.surfaceBg,
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
                    color: u.surfaceBg,
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
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const CryptoWalletScreen(),
                ),
              );
            },
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
              backgroundColor: u.surfaceBg,
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
      body: threads.isEmpty
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
                itemCount: threads.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, indent: 76, color: u.structuralBorder),
                itemBuilder: (context, index) {
                  final thread = threads[index];
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

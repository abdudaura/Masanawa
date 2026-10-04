import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../chat/chat_format.dart';
import '../../chat/message_parts.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../ui/components/masanawa_wordmark.dart';

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
              leading: Icon(thread.pinned ? Icons.push_pin_outlined : Icons.push_pin),
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
    final archived = ref
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

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.brand,
        foregroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: const MasanawaWordmark(light: true),
        actions: [
          if (chat.threads.values.any((t) => t.archived))
            IconButton(
              tooltip: 'Archived chats',
              icon: const Icon(Icons.archive_outlined),
              onPressed: () => _showArchived(context, ref, directory),
            ),
          IconButton(
            tooltip: 'Agents',
            icon: const Icon(Icons.groups_outlined),
            onPressed: () => context.push('/agents'),
          ),
          IconButton(
            tooltip: 'Settings & profile',
            icon: CircleAvatar(
              radius: 14,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              child: Text(
                userName.isNotEmpty ? userName[0].toUpperCase() : 'M',
                style: const TextStyle(
                  color: Colors.white,
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
              onStart: () => context.push('/agents'),
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
        onPressed: () => context.push('/agents'),
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
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.mic_none_outlined, size: 58, color: u.brand),
            const SizedBox(height: 18),
            Text(
              loading
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
              hasAgents ? 'Choose an agent to start a conversation.' : 'Your conversations are still here. Please try again shortly.',
              textAlign: TextAlign.center,
              style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: loading ? null : onStart,
              icon: const Icon(Icons.groups_outlined),
              label: Text(hasAgents ? 'Choose an agent' : 'View agents'),
            ),
          ],
        ),
      ),
    );
  }
}

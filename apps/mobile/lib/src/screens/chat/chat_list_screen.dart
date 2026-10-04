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
                    title: Text(
                      agent.displayName,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 16.5,
                        fontWeight: FontWeight.w700,
                      ),
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

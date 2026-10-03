import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../chat/masana.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/unigeria_theme.dart';
import '../../ui/components/masanawa_wordmark.dart';

/// Chat history — the WhatsApp-style conversation list. Each row is one
/// Masana with a live preview, time and unread count. The pencil button and
/// the team icon both open the Masana list to start a new chat.
class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  String _snippet(ChatThread thread) {
    final last = thread.lastMessage;
    if (last == null) return masanaById(thread.masanaId).about;
    if (last.attachment != null) {
      final label = last.attachment!.label;
      return last.text.isEmpty ? label : '$label · ${last.text}';
    }
    return last.text.isEmpty ? '...' : last.text;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.unigeria;
    final chat = ref.watch(aiChatProvider);
    final threads = chat.chatList;
    final session = ref.watch(sessionProvider);
    final userName =
        session is SessionSignedIn ? session.user.name : 'Masanawa';

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
            tooltip: 'Masana',
            icon: const Icon(Icons.groups_outlined),
            onPressed: () => context.push('/masana'),
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
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: threads.isEmpty
          ? _EmptyChats(onStart: () => context.push('/masana'))
          : ListView.separated(
              itemCount: threads.length,
              separatorBuilder: (_, __) => Divider(
                height: 1,
                indent: 76,
                color: u.structuralBorder,
              ),
              itemBuilder: (context, index) {
                final thread = threads[index];
                final masana = masanaById(thread.masanaId);
                final last = thread.lastMessage;
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 6),
                  leading: CircleAvatar(
                    radius: 26,
                    backgroundColor: masana.color,
                    child: Text(
                      masana.initial,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                  ),
                  title: Text(
                    masana.name,
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
                        last == null
                            ? ''
                            : formatChatTime(last.createdAt),
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
                              horizontal: 7, vertical: 2),
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
                  onTap: () => context.push('/chat/${thread.masanaId}'),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'New chat',
        backgroundColor: u.brand,
        foregroundColor: Colors.white,
        onPressed: () => context.push('/masana'),
        child: const Icon(Icons.chat_outlined),
      ),
    );
  }
}

class _EmptyChats extends StatelessWidget {
  const _EmptyChats({required this.onStart});
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final u = context.unigeria;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: u.brand.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.chat_bubble_outline,
                  size: 44, color: u.brand),
            ),
            const SizedBox(height: 20),
            Text(
              'No chats yet',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 19,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Say hello to a Masana agent to start your first conversation.',
              textAlign: TextAlign.center,
              style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: onStart,
              child: const Text('Meet the Masana'),
            ),
          ],
        ),
      ),
    );
  }
}

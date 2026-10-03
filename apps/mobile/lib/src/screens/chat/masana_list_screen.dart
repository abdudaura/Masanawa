import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../chat/masana.dart';
import '../../state/ai_chat_state.dart';
import '../../theme/unigeria_theme.dart';

/// The Masana list — WhatsApp-contacts-style, but the people here are the
/// Masana agents. Tapping one opens its conversation.
class MasanaListScreen extends ConsumerWidget {
  const MasanaListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.unigeria;
    final chat = ref.watch(aiChatProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop()
              ? context.pop()
              : context.go('/chats'),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Masana',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              '${kMasanaAgents.length} agents',
              style: TextStyle(color: u.textMuted, fontSize: 12.5),
            ),
          ],
        ),
      ),
      body: ListView.separated(
        itemCount: kMasanaAgents.length,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          indent: 76,
          color: u.structuralBorder,
        ),
        itemBuilder: (context, index) {
          final masana = kMasanaAgents[index];
          final thread = chat.threads[masana.id];
          final hasChat = (thread?.messages.length ?? 0) > 0;
          return ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            leading: Stack(
              children: [
                CircleAvatar(
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
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(
                      // Online dot = success token role.
                      color: u.success,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: u.surfaceBg, width: 2),
                    ),
                  ),
                ),
              ],
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
                hasChat ? 'Tap to continue chatting' : masana.about,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: u.textMuted, fontSize: 14),
              ),
            ),
            trailing: Icon(Icons.chat_bubble_outline, color: u.brand),
            onTap: () {
              ref.read(aiChatProvider.notifier).ensureGreeting(masana.id);
              context.push('/chat/${masana.id}');
            },
          );
        },
      ),
    );
  }
}

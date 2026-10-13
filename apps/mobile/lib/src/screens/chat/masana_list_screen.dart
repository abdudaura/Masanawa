import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../agents/agent_directory.dart';
import '../../agents/masana_portrait_avatar.dart';
import '../../agents/agent_feedback.dart';
import '../../agents/agent_presence_labels.dart';
import '../../state/session_state.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../theme/masanawa_theme.dart';

/// Server-driven Masana roster. No persona names, roles or capabilities are
/// compiled into the app; admin configuration can change without a release.
class MasanaListScreen extends ConsumerWidget {
  const MasanaListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final directory = ref.watch(agentDirectoryProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/home?tab=chats'),
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
              directory.loading && directory.agents.isEmpty
                  ? 'Loading…'
                  : '${directory.agents.length} Masana${directory.loading ? ' · refreshing…' : ''}',
              style: TextStyle(color: u.textMuted, fontSize: 12.5),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.read(agentDirectoryProvider.notifier).refresh(),
          ),
        ],
      ),
      body: _body(context, ref, directory),
    );
  }

  Widget _body(
    BuildContext context,
    WidgetRef ref,
    AgentDirectoryState directory,
  ) {
    final u = context.masanawa;
    if (directory.loading && directory.agents.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (directory.agents.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.groups_outlined, size: 52, color: u.brand),
              const SizedBox(height: 16),
              Text(
                directory.error ?? 'No Masana are available right now.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                directory.error == null
                    ? 'Please check back soon.'
                    : 'Your conversations are still here.',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted, height: 1.4),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () async {
                  if (directory.recovery == AgentRecovery.signIn) {
                    await ref.read(sessionProvider.notifier).logout();
                  } else {
                    await ref.read(agentDirectoryProvider.notifier).refresh();
                  }
                },
                icon: const Icon(Icons.refresh),
                label: Text(
                  directory.error == null
                      ? 'Refresh'
                      : AgentFeedback(
                          directory.error!,
                          recovery: directory.recovery,
                        ).actionLabel,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        if (directory.error != null)
          MaterialBanner(
            content: Text(directory.error!),
            actions: [
              TextButton(
                onPressed: directory.loading
                    ? null
                    : () => ref.read(agentDirectoryProvider.notifier).refresh(),
                child: const Text('Retry'),
              ),
            ],
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () =>
                ref.read(agentDirectoryProvider.notifier).refresh(),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: directory.agents.length,
              separatorBuilder: (_, _) =>
                  Divider(height: 1, indent: 76, color: u.structuralBorder),
              itemBuilder: (context, index) {
                final agent = directory.agents[index];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  leading: _MasanaAvatar(agent: agent),
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
                      agent.roleLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: u.textMuted, fontSize: 14),
                    ),
                  ),
                  trailing: agent.roomId == null
                      ? Icon(Icons.chat_bubble_outline, color: u.brand)
                      : IconButton(
                          tooltip: 'Open ${agent.displayName} Room',
                          icon: const Icon(Icons.school_outlined),
                          color: u.brand,
                          onPressed: () => context.push('/rooms/${Uri.encodeComponent(agent.roomId!)}'),
                        ),
                  onTap: () {
                    ref
                        .read(aiChatProvider.notifier)
                        .seedGreeting(agent.characterId, agent.greeting);
                    context.push('/chat/${agent.characterId}');
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _MasanaAvatar extends StatelessWidget {
  const _MasanaAvatar({required this.agent});

  final AgentDirectoryEntry agent;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final strings = Localizations.of<AppLocalizations>(context, AppLocalizations);
    final presence = strings == null
        ? agent.presenceLabel
        : localizedAgentPresence(strings, agent);
    return Stack(
      children: [
        MasanaPortraitAvatar(agent: agent),
        Positioned(
          right: 0,
          bottom: 0,
          child: Semantics(
            label: '${agent.displayName}: $presence',
            child: Container(
              width: 13,
              height: 13,
              decoration: BoxDecoration(
                // Cached, malformed and busy presence is not an availability
                // grant. Only a current explicit server value gets green.
                color: agent.presence == AgentPresence.available
                    ? u.success
                    : u.textMuted,
                shape: BoxShape.circle,
                border: Border.all(color: u.surfaceBg, width: 2),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

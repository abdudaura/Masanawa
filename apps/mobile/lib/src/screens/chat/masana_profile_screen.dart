import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../agents/agent_directory.dart';
import '../../agents/masana_portrait_avatar.dart';
import '../../theme/masanawa_theme.dart';

class MasanaProfileScreen extends StatelessWidget {
  const MasanaProfileScreen({
    super.key,
    required this.agent,
    required this.onCall,
  });
  final AgentDirectoryEntry agent;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      appBar: AppBar(title: const Text('Masana profile')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(child: MasanaPortraitAvatar(agent: agent, size: 112)),
          const SizedBox(height: 20),
          Text(
            agent.displayName,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            agent.roleLabel,
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.chat_outlined),
                  label: const Text('Message'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    onCall();
                  },
                  icon: const Icon(Icons.call_outlined),
                  label: const Text('Call'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          Text('About', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Text(
            agent.about.isEmpty ? agent.roleLabel : agent.about,
            style: TextStyle(color: u.textPrimary, height: 1.6),
          ),
          const SizedBox(height: 24),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.smart_toy_outlined, color: u.brand),
            title: const Text('AI Masana'),
            subtitle: const Text(
              'An AI character. Responses can contain mistakes.',
            ),
          ),
          if (agent.roomId != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.school_outlined, color: u.brand),
              title: const Text('Classroom'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () =>
                  context.push('/rooms/${Uri.encodeComponent(agent.roomId!)}'),
            ),
        ],
      ),
    );
  }
}

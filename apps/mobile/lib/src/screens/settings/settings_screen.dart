import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

/// Settings + profile. The only secondary screen: account card, two local
/// toggles, clear-chat, log out. No feature links.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _notifications = true;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final session = ref.watch(sessionProvider);
    final user = session is SessionSignedIn ? session.user : null;
    final name = user?.name ?? 'Citizen';
    final contact = user?.phone ?? user?.email ?? 'No contact saved';

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/chat'),
        ),
        title: Text(
          'Settings & Profile',
          style: TextStyle(
            color: u.textPrimary,
            fontSize: MasanawaTokens.fontSize['xl'],
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: u.surfaceCard,
              borderRadius:
                  BorderRadius.circular(MasanawaTokens.radius['2xl']!),
              border: Border.all(color: u.structuralBorder),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: u.brand.withValues(alpha: 0.15),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'U',
                    style: TextStyle(
                      color: u.brand,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: u.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        contact,
                        style: TextStyle(color: u.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Card(children: [
            SwitchListTile(
              secondary: Icon(Icons.notifications_outlined, color: u.brand),
              title: const Text('Notifications'),
              subtitle: const Text('Replies and updates'),
              value: _notifications,
              onChanged: (v) => setState(() => _notifications = v),
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.delete_outline, color: u.brand),
              title: const Text('Clear all chats'),
              subtitle: const Text('Remove every conversation on this device'),
              onTap: () {
                ref.read(aiChatProvider.notifier).clearAll();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('All chats cleared')),
                );
              },
            ),
            if (kDebugMode) ...[
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.developer_mode_outlined, color: u.brand),
                title: const Text('Developer'),
                subtitle: const Text('Alpha runtime and AgentRun diagnostics'),
                onTap: () => context.push('/developer'),
              ),
            ],
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.info_outline, color: u.brand),
              title: const Text('About Masanawa'),
              subtitle: const Text('Voice-first conversations with your configured AI agents'),
              onTap: () => showAboutDialog(
                context: context,
                applicationName: 'Masanawa Agents',
                applicationVersion: '1.0.0',
                children: const [
                  Text('A clean, WhatsApp-style chat app for Nigerian AI agents.'),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _Card(children: [
            ListTile(
              leading: Icon(Icons.logout, color: u.emergency),
              title: Text(
                'Log out',
                style: TextStyle(
                    color: u.emergency, fontWeight: FontWeight.w600),
              ),
              onTap: () async {
                await ref.read(sessionProvider.notifier).logout();
                if (context.mounted) context.go('/phone-login');
              },
            ),
          ]),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Masanawa · v1.0.0',
              style: TextStyle(color: u.textMuted, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Card(
      color: u.surfaceCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['xl']!),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: Column(children: children),
    );
  }
}

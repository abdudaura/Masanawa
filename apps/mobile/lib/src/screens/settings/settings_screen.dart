import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/mobile_push.dart';
import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';
import 'account_deletion_dialog.dart';

/// Account and app preferences for the current Masanawa consumer product.
/// Account deletion must be handled by an authenticated durable server workflow;
/// clearing local chats or logging out is not account deletion.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _notifications = false;
  String? _savingDefaultAgentId;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshNotificationState());
  }

  Future<void> _refreshNotificationState() async {
    final enabled = await MobilePushService.instance.notificationEnabled();
    if (mounted) setState(() => _notifications = enabled);
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final session = ref.watch(sessionProvider);
    final user = session is SessionSignedIn ? session.user : null;
    final name = user?.name ?? 'Citizen';
    final contact = user?.phone ?? user?.email ?? 'No contact saved';
    final directory = ref.watch(agentDirectoryProvider);
    final supportAgents = directory.agents
        .where((agent) => agent.supportAgent)
        .toList(growable: false);

    String? selectedSupportAgentId;
    for (final agent in supportAgents) {
      if (agent.defaultPlatformAgent) {
        selectedSupportAgentId = agent.characterId;
        break;
      }
    }

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/home'),
        ),
        title: Text(
          'Settings',
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
          if (supportAgents.isNotEmpty) ...[
            const SizedBox(height: 16),
            _Card(
              children: [
                ListTile(
                  leading: Icon(Icons.support_agent_outlined, color: u.brand),
                  title: const Text('Default Masanawa agent'),
                  subtitle: const Text(
                    'Choose who handles support and platform guidance',
                  ),
                ),
                const Divider(height: 1),
                for (var index = 0; index < supportAgents.length; index++) ...[
                  Builder(
                    builder: (context) {
                      final agent = supportAgents[index];
                      final selected = agent.defaultPlatformAgent;
                      final saving =
                          _savingDefaultAgentId == agent.characterId;
                      final voice =
                          agent.voiceName == null || agent.voiceName!.isEmpty
                              ? null
                              : agent.voiceName;
                      return RadioListTile<String>(
                        value: agent.characterId,
                        groupValue: selectedSupportAgentId,
                        onChanged: saving
                            ? null
                            : (value) async {
                                if (value == null || selected) return;
                                setState(
                                  () => _savingDefaultAgentId = value,
                                );
                                try {
                                  await ref
                                      .read(agentDirectoryTransportProvider)
                                      .setDefaultPlatformAgent(value);
                                  await ref
                                      .read(agentDirectoryProvider.notifier)
                                      .refresh();
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          '${agent.displayName} is now your default Masanawa agent',
                                        ),
                                      ),
                                    );
                                  }
                                } catch (_) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Could not update your default agent. Please try again.',
                                        ),
                                      ),
                                    );
                                  }
                                } finally {
                                  if (mounted) {
                                    setState(
                                      () => _savingDefaultAgentId = null,
                                    );
                                  }
                                }
                              },
                        secondary: CircleAvatar(
                          backgroundColor: u.brand.withValues(alpha: 0.12),
                          child: Text(
                            agent.initial,
                            style: TextStyle(color: u.brand),
                          ),
                        ),
                        title: Text(agent.displayName),
                        subtitle: Text(
                          voice == null
                              ? agent.roleLabel
                              : '${agent.roleLabel} · Gemini $voice',
                        ),
                      );
                    },
                  ),
                  if (index != supportAgents.length - 1)
                    const Divider(height: 1),
                ],
              ],
            ),
          ],
          const SizedBox(height: 16),
          _Card(
            children: [
              SwitchListTile(
                secondary: Icon(Icons.notifications_outlined, color: u.brand),
                title: const Text('Notifications'),
                subtitle: Text(
                  MobilePushService.instance.configured
                      ? 'Replies, requests and updates'
                      : 'Not available in this build',
                ),
                value:
                    MobilePushService.instance.configured && _notifications,
                onChanged: !MobilePushService.instance.configured
                    ? null
                    : (value) async {
                        if (value) {
                          final allowed = await MobilePushService.instance
                              .requestPermission();
                          if (!mounted) return;
                          setState(() => _notifications = allowed);
                          if (allowed) {
                            await ref
                                .read(agentDirectoryProvider.notifier)
                                .refresh();
                            await _refreshNotificationState();
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Notifications are disabled. You can enable them in system settings.',
                                ),
                              ),
                            );
                          }
                        } else {
                          await MobilePushService.instance.unregister();
                          if (mounted) {
                            setState(() => _notifications = false);
                          }
                        }
                      },
              ),
              const Divider(height: 1),
              ClearLocalAiChatsTile(
                onClear: () async {
                  // Never let a signed-out Settings view mutate another
                  // account's in-memory chat state. The chat controller itself
                  // fences its persisted cache by authenticated account ID.
                  final session = ref.read(sessionProvider);
                  if (session is! SessionSignedIn) {
                    throw StateError('Authentication required');
                  }
                  await ref.read(aiChatProvider.notifier).clearAll();
                  final current = ref.read(sessionProvider);
                  if (current is! SessionSignedIn ||
                      current.user.id != session.user.id) {
                    throw StateError('Session changed while clearing');
                  }
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.info_outline, color: u.brand),
                title: const Text('About Masanawa'),
                subtitle: const Text('Audio posts, Rooms, Gwani and Wallet'),
                onTap: () => showAboutDialog(
                  context: context,
                  applicationName: 'Masanawa',
                  // No guessed release version: package metadata must be integrated
                  // by AF00/AF14 before displaying an installed build ID.
                  children: const [
                    Text(
                      'Listen to audio posts, join Rooms, chat privately with Gwani, and access supported Wallet services.',
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _Card(
            children: [
              ListTile(
                key: const Key('settings-delete-account'),
                leading: Icon(Icons.person_remove_outlined, color: u.emergency),
                title: Text(
                  'Delete account',
                  style: TextStyle(color: u.emergency),
                ),
                subtitle: const Text('Account and data deletion options'),
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (_) => const AccountDeletionDialog(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _Card(
            children: [
              ListTile(
                leading: Icon(Icons.logout, color: u.emergency),
                title: Text(
                  'Log out',
                  style: TextStyle(
                    color: u.emergency,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onTap: () async {
                  await MobilePushService.instance.unregister();
                  await ref
                      .read(aiChatProvider.notifier)
                      .clearSecureShellState();
                  await ref.read(aiChatProvider.notifier).clearAll();
                  await ref.read(sessionProvider.notifier).logout();
                  if (context.mounted) context.go('/phone-login');
                },
              ),
            ],
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'Masanawa · Settings and privacy',
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


/// Deletes only the locally cached AI conversation list for the current
/// account. Human messages, server records, financial receipts and account
/// deletion are separate operations and are never implied by this control.
/// The explicit review avoids one-tap destructive action on small screens.
class ClearLocalAiChatsTile extends StatefulWidget {
  const ClearLocalAiChatsTile({super.key, required this.onClear});

  final Future<void> Function() onClear;

  @override
  State<ClearLocalAiChatsTile> createState() => _ClearLocalAiChatsTileState();
}

class _ClearLocalAiChatsTileState extends State<ClearLocalAiChatsTile> {
  bool _clearing = false;

  Future<void> _confirmClear() async {
    if (_clearing) return;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Clear AI chats on this device?'),
        content: const Text(
          'This clears your locally saved AI conversations and stops their '
          'active sessions. It does not delete human chats, server history, '
          'Wallet receipts or your account.',
        ),
        actions: [
          TextButton(
            key: const Key('settings-clear-ai-cancel'),
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const Key('settings-clear-ai-confirm'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Clear local AI chats'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true || _clearing) return;
    setState(() => _clearing = true);
    try {
      await widget.onClear();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..removeCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Local AI chats cleared')),
        );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..removeCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Could not clear local AI chats. Please try again.'),
          ),
        );
    } finally {
      if (mounted) setState(() => _clearing = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListTile(
        key: const Key('settings-clear-local-ai-chats'),
        leading: Icon(
          Icons.delete_outline,
          color: Theme.of(context).colorScheme.primary,
        ),
        title: const Text('Clear local AI chats'),
        subtitle: const Text('Remove AI conversations saved on this device'),
        enabled: !_clearing,
        trailing: _clearing
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : null,
        onTap: _clearing ? null : _confirmClear,
      );
}

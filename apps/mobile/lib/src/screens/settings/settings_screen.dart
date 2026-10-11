import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/mobile_push.dart';
import '../../features/account/device_security_client.dart';
import '../../features/account/device_security_screen.dart';
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
              ListTile(
                key: const Key('settings-device-security'),
                leading: Icon(Icons.phonelink_lock_outlined, color: u.brand),
                title: const Text('Device security'),
                subtitle: const Text('Review and sign out other signed-in devices'),
                onTap: user == null ? null : () {
                  // The existing ApiClient provides the sole authenticated Dio
                  // interceptor and refresh-token coordination. No second login.
                  final api = ref.read(apiClientProvider);
                  final transport = DioFanDevicesTransport(
                    api.dio,
                    ownerAccountId: user.id,
                    currentAccountId: () {
                      final current = ref.read(sessionProvider);
                      return current is SessionSignedIn ? current.user.id : null;
                    },
                    authorizationHeader: () async {
                      final token = ref.read(apiClientProvider).accessToken;
                      return token == null || token.isEmpty ? null : 'Bearer $token';
                    },
                  );
                  Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => DeviceSecurityScreen(transport: transport),
                  ));
                },
              ),
            ],
          ),
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
              ListTile(
                leading: Icon(Icons.delete_outline, color: u.brand),
                title: const Text('Clear all chats'),
                subtitle: const Text(
                  'Remove every conversation stored on this device',
                ),
                onTap: () async {
                  await ref.read(aiChatProvider.notifier).clearAll();
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('All chats cleared')),
                  );
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.info_outline, color: u.brand),
                title: const Text('About Masanawa'),
                subtitle: const Text('Masana, professional Rooms and services'),
                onTap: () => showAboutDialog(
                  context: context,
                  applicationName: 'Masanawa',
                  applicationVersion: '1.0.0',
                  children: const [
                    Text(
                      'Follow Masana professionals, learn in global Rooms, chat with Masana, and use Billing and Crypto privately.',
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

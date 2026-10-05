import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/ai_chat_state.dart';
import '../../state/agent_directory_state.dart';
import '../../state/creator_economy_state.dart';
import '../../state/creator_skills_state.dart';
import '../../state/session_state.dart';
import '../../core/providers.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../core/mobile_push.dart';

/// Settings + profile. The only secondary screen: account card, two local
/// toggles, clear-chat, log out. No feature links.
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

  Future<void> _addFloat(BuildContext context, int availableCredits) async {
    final controller = TextEditingController();
    final amount = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add Agent Float'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Available Credits: $availableCredits'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Credits to allocate',
                hintText: '100',
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Agent Float is execution capacity for your clone. It is not withdrawable earnings.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(controller.text.trim());
              if (value == null || value < 1 || value > availableCredits) {
                return;
              }
              Navigator.pop(dialogContext, value);
            },
            child: const Text('Add Float'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (amount == null || !mounted) return;

    await ref.read(creatorEconomyProvider.notifier).allocateFloat(amount);
    if (!mounted) return;
    final result = ref.read(creatorEconomyProvider);
    if (result.hasError) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not add Agent Float. Check your Credits and try again.'),
        ),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$amount Credits added to Agent Float')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final session = ref.watch(sessionProvider);
    final user = session is SessionSignedIn ? session.user : null;
    final name = user?.name ?? 'Citizen';
    final contact = user?.phone ?? user?.email ?? 'No contact saved';
    final directory = ref.watch(agentDirectoryProvider);
    final economy = ref.watch(creatorEconomyProvider);
    final economySnapshot = economy.asData?.value;
    final creatorSkills = ref.watch(creatorSkillsProvider);
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
            ListTile(
              leading: Icon(Icons.person_outline, color: u.brand),
              title: const Text('Your clone'),
              subtitle: Text(
                economySnapshot?.hasClone == true
                    ? 'Open your personal Masanawa clone'
                    : 'Create your one personal Masanawa clone',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                final characterId = economySnapshot?.characterId;
                if (characterId != null && characterId.isNotEmpty) {
                  context.push('/chat/$characterId');
                } else {
                  context.push('/clone');
                }
              },
            ),
          ]),
          const SizedBox(height: 16),
          _Card(children: [
            ListTile(
              leading: Icon(Icons.receipt_long_outlined, color: u.brand),
              title: const Text('Bills & payments'),
              subtitle: const Text(
                'Airtime, data, electricity, TV and other qualified services',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/billing'),
            ),
          ]),
          const SizedBox(height: 16),
          economy.when(
            data: (snapshot) {
              if (snapshot == null) return const SizedBox.shrink();
              return _Card(children: [
                ListTile(
                  leading: Icon(Icons.account_balance_wallet_outlined, color: u.brand),
                  title: const Text('Creator economy'),
                  subtitle: Text(
                    snapshot.hasClone
                        ? 'Credits fund work; earnings are kept separate'
                        : 'Create your clone to activate Agent Float',
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('Credits'),
                  trailing: Text('${snapshot.customerCredits}'),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('Agent Float'),
                  trailing: Text('${snapshot.agentFloatCredits}'),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('Earnings'),
                  subtitle: Text(
                    '${snapshot.pendingEarningsCredits} pending',
                  ),
                  trailing: Text('${snapshot.availableEarningsCredits} available'),
                ),
                if (snapshot.hasClone && snapshot.customerCredits > 0) ...[
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.add_circle_outline, color: u.brand),
                    title: const Text('Add Agent Float'),
                    subtitle: const Text('Allocate Credits so your clone can fund eligible work'),
                    onTap: () => _addFloat(context, snapshot.customerCredits),
                  ),
                ],
              ]);
            },
            loading: () => _Card(children: const [
              ListTile(
                leading: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                title: Text('Loading creator economy…'),
              ),
            ]),
            error: (_, __) => _Card(children: [
              ListTile(
                leading: Icon(Icons.sync_problem_outlined, color: u.brand),
                title: const Text('Creator economy unavailable'),
                subtitle: const Text('Tap to try again'),
                onTap: () => ref.read(creatorEconomyProvider.notifier).refresh(),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          if (economySnapshot?.hasClone == true)
            creatorSkills.when(
              data: (skills) {
                if (skills.isEmpty) return const SizedBox.shrink();
                return _Card(children: [
                  ListTile(
                    leading: Icon(Icons.extension_outlined, color: u.brand),
                    title: const Text('Clone Skills'),
                    subtitle: const Text(
                      'Add specialist abilities. Masanawa handles the technical setup.',
                    ),
                  ),
                  const Divider(height: 1),
                  for (var index = 0; index < skills.length; index++) ...[
                    Builder(
                      builder: (context) {
                        final skill = skills[index];
                        return SwitchListTile(
                          value: skill.enabled,
                          title: Text(skill.displayName),
                          subtitle: Text(skill.description),
                          onChanged: (enabled) async {
                            try {
                              await ref
                                  .read(creatorSkillsProvider.notifier)
                                  .setEnabled(skill, enabled);
                            } catch (_) {
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Could not update this Skill. Please try again.',
                                  ),
                                ),
                              );
                            }
                          },
                        );
                      },
                    ),
                    if (index != skills.length - 1)
                      const Divider(height: 1),
                  ],
                ]);
              },
              loading: () => _Card(children: const [
                ListTile(
                  leading: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  title: Text('Loading clone Skills…'),
                ),
              ]),
              error: (_, __) => _Card(children: [
                ListTile(
                  leading: Icon(Icons.sync_problem_outlined, color: u.brand),
                  title: const Text('Clone Skills unavailable'),
                  subtitle: const Text('Tap to try again'),
                  onTap: () =>
                      ref.read(creatorSkillsProvider.notifier).refresh(),
                ),
              ]),
            ),
          if (economySnapshot?.hasClone == true)
            const SizedBox(height: 16),
          if (supportAgents.isNotEmpty) ...[
            _Card(children: [
              ListTile(
                leading: Icon(Icons.support_agent_outlined, color: u.brand),
                title: const Text('Default Masanawa agent'),
                subtitle: const Text(
                  'Choose who handles support, onboarding and platform guidance',
                ),
              ),
              const Divider(height: 1),
              for (var index = 0; index < supportAgents.length; index++) ...[
                Builder(
                  builder: (context) {
                    final agent = supportAgents[index];
                    final selected = agent.defaultPlatformAgent;
                    final saving = _savingDefaultAgentId == agent.characterId;
                    final voice = agent.voiceName == null ||
                            agent.voiceName!.isEmpty
                        ? null
                        : agent.voiceName;
                    return RadioListTile<String>(
                      value: agent.characterId,
                      groupValue: selectedSupportAgentId,
                      onChanged: saving
                          ? null
                          : (value) async {
                              if (value == null || selected) return;
                              setState(() => _savingDefaultAgentId = value);
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
                                  setState(() => _savingDefaultAgentId = null);
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
                            : '${agent.roleLabel} · Gemini ${voice}',
                      ),
                    );
                  },
                ),
                if (index != supportAgents.length - 1)
                  const Divider(height: 1),
              ],
            ]),
            const SizedBox(height: 16),
          ],
          _Card(children: [
            SwitchListTile(
              secondary: Icon(Icons.notifications_outlined, color: u.brand),
              title: const Text('Notifications'),
              subtitle: const Text('Replies and updates'),
              value: _notifications,
              onChanged: (v) async {
                if (v) {
                  final allowed =
                      await MobilePushService.instance.requestPermission();
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
                  if (mounted) setState(() => _notifications = false);
                }
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.delete_outline, color: u.brand),
              title: const Text('Clear all chats'),
              subtitle: const Text('Remove every conversation on this device'),
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
                await MobilePushService.instance.unregister();
                await ref.read(aiChatProvider.notifier).clearSecureShellState();
                await ref.read(aiChatProvider.notifier).clearAll();
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

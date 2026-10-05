import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/mobile_push.dart';
import '../../owner_access/owner_access.dart';
import '../../owner_access/owner_access_state.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/my_twin_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

/// Secondary account settings for the Twin-first product.
///
/// Runtime concepts such as Agent Float, Skills and provider configuration stay
/// out of the ordinary customer surface. The user's own Twin and human-access
/// availability are the only Twin configuration exposed here.
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

  Future<int?> _askHumanAccessPrice(
    BuildContext context,
    int current,
  ) async {
    final controller = TextEditingController(
      text: current > 0 ? current.toString() : '',
    );
    final result = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Human access price'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Set the price per minute after the customer\'s trial. '
              'Masanawa holds paid requests until the session is completed.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Credits per minute',
                hintText: '10',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(controller.text.trim());
              if (value == null || value < 1 || value > 1000000) return;
              Navigator.of(dialogContext).pop(value);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<List<int>?> _askHumanAccessDurations(
    BuildContext context,
    List<int> current,
  ) async {
    final selected = <int>{
      ...current.where(const {15, 30, 60}.contains),
    };
    if (selected.isEmpty) selected.add(15);

    return showDialog<List<int>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Session lengths'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final minutes in const [15, 30, 60])
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: selected.contains(minutes),
                  title: Text('$minutes minutes'),
                  onChanged: (enabled) {
                    setDialogState(() {
                      if (enabled == true) {
                        selected.add(minutes);
                      } else if (selected.length > 1) {
                        selected.remove(minutes);
                      }
                    });
                  },
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final values = selected.toList()..sort();
                Navigator.of(dialogContext).pop(values);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveHumanAccess(
    BuildContext context,
    OwnerAccessOffering offering,
  ) async {
    final saved =
        await ref.read(ownerAccessOfferingProvider.notifier).save(offering);
    if (!context.mounted) return;
    if (saved == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update human access. Please try again.'),
        ),
      );
      return;
    }
    unawaited(ref.read(myTwinProvider.notifier).refresh());
  }

  Future<void> _toggleHumanAccess(
    BuildContext context,
    OwnerAccessOffering offering,
    bool enabled,
  ) async {
    var next = offering;
    if (enabled && offering.priceCreditsPerMinute < 1) {
      final price =
          await _askHumanAccessPrice(context, offering.priceCreditsPerMinute);
      if (price == null || !context.mounted) return;
      next = next.copyWith(priceCreditsPerMinute: price);
    }
    await _saveHumanAccess(context, next.copyWith(enabled: enabled));
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final session = ref.watch(sessionProvider);
    final user = session is SessionSignedIn ? session.user : null;
    final name = user?.name ?? 'Citizen';
    final contact = user?.phone ?? user?.email ?? 'No contact saved';

    final myTwin = ref.watch(myTwinProvider);
    final twin = myTwin.valueOrNull;
    final hasTwin = twin?.hasTwin == true && twin?.characterId != null;
    final humanAccess = ref.watch(ownerAccessOfferingProvider);

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
          const SizedBox(height: 16),
          _Card(
            children: [
              ListTile(
                leading: Icon(Icons.auto_awesome_outlined, color: u.brand),
                title: const Text('My Twin'),
                subtitle: Text(
                  hasTwin
                      ? 'Open your Twin'
                      : 'Create your personal AI Twin',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  final characterId = twin?.characterId;
                  if (hasTwin && characterId != null) {
                    context.push('/chat/${Uri.encodeComponent(characterId)}');
                  } else {
                    context.push('/clone');
                  }
                },
              ),
            ],
          ),
          if (hasTwin) ...[
            const SizedBox(height: 16),
            humanAccess.when(
              loading: () => _Card(
                children: const [
                  ListTile(
                    leading: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    title: Text('Loading human access…'),
                  ),
                ],
              ),
              error: (_, __) => _Card(
                children: [
                  ListTile(
                    leading: Icon(Icons.sync_problem_outlined, color: u.brand),
                    title: const Text('Human access unavailable'),
                    subtitle: const Text('Tap to try again'),
                    onTap: () => ref
                        .read(ownerAccessOfferingProvider.notifier)
                        .refresh(),
                  ),
                ],
              ),
              data: (offering) {
                if (offering == null) return const SizedBox.shrink();
                return _Card(
                  children: [
                    SwitchListTile(
                      secondary: Icon(Icons.person_pin_outlined, color: u.brand),
                      title: const Text('Talk to me'),
                      subtitle: Text(
                        offering.enabled
                            ? 'People can request a paid session with the real you'
                            : 'Keep real-person requests off until you are ready',
                      ),
                      value: offering.enabled,
                      onChanged: (enabled) =>
                          _toggleHumanAccess(context, offering, enabled),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      title: const Text('Price after trial'),
                      subtitle: const Text('Credits per minute'),
                      trailing: Text(
                        offering.priceCreditsPerMinute < 1
                            ? 'Set price'
                            : '${offering.priceCreditsPerMinute} Cr/min',
                      ),
                      onTap: () async {
                        final price = await _askHumanAccessPrice(
                          context,
                          offering.priceCreditsPerMinute,
                        );
                        if (price == null || !context.mounted) return;
                        await _saveHumanAccess(
                          context,
                          offering.copyWith(priceCreditsPerMinute: price),
                        );
                      },
                    ),
                    const Divider(height: 1),
                    ListTile(
                      title: const Text('Session lengths'),
                      subtitle: Text(
                        offering.durationOptionsMinutes
                            .map((value) => '$value min')
                            .join(' · '),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        final durations = await _askHumanAccessDurations(
                          context,
                          offering.durationOptionsMinutes,
                        );
                        if (durations == null || !context.mounted) return;
                        await _saveHumanAccess(
                          context,
                          offering.copyWith(
                            durationOptionsMinutes: durations,
                          ),
                        );
                      },
                    ),
                  ],
                );
              },
            ),
          ],
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
                subtitle: const Text('Personal AI Twins and Masanawa services'),
                onTap: () => showAboutDialog(
                  context: context,
                  applicationName: 'Masanawa',
                  applicationVersion: '1.0.0',
                  children: const [
                    Text(
                      'Create your Twin, explore other Twins and use Masanawa services from one simple app.',
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

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
import 'clear_device_chats_dialog.dart';

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
  bool _notificationReady = false;
  bool _notificationBusy = false;
  bool _notificationLoadError = false;
  int _notificationEpoch = 0;
  int _supportMutationEpoch = 0;
  String? _savingDefaultAgentId;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshNotificationState());
  }

  Future<void> _refreshNotificationState() async {
    final epoch = ++_notificationEpoch;
    try {
      final enabled = await MobilePushService.instance.notificationEnabled();
      if (!mounted || epoch != _notificationEpoch) return;
      setState(() {
        _notifications = enabled;
        _notificationReady = true;
        _notificationLoadError = false;
      });
    } catch (_) {
      if (!mounted || epoch != _notificationEpoch) return;
      setState(() {
        _notificationReady = false;
        _notificationLoadError = true;
      });
    }
  }

  Future<void> _setNotifications(bool enabled) async {
    if (_notificationBusy) return;
    setState(() => _notificationBusy = true);
    final epoch = ++_notificationEpoch;
    try {
      if (enabled) {
        await MobilePushService.instance.requestPermission();
      } else {
        await MobilePushService.instance.unregister();
      }
      final verified = await MobilePushService.instance.notificationEnabled();
      if (!mounted || epoch != _notificationEpoch) return;
      setState(() {
        _notifications = verified;
        _notificationReady = true;
        _notificationLoadError = false;
      });
      if (enabled && !verified) {
        _showFeedback('Notifications are not permitted. Check system settings and retry.');
      }
    } catch (_) {
      if (!mounted || epoch != _notificationEpoch) return;
      setState(() {
        _notificationReady = false;
        _notificationLoadError = true;
      });
      _showFeedback('Could not update notifications. Retry after checking your connection.');
    } finally {
      if (mounted && epoch == _notificationEpoch) {
        setState(() => _notificationBusy = false);
      }
    }
  }

  void _showFeedback(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _chooseSupportAgent({
    required String accountId,
    required String characterId,
    required String displayName,
  }) async {
    if (_savingDefaultAgentId != null) return;
    final ticket = ++_supportMutationEpoch;
    setState(() => _savingDefaultAgentId = characterId);
    try {
      await ref.read(agentDirectoryTransportProvider)
          .setDefaultPlatformAgent(characterId);
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (!mounted) return;
      final current = ref.read(sessionProvider);
      if (current is! SessionSignedIn || current.user.id != accountId) return;
      final confirmed = ref.read(agentDirectoryProvider).agents.any(
        (agent) => agent.characterId == characterId && agent.defaultPlatformAgent,
      );
      _showFeedback(confirmed
          ? '$displayName is your default Masanawa agent.'
          : 'The change could not be confirmed. Refresh and try again.');
    } catch (_) {
      if (!mounted) return;
      final current = ref.read(sessionProvider);
      if (current is SessionSignedIn && current.user.id == accountId) {
        _showFeedback('Could not update your default agent. Please try again.');
      }
    } finally {
      if (mounted && ticket == _supportMutationEpoch) {
        setState(() => _savingDefaultAgentId = null);
      }
    }
  }

  Future<void> _confirmClearChats() async {
    final current = ref.read(sessionProvider);
    if (current is! SessionSignedIn) return;
    final ownerId = current.user.id;
    final cleared = await showDialog<bool>(
      context: context,
      builder: (_) => ClearDeviceChatsDialog(
        onConfirm: () async {
          final now = ref.read(sessionProvider);
          if (now is! SessionSignedIn || now.user.id != ownerId) {
            throw StateError('Account changed before local cleanup');
          }
          await ref.read(aiChatProvider.notifier).clearAll();
        },
      ),
    );
    if (!mounted || cleared != true) return;
    final now = ref.read(sessionProvider);
    if (now is SessionSignedIn && now.user.id == ownerId) {
      _showFeedback('Conversations cached on this device were cleared.');
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SessionState>(sessionProvider, (before, after) {
      final oldOwner = before is SessionSignedIn ? before.user.id : null;
      final newOwner = after is SessionSignedIn ? after.user.id : null;
      if (oldOwner == newOwner || !mounted) return;
      ++_notificationEpoch;
      ++_supportMutationEpoch;
      setState(() {
        _notifications = false;
        _notificationReady = false;
        _notificationLoadError = false;
        _notificationBusy = false;
        _savingDefaultAgentId = null;
      });
      unawaited(_refreshNotificationState());
    });
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
          Semantics(
            button: true,
            label: 'Edit your profile',
            child: InkWell(
              onTap: () => context.push('/profile'),
              child: Container(
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
                      return RadioListTile<String>(
                        value: agent.characterId,
                        groupValue: selectedSupportAgentId,
                        onChanged: saving || _savingDefaultAgentId != null ||
                                user == null
                            ? null
                            : (value) {
                                if (value == null || selected) return;
                                unawaited(_chooseSupportAgent(
                                  accountId: user.id,
                                  characterId: value,
                                  displayName: agent.displayName,
                                ));
                              },
                        secondary: CircleAvatar(
                          backgroundColor: u.brand.withValues(alpha: 0.12),
                          child: Text(
                            agent.initial,
                            style: TextStyle(color: u.brand),
                          ),
                        ),
                        title: Text(agent.displayName),
                        subtitle: Text(agent.roleLabel),
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
                key: const Key('settings-notifications-toggle'),
                secondary: Icon(Icons.notifications_outlined, color: u.brand),
                title: const Text('Notifications'),
                subtitle: Text(
                  !MobilePushService.instance.configured
                      ? 'Not available in this build'
                      : _notificationBusy
                          ? 'Checking notification permission…'
                          : _notificationLoadError
                              ? 'Could not verify permission. Retry below.'
                              : 'Device permission; delivery also requires a connection',
                ),
                value: MobilePushService.instance.configured &&
                    _notificationReady && _notifications,
                onChanged: !MobilePushService.instance.configured ||
                        !_notificationReady || _notificationBusy
                    ? null
                    : (value) => unawaited(_setNotifications(value)),
              ),
              if (_notificationLoadError &&
                  MobilePushService.instance.configured)
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton.icon(
                    onPressed: _notificationBusy
                        ? null
                        : () => unawaited(_refreshNotificationState()),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry permission check'),
                  ),
                ),
              const Divider(height: 1),
              ListTile(
                key: const Key('settings-clear-device-chats'),
                leading: Icon(Icons.delete_outline, color: u.brand),
                title: const Text('Clear chats on this device'),
                subtitle: const Text(
                  'Remove locally cached Masana conversations, not server history or receipts',
                ),
                onTap: user == null ? null : () => unawaited(_confirmClearChats()),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(Icons.info_outline, color: u.brand),
                title: const Text('About Masanawa'),
                subtitle: const Text('Chats, Status, Calls, Rooms and Wallet'),
                onTap: () => showAboutDialog(
                  context: context,
                  applicationName: 'Masanawa',

                  children: const [
                    Text(
                      'Chat with Masana personas, view their Status updates, make calls, explore Rooms and use Wallet services.',
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
              'Masanawa · Chats · Status · Wallet · Calls · Rooms',
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

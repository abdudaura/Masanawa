import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../account_preferences/notification_switch_controller.dart';
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
  late final NotificationSwitchController _notificationController;
  String? _notificationAccountId;
  int _supportMutationEpoch = 0;
  String? _savingDefaultAgentId;

  @override
  void initState() {
    super.initState();
    _notificationController = NotificationSwitchController(
      readEnabled: MobilePushService.instance.notificationEnabled,
      requestPermission: MobilePushService.instance.requestPermission,
      unregister: MobilePushService.instance.unregister,
      // Preserve canonical push reattachment from the newer Settings source.
      // A granted OS permission does not guarantee server-side delivery.
      onEnabled: () async {
        await ref.read(agentDirectoryProvider.notifier).refresh();
      },
    )..addListener(_notificationChanged);
  }

  void _notificationChanged() {
    if (mounted) setState(() {});
  }

  void _bindNotificationAccount(String? accountId) {
    if (_notificationAccountId == accountId) return;
    _notificationAccountId = accountId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _notificationAccountId != accountId) return;
      unawaited(_notificationController.bind(accountId));
    });
  }

  Future<void> _setNotifications(bool requested) async {
    final ownerId = _notificationAccountId;
    final changed = await _notificationController.change(requested);
    if (!mounted || _notificationAccountId != ownerId) return;
    if (!changed && _notificationController.error != null) {
      _showFeedback(_notificationController.error!);
    }
  }

  @override
  void dispose() {
    _notificationController.removeListener(_notificationChanged);
    _notificationController.dispose();
    super.dispose();
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
      ++_supportMutationEpoch;
      _bindNotificationAccount(newOwner);
      setState(() => _savingDefaultAgentId = null);
    });
    final u = context.masanawa;
    final session = ref.watch(sessionProvider);
    final user = session is SessionSignedIn ? session.user : null;
    _bindNotificationAccount(user?.id);
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
                RadioGroup<String>(
                  groupValue: selectedSupportAgentId,
                  onChanged: (value) {
                    if (value == null || user == null ||
                        _savingDefaultAgentId != null) return;
                    for (final agent in supportAgents) {
                      if (agent.characterId != value ||
                          agent.defaultPlatformAgent) continue;
                      unawaited(_chooseSupportAgent(
                        accountId: user.id,
                        characterId: value,
                        displayName: agent.displayName,
                      ));
                      break;
                    }
                  },
                  child: Column(
                    children: [
                      for (var index = 0; index < supportAgents.length; index++) ...[
                        Builder(
                          builder: (context) {
                            final agent = supportAgents[index];
                            return RadioListTile<String>(
                              value: agent.characterId,
                              enabled: user != null &&
                                  _savingDefaultAgentId == null,
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
                ),
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
                      : _notificationController.loading ||
                              _notificationController.saving
                          ? 'Checking notification permission…'
                          : _notificationController.error ??
                              'Device permission; delivery also requires a connection',
                ),
                value: MobilePushService.instance.configured &&
                    _notificationController.accountId == _notificationAccountId &&
                    _notificationController.enabled,
                onChanged: !MobilePushService.instance.configured ||
                        user == null ||
                        _notificationController.accountId != _notificationAccountId ||
                        !_notificationController.canChange
                    ? null
                    : (value) => unawaited(_setNotifications(value)),
              ),
              if (_notificationController.error != null &&
                  MobilePushService.instance.configured)
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton.icon(
                    onPressed: _notificationController.canRefresh
                        ? () => unawaited(_notificationController.refresh())
                        : null,
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
                onTap: user == null
                    ? null
                    : () => unawaited(_confirmClearChats()),
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

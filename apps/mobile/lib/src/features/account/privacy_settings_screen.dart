import 'package:flutter/material.dart';
import 'privacy_settings_repository.dart';

/// C06: controls optional push only; Room answers, receipts and cases stay in
/// the persistent in-app inbox even when all switches are off.
class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({
    super.key, required this.repository, required this.accountKey,
    this.onMemory, this.onLanguage, this.onTheme, this.onNotificationInbox,
    this.onDeviceSecurity, this.onSignIn,
  });
  final DeliverySettingsRepository repository;
  final String accountKey;
  final VoidCallback? onMemory, onLanguage, onTheme, onNotificationInbox;
  final VoidCallback? onDeviceSecurity, onSignIn;
  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  List<DeliveryPreference> choices = const [];
  String? error;
  bool loading = true;
  String? saving;
  int epoch = 0;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void didUpdateWidget(covariant PrivacySettingsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountKey != widget.accountKey ||
        oldWidget.repository != widget.repository) {
      epoch++;
      choices = const [];
      saving = null;
      _load();
    }
  }

  Future<void> _load() async {
    final token = ++epoch;
    setState(() { loading = true; error = null; });
    if (widget.accountKey.isEmpty) {
      if (mounted && token == epoch) setState(() { loading = false; error = 'Sign in to manage your privacy.'; });
      return;
    }
    try {
      final next = await widget.repository.load();
      if (mounted && token == epoch) {
        setState(() { choices = next; loading = false; });
      }
    } catch (_) {
      if (mounted && token == epoch) {
        setState(() { loading = false; error = 'Preferences unavailable. Check your connection and retry.'; });
      }
    }
  }

  Future<void> _toggle(DeliveryPreference choice, bool value) async {
    if (saving != null || loading || widget.accountKey.isEmpty) return;
    final token = epoch;
    setState(() { saving = choice.kind; error = null; });
    try {
      final confirmed = await widget.repository.update(choice.kind, value);
      if (mounted && token == epoch) {
        setState(() => choices = [
          for (final current in choices)
            current.kind == confirmed.kind ? confirmed : current,
        ]);
      }
    } catch (_) {
      if (mounted && token == epoch) {
        setState(() { error = 'Could not save this change. Retry when connected.'; });
      }
    } finally {
      if (mounted && token == epoch) setState(() => saving = null);
    }
  }

  String _label(String kind) {
    switch (kind) {
      case 'comment_reply': return 'Replies to my comments';
      case 'room_answer': return 'Answers to my Room questions';
      case 'followed_post': return 'Posts from followed Masana';
      case 'subscription': return 'Subscription updates';
      case 'wallet': return 'Wallet status updates';
      case 'case_update': return 'Gwani case updates';
      default: return 'Notification';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings & privacy')),
      body: ListView(children: [
        const ListTile(title: Text('Your account'), subtitle: Text('Your settings are private to this account.')),
        ListTile(title: const Text('Language'), leading: const Icon(Icons.language),
          trailing: const Icon(Icons.chevron_right), enabled: widget.onLanguage != null,
          onTap: widget.onLanguage),
        ListTile(title: const Text('Appearance'), leading: const Icon(Icons.palette_outlined),
          trailing: const Icon(Icons.chevron_right), enabled: widget.onTheme != null,
          onTap: widget.onTheme),
        ListTile(title: const Text('Masana memory'), subtitle: const Text('View, correct or disable memories for each Masana'),
          leading: const Icon(Icons.psychology_outlined), enabled: widget.onMemory != null,
          onTap: widget.onMemory),
        ListTile(title: const Text('Device security'), leading: const Icon(Icons.devices_outlined),
          enabled: widget.onDeviceSecurity != null, onTap: widget.onDeviceSecurity),
        const Divider(),
        const ListTile(title: Text('Optional push notifications'),
          subtitle: Text('Changing these switches never removes important notices from your in-app inbox.')),
        if (widget.accountKey.isEmpty)
          ListTile(title: const Text('Sign in to choose notifications'), trailing: TextButton(
            onPressed: widget.onSignIn, child: const Text('Sign in')))
        else if (loading)
          const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
        else ...[
          for (final choice in choices)
            SwitchListTile(
              key: Key('delivery-${choice.kind}'),
              title: Text(_label(choice.kind)),
              subtitle: saving == choice.kind ? const Text('Saving…') : null,
              value: choice.enabled,
              onChanged: saving != null ? null : (value) => _toggle(choice, value),
            ),
          if (choices.isEmpty) const ListTile(title: Text('No preferences available.')),
        ],
        if (error != null) Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(error!, style: TextStyle(color: theme.colorScheme.error)),
            TextButton(onPressed: loading || saving != null ? null : _load,
              child: const Text('Retry')),
          ]),
        ),
        ListTile(title: const Text('Notification inbox'), leading: const Icon(Icons.notifications_outlined),
          enabled: widget.onNotificationInbox != null, onTap: widget.onNotificationInbox),
      ]),
    );
  }
}

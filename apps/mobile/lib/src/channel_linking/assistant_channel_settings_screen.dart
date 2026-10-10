import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/providers.dart';
import '../core/network/api_client.dart';
import '../state/session_state.dart';
import 'assistant_link_transport.dart';

/// Nested Settings page. F12 owns the app-wide route integration.
class AssistantChannelSettingsScreen extends ConsumerStatefulWidget {
  const AssistantChannelSettingsScreen({super.key});

  @override
  ConsumerState<AssistantChannelSettingsScreen> createState() =>
      _AssistantChannelSettingsScreenState();
}

class _AssistantChannelSettingsScreenState
    extends ConsumerState<AssistantChannelSettingsScreen> {
  List<LinkedAssistantChannel>? _items;
  final Map<AssistantChannel, AssistantLinkChallenge> _codes = {};
  String? _error;
  AssistantChannel? _busy;
  bool _loading = false;
  String? _owner;
  int _epoch = 0;

  String? _signedInOwner(SessionState state) =>
      state is SessionSignedIn ? state.user.id : null;

  AssistantLinkTransport get _api =>
      AssistantLinkTransport(ref.read(apiClientProvider));

  bool _isCurrent(String owner, int epoch) =>
      mounted && epoch == _epoch &&
      _signedInOwner(ref.read(sessionProvider)) == owner;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reload();
    });
  }

  Future<void> _reload() async {
    final owner = _signedInOwner(ref.read(sessionProvider));
    if (owner == null) return;
    final epoch = _epoch;
    setState(() { _loading = true; _error = null; });
    try {
      final result = await _api.status();
      if (_isCurrent(owner, epoch)) {
        setState(() { _items = result; _loading = false; });
      }
    } catch (_) {
      if (_isCurrent(owner, epoch)) {
        setState(() {
          _loading = false;
          _error = 'Could not refresh channel status. Try again.';
        });
      }
    }
  }

  Future<void> _run(AssistantChannel channel, String action) async {
    final owner = _signedInOwner(ref.read(sessionProvider));
    if (owner == null) return;
    final epoch = _epoch;
    setState(() { _busy = channel; _error = null; });
    try {
      if (action == 'begin') {
        final challenge = await _api.begin(channel);
        if (_isCurrent(owner, epoch)) {
          setState(() { _codes[channel] = challenge; });
        }
      } else if (action == 'prefer') {
        await _api.prefer(channel);
      } else {
        await _api.unlink(channel);
        if (_isCurrent(owner, epoch)) {
          setState(() { _codes.remove(channel); });
        }
      }
      if (_isCurrent(owner, epoch)) await _reload();
    } catch (error) {
      if (_isCurrent(owner, epoch)) {
        setState(() {
          _error = error is ApiException ? error.message : 'Unable to confirm the channel change. Check your connection and retry.';
        });
      }
    } finally {
      if (_isCurrent(owner, epoch)) setState(() { _busy = null; });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SessionState>(sessionProvider, (_, next) {
      final incoming = _signedInOwner(next);
      if (incoming == _owner) return;
      _owner = incoming;
      _epoch++;
      setState(() {
        _items = null; _codes.clear(); _error = null; _busy = null;
      });
      if (incoming != null) _reload();
    });
    final signedIn = _signedInOwner(ref.watch(sessionProvider)) != null;
    return Scaffold(
      appBar: AppBar(title: const Text('Linked assistant channels')),
      body: !signedIn
          ? const Center(child: Text('Sign in to manage your channels.'))
          : RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Talk to Gwani or Gwana from WhatsApp or Telegram. '
                    'These are assistant channels, not private human Chats. '
                    'Messages sent there are processed by the messaging provider.',
                  ),
                  if (_error != null)
                    Semantics(
                      liveRegion: true,
                      child: ListTile(
                        leading: const Icon(Icons.error_outline),
                        title: Text(_error!),
                        trailing: TextButton(
                            onPressed: _loading ? null : _reload,
                            child: const Text('Retry')),
                      ),
                    ),
                  if (_loading && _items == null)
                    const Center(child: CircularProgressIndicator()),
                  for (final channel in AssistantChannel.values)
                    _channelCard(channel),
                ],
              ),
            ),
    );
  }

  Widget _channelCard(AssistantChannel channel) {
    LinkedAssistantChannel? status;
    for (final value in _items ?? <LinkedAssistantChannel>[]) {
      if (value.channel == channel) status = value;
    }
    final challenge = _codes[channel];
    final locked = _busy != null || _loading || _items == null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(channel.title),
              subtitle: Text(status?.linked == true
                  ? (status!.preferred ? 'Linked · Preferred' : 'Linked')
                  : 'Not linked'),
            ),
            if (challenge != null &&
                DateTime.now().isBefore(challenge.expires) &&
                status?.linked != true) ...[
              const Text('Send this one-time code to the official provider chat:'),
              SelectableText(challenge.code,
                  style: Theme.of(context).textTheme.titleLarge),
              Wrap(spacing: 8, children: [
                OutlinedButton.icon(
                  onPressed: () => Clipboard.setData(
                      ClipboardData(text: challenge.code)),
                  icon: const Icon(Icons.copy),
                  label: const Text('Copy code'),
                ),
                FilledButton(
                  onPressed: () async {
                    if (trustedAssistantDestination(challenge.destination, channel)) {
                      await launchUrl(challenge.destination,
                          mode: LaunchMode.externalApplication);
                    }
                  },
                  child: Text('Open ' + channel.title),
                ),
              ]),
              const Text('Code expires in five minutes. Return and refresh '
                  'to see the verified connection.'),
            ],
            if (status?.linked == true) ...[
              OutlinedButton(
                onPressed: locked || status?.preferred == true
                    ? null : () => _run(channel, 'prefer'),
                child: const Text('Use as preferred channel'),
              ),
              TextButton(
                onPressed: locked ? null : () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: Text('Unlink ' + channel.title + '?'),
                      content: const Text('This will revoke access from '
                          'future provider messages to your Masanawa account.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: const Text('Unlink'),
                        ),
                      ],
                    ),
                  );
                  if (ok == true) await _run(channel, 'unlink');
                },
                child: Text('Unlink ' + channel.title),
              ),
            ] else
              FilledButton(
                onPressed: locked ? null : () => _run(channel, 'begin'),
                child: Text('Connect ' + channel.title),
              ),
            if (_busy == channel) const LinearProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

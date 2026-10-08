import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'invite_share.dart';

/// Nested Contacts share entry; F12 mounts it without touching root tabs.
/// The generic invitation works without Contacts permission or a login.
class InviteShareSheet extends StatefulWidget {
  const InviteShareSheet({
    super.key,
    required this.coordinator,
    this.allowPersonal = false,
  });

  final InviteShareCoordinator coordinator;
  final bool allowPersonal;

  @override
  State<InviteShareSheet> createState() => _InviteShareSheetState();
}

class _InviteShareSheetState extends State<InviteShareSheet> {
  bool _busy = false;
  String? _error;
  bool _copied = false;

  Future<void> _send({required bool personal}) async {
    if (_busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (personal) {
        await widget.coordinator.sharePersonal();
      } else {
        await widget.coordinator.shareGeneric();
      }
    } catch (error) {
      if (!mounted) return;
      final message = error is InviteShareSessionChanged
          ? 'Your account changed. Sign in again before sharing your profile.'
          : 'Unable to share right now. Check your connection or try the general invite.';
      setState(() => _error = message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copyGeneral() async {
    try {
      await Clipboard.setData(
        ClipboardData(text: InviteShareLink.generic().uri.toString()),
      );
      if (mounted) setState(() { _copied = true; _error = null; });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not copy the link.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Invite friends', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text(
              'Choose where to share. We do not upload your phone contacts, '
              'send invitations automatically, or promise referral earnings.',
            ),
            const SizedBox(height: 16),
            SelectableText(InviteShareLink.generic().uri.toString()),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton.icon(
                onPressed: _busy ? null : _copyGeneral,
                icon: Icon(_copied ? Icons.check : Icons.copy_outlined),
                label: Text(_copied ? 'Copied' : 'Copy link'),
              )),
              const SizedBox(width: 8),
              Expanded(child: FilledButton.icon(
                onPressed: _busy ? null : () => _send(personal: false),
                icon: const Icon(Icons.share_outlined),
                label: const Text('Share invite'),
              )),
            ]),
            if (widget.allowPersonal) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _send(personal: true),
                icon: const Icon(Icons.person_add_alt_1_outlined),
                label: const Text('Share my public profile invitation'),
              ),
              const Text(
                'Only your public @handle is suggested. The other person must '
                'sign in and ask to connect; your account privacy still applies.',
              ),
            ],
            if (_busy) const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(),
            ),
            if (_error != null) Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          ],
        ),
      ),
    );
  }
}

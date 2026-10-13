import 'package:flutter/material.dart';

/// Confirms a device-scoped chat cleanup; never suggests that a server-side
/// history, financial record, or account deletion has occurred.
class ClearDeviceChatsDialog extends StatefulWidget {
  const ClearDeviceChatsDialog({super.key, required this.onConfirm});

  final Future<void> Function() onConfirm;

  @override
  State<ClearDeviceChatsDialog> createState() =>
      _ClearDeviceChatsDialogState();
}

class _ClearDeviceChatsDialogState extends State<ClearDeviceChatsDialog> {
  bool _clearing = false;
  String? _error;

  Future<void> _confirm() async {
    if (_clearing) return;
    setState(() {
      _clearing = true;
      _error = null;
    });
    try {
      await widget.onConfirm();
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _clearing = false;
        _error = 'Could not clear local chats. Nothing was confirmed. '
            'Check your connection and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Clear chats on this device?'),
    content: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'This removes cached Masana conversations and temporary voice '
            'media from this device. It does not delete server-held history, '
            'your account, or financial receipts. Synced chats may reappear.',
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              key: const Key('clear-device-chats-error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_clearing) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _clearing ? null : () => Navigator.of(context).pop(false),
        child: const Text('Keep chats'),
      ),
      FilledButton(
        key: const Key('confirm-clear-device-chats'),
        onPressed: _clearing ? null : _confirm,
        child: const Text('Clear local chats'),
      ),
    ],
  );
}

import 'package:flutter/material.dart';

import '../../services/private_service_intent.dart';

/// An explicit non-paying handoff card. No microphone starts on mount.
/// Failed sends leave the same request available for retry.
class PrivateServiceIntentPrompt extends StatefulWidget {
  const PrivateServiceIntentPrompt({
    super.key,
    required this.intent,
    required this.onContinue,
    required this.onOpenEditor,
    required this.onDismiss,
    this.canContinue = true,
  });

  final PrivateServiceIntent intent;
  final Future<void> Function() onContinue;
  final VoidCallback onOpenEditor;
  final VoidCallback onDismiss;
  final bool canContinue;

  @override
  State<PrivateServiceIntentPrompt> createState() =>
      _PrivateServiceIntentPromptState();
}

class _PrivateServiceIntentPromptState extends State<PrivateServiceIntentPrompt> {
  bool _sending = false;
  String? _error;

  Future<void> _continue() async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.onContinue();
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not start this request. Try again or use the service form.';
        });
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Material(
      color: colors.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(Icons.lock_outline_rounded, size: 18, color: colors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.intent.displayName + ' · Private',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  tooltip: 'Dismiss service request',
                  onPressed: _sending ? null : widget.onDismiss,
                  icon: const Icon(Icons.close, size: 19),
                ),
              ],
            ),
            const Text(
              'Continue with your assistant or use the existing service form. '
              'No payment or microphone is started by selecting a service.',
            ),
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!, style: TextStyle(color: colors.error)),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                FilledButton(
                  onPressed: _sending || !widget.canContinue ? null : _continue,
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continue in Talk'),
                ),
                OutlinedButton(
                  onPressed: _sending ? null : widget.onOpenEditor,
                  child: const Text('Use service form'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

class TalkGiftSheet extends StatefulWidget {
  const TalkGiftSheet({
    super.key,
    required this.hostName,
    required this.onGift,
  });

  final String hostName;
  final Future<bool> Function(int amountCredits) onGift;

  @override
  State<TalkGiftSheet> createState() => _TalkGiftSheetState();
}

class _TalkGiftSheetState extends State<TalkGiftSheet> {
  int? _selected;
  bool _sending = false;
  String? _error;

  Future<void> _send() async {
    final selected = _selected;
    if (selected == null || _sending) return;

    setState(() {
      _sending = true;
      _error = null;
    });

    var sent = false;
    try {
      sent = await widget.onGift(selected);
    } catch (_) {
      sent = false;
    }

    if (!mounted) return;
    if (sent) {
      Navigator.of(context).pop(true);
      return;
    }

    setState(() {
      _sending = false;
      _error = 'Gift couldn’t be sent. Check your balance and try again.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    const options = [50, 100, 500, 1000];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34,
              height: 4,
              decoration: BoxDecoration(
                color: u.structuralBorder,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Gift ' + widget.hostName,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              'Send Credits to the Host.',
              style: TextStyle(
                color: u.textMuted,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final amount in options)
                  ChoiceChip(
                    key: ValueKey('talk-gift-' + amount.toString()),
                    label: Text(amount.toString() + ' Cr'),
                    selected: _selected == amount,
                    onSelected: _sending
                        ? null
                        : (_) => setState(() {
                              _selected = amount;
                              _error = null;
                            }),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                key: const ValueKey('talk-gift-error'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: u.emergency,
                  fontSize: 12.5,
                ),
              ),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const ValueKey('talk-gift-send'),
                onPressed: _selected == null || _sending ? null : _send,
                child: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Send gift'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

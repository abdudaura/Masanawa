import 'package:flutter/material.dart';

class GiftSheet extends StatefulWidget {
  const GiftSheet({
    super.key,
    required this.recipientName,
    required this.onGift,
  });

  final String recipientName;
  final Future<void> Function(int amountCredits) onGift;

  @override
  State<GiftSheet> createState() => _GiftSheetState();
}

class _GiftSheetState extends State<GiftSheet> {
  int? _selected;
  bool _sending = false;

  @override
  Widget build(BuildContext context) {
    const options = [50, 100, 500, 1000];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Bless ${widget.recipientName}',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text('Send Credits as a voluntary gift.'),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: options
                  .map(
                    (amount) => ChoiceChip(
                      label: Text('$amount Cr'),
                      selected: _selected == amount,
                      onSelected: (_) => setState(() => _selected = amount),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _selected == null || _sending
                    ? null
                    : () async {
                        setState(() => _sending = true);
                        try {
                          await widget.onGift(_selected!);
                        } finally {
                          if (mounted) setState(() => _sending = false);
                        }
                      },
                child: Text(_sending ? 'Sending…' : 'Send gift'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

class SendCreditsSheet extends StatefulWidget {
  const SendCreditsSheet({
    super.key,
    required this.onSend,
  });

  final Future<void> Function(String recipient, int amountCredits) onSend;

  @override
  State<SendCreditsSheet> createState() => _SendCreditsSheetState();
}

class _SendCreditsSheetState extends State<SendCreditsSheet> {
  final _recipient = TextEditingController();
  final _amount = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _recipient.dispose();
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Send Credits',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _recipient,
              decoration: const InputDecoration(
                labelText: 'Recipient',
                hintText: 'Username, phone or supported identifier',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Amount'),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _sending
                    ? null
                    : () async {
                        final recipient = _recipient.text.trim();
                        final amount = int.tryParse(_amount.text.trim());
                        if (recipient.isEmpty || amount == null || amount < 1) return;
                        setState(() => _sending = true);
                        try {
                          await widget.onSend(recipient, amount);
                        } finally {
                          if (mounted) setState(() => _sending = false);
                        }
                      },
                child: Text(_sending ? 'Sending…' : 'Review & send'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

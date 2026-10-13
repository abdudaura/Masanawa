import 'package:flutter/material.dart';

import '../../commerce/wallet_models.dart';

/// Internal legacy Credits transfer only. Not NGN funding, MSN or crypto.
/// Confirmation is a separate user action; a receipt is server authoritative.
class SendCreditsSheet extends StatefulWidget {
  const SendCreditsSheet({
    super.key,
    required this.onSend,
    required this.expectedAccountId,
    required this.currentAccountId,
    required this.spendableCredits,
  });

  final Future<CreditTransferReceipt?> Function(
    String recipient, int amountCredits,
  ) onSend;
  final String expectedAccountId;
  final String? Function() currentAccountId;
  final int spendableCredits;

  @override
  State<SendCreditsSheet> createState() => _SendCreditsSheetState();
}

class _SendCreditsSheetState extends State<SendCreditsSheet> {
  final _recipient = TextEditingController();
  final _amount = TextEditingController();
  bool _reviewing = false;
  bool _sending = false;
  String? _error;
  String? _reviewRecipient;
  int? _reviewAmount;

  @override
  void dispose() {
    _recipient.dispose();
    _amount.dispose();
    super.dispose();
  }

  bool get _sameAccount =>
      widget.currentAccountId() == widget.expectedAccountId;

  void _review() {
    if (!_sameAccount) {
      setState(() => _error = 'Account changed. Open Wallet again.');
      return;
    }
    final recipient = _recipient.text.trim();
    final amount = int.tryParse(_amount.text.trim());
    if (recipient.isEmpty || amount == null || amount < 1) {
      setState(() => _error = 'Enter a recipient and a valid whole Credit amount.');
      return;
    }
    if (amount > widget.spendableCredits) {
      setState(() => _error = 'Not enough spendable Credits.');
      return;
    }
    setState(() {
      _reviewRecipient = recipient;
      _reviewAmount = amount;
      _reviewing = true;
      _error = null;
    });
  }

  Future<void> _confirm() async {
    if (_sending || !_sameAccount || !_reviewing) {
      if (!_sameAccount) {
        setState(() => _error = 'Account changed. Open Wallet again.');
      }
      return;
    }
    setState(() { _sending = true; _error = null; });
    try {
      final receipt = await widget.onSend(_reviewRecipient!, _reviewAmount!);
      if (!mounted) return;
      if (!_sameAccount) {
        setState(() => _error = 'Account changed. Open Wallet again.');
        return;
      }
      if (receipt == null ||
          receipt.amountCredits != _reviewAmount ||
          receipt.transferId.isEmpty) {
        setState(() => _error = 'Transfer not confirmed. Check history before retrying.');
        return;
      }
      Navigator.of(context).pop(receipt);
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            'Transfer not confirmed. Check history before retrying.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          20, 16, 20, 24 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_reviewing ? 'Confirm Credits transfer' : 'Send Credits',
              style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('Internal Credits only. No MSN, crypto or NGN conversion.',
              style: theme.textTheme.bodySmall),
            const SizedBox(height: 16),
            if (!_reviewing) ...[
              TextField(
                controller: _recipient,
                enabled: !_sending,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Recipient', hintText: 'Email or phone number',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _amount,
                enabled: !_sending,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount in Credits'),
              ),
              const SizedBox(height: 8),
              Text('Available: ${widget.spendableCredits} Cr',
                style: theme.textTheme.bodySmall),
            ] else ...[
              Text('Recipient: $_reviewRecipient'),
              const SizedBox(height: 8),
              Text('$_reviewAmount Cr',
                style: theme.textTheme.headlineSmall),
              const SizedBox(height: 12),
              const Text(
                'Check the recipient and amount. Completed transfers cannot be reversed.',
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _sending ? null : (_reviewing ? _confirm : _review),
              child: Text(_sending
                  ? 'Sending…'
                  : (_reviewing ? 'Confirm and send' : 'Review transfer')),
            ),
            if (_reviewing) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: _sending ? null : () => setState(() {
                  _reviewing = false;
                  _error = null;
                }),
                child: const Text('Edit details'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

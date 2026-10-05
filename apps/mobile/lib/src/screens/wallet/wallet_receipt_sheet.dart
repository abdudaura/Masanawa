import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

class WalletReceiptSheet extends StatelessWidget {
  const WalletReceiptSheet({
    super.key,
    required this.title,
    required this.amountCredits,
    required this.reference,
    required this.detail,
  });

  final String title;
  final int amountCredits;
  final String reference;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: u.brand.withValues(alpha: .10),
              child: Icon(Icons.check, color: u.brand, size: 28),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '$amountCredits Credits',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 24,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: TextStyle(color: u.textMuted, height: 1.4),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: u.surfaceMuted,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Reference: $reference',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted, fontSize: 12),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../theme/masanawa_theme.dart';
import '../../../voice/paid_voice.dart';

class PaidVoiceQuoteSheet extends StatelessWidget {
  const PaidVoiceQuoteSheet({
    super.key,
    required this.quote,
    required this.onContinue,
  });

  final PaidVoiceQuote quote;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final isTrial = quote.isTrial;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: u.structuralBorder,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              isTrial ? 'Try live voice free' : 'Start live voice',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              isTrial
                  ? 'Your free trial lasts ${quote.trialDurationDays} days. You will not be charged for this session while the trial applies.'
                  : 'Estimated cost: ${quote.estimatedPriceCredits} Credits. You will never be charged above the approved session limit without a new confirmation.',
              style: TextStyle(
                color: u.textMuted,
                fontSize: 12,
                height: 1.2,
              ),
            ),
            if (isTrial && quote.trialExpiresAt != null) ...[
              const SizedBox(height: 4),
              Text(
                'Trial ends ${MaterialLocalizations.of(context).formatMediumDate(quote.trialExpiresAt!)}',
                style: TextStyle(color: u.textMuted, fontSize: 12),
              ),
            ],
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onContinue,
                child: Text(isTrial ? 'Start trial call' : 'Continue'),
              ),
            ),
            const SizedBox(height: 3),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Not now'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

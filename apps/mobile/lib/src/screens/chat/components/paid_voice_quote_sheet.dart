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
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
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
            const SizedBox(height: 20),
            Text(
              isTrial ? 'Try live voice free' : 'Start live voice',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              isTrial
                  ? 'Your free trial lasts ${quote.trialDurationDays} days. You will not be charged for this session while the trial applies.'
                  : 'Estimated cost: ${quote.estimatedPriceCredits} Credits. You will never be charged above the approved session limit without a new confirmation.',
              style: TextStyle(
                color: u.textMuted,
                fontSize: 14,
                height: 1.45,
              ),
            ),
            if (isTrial && quote.trialExpiresAt != null) ...[
              const SizedBox(height: 10),
              Text(
                'Trial ends ${MaterialLocalizations.of(context).formatMediumDate(quote.trialExpiresAt!)}',
                style: TextStyle(color: u.textMuted, fontSize: 12),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onContinue,
                child: Text(isTrial ? 'Start free voice' : 'Continue'),
              ),
            ),
            const SizedBox(height: 8),
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

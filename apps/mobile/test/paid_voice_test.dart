import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/voice/paid_voice.dart';

void main() {
  test('parses seven-day free trial voice quote from server policy', () {
    final quote = PaidVoiceQuote.fromJson({
      'quoteId': 'voice-quote-1',
      'characterId': 'character-1',
      'policyRevision': 4,
      'trialPolicyRevision': 2,
      'chargeMode': 'trial',
      'trialDurationDays': 7,
      'trialStartsAt': '2026-10-05T09:00:00Z',
      'trialExpiresAt': '2026-10-12T09:00:00Z',
      'estimatedSeconds': 300,
      'estimatedPriceCredits': 0,
      'spendCapCredits': 0,
      'ownerShareBasisPoints': 3000,
      'quoteExpiresAt': '2026-10-05T09:05:00Z',
    });

    expect(quote.isTrial, isTrue);
    expect(quote.trialDurationDays, 7);
    expect(quote.estimatedPriceCredits, 0);
  });

  test('parses paid quote after trial', () {
    final quote = PaidVoiceQuote.fromJson({
      'quoteId': 'voice-quote-2',
      'characterId': 'character-1',
      'policyRevision': 4,
      'trialPolicyRevision': 2,
      'chargeMode': 'paid',
      'trialDurationDays': 7,
      'trialStartsAt': '2026-09-20T09:00:00Z',
      'trialExpiresAt': '2026-09-27T09:00:00Z',
      'estimatedSeconds': 300,
      'estimatedPriceCredits': 15,
      'spendCapCredits': 20,
      'ownerShareBasisPoints': 3000,
      'quoteExpiresAt': '2026-10-05T09:05:00Z',
    });

    expect(quote.isTrial, isFalse);
    expect(quote.estimatedPriceCredits, 15);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';

void main() {
  test('parses trial owner access quote', () {
    final quote = OwnerAccessQuote.fromJson({
      'requestId': 'owner-request-1',
      'ownerUserId': 'user-owner',
      'originatingCharacterId': 'character-1',
      'modality': 'voice',
      'durationMinutes': 15,
      'priceCredits': 0,
      'platformFeeCredits': 0,
      'ownerEarningCredits': 0,
      'chargeMode': 'trial',
      'trialDurationDays': 7,
      'policyRevision': 1,
      'trialPolicyRevision': 1,
      'quoteExpiresAt': '2026-10-05T11:00:00Z',
    });

    expect(quote.isTrial, isTrue);
    expect(quote.trialDurationDays, 7);
    expect(quote.priceCredits, 0);
  });

  test('parses scheduled owner access request', () {
    final request = OwnerAccessRequest.fromJson({
      'requestId': 'owner-request-1',
      'requesterUserId': 'user-a',
      'ownerUserId': 'user-b',
      'originatingCharacterId': 'character-1',
      'modality': 'text',
      'durationMinutes': 30,
      'priceCredits': 1000,
      'chargeMode': 'paid',
      'state': 'scheduled',
      'requestedAt': '2026-10-05T10:00:00Z',
      'acceptBy': '2026-10-05T11:00:00Z',
      'scheduledFor': '2026-10-06T17:00:00Z',
    });

    expect(request.state, OwnerAccessState.scheduled);
    expect(request.scheduledFor, isNotNull);
  });
}

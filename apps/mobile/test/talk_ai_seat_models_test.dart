import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_ai_seat.dart';

void main() {
  test('candidate preserves Expert/Twin identity and display fee', () {
    final candidate = TalkAiSeatCandidate.fromJson({
      'personaId': 'persona-1',
      'displayName': 'Policy Expert',
      'kind': 'expert',
      'seatFeeLabel': '₦500',
      'subtitle': 'Policy · Government',
      'topics': ['Policy', 'Africa'],
      'isAvailable': true,
    });

    expect(candidate.personaId, 'persona-1');
    expect(candidate.kind, TalkAiPersonaKind.expert);
    expect(candidate.seatFeeLabel, '₦500');
    expect(candidate.topics, ['Policy', 'Africa']);
  });

  test('sponsor quote always carries explicit Host approval flag', () {
    final quote = TalkAiSeatQuote.fromJson({
      'quoteId': 'quote-1',
      'personaId': 'twin-1',
      'displayName': 'Amina Twin',
      'kind': 'twin',
      'mode': 'sponsor',
      'totalLabel': '₦450',
      'expiresAt': '2030-01-01T12:30:00Z',
      'requiresHostApproval': true,
    });

    expect(quote.kind, TalkAiPersonaKind.twin);
    expect(quote.mode, TalkAiSeatMode.sponsor);
    expect(quote.requiresHostApproval, isTrue);
    expect(quote.totalLabel, '₦450');
  });

  test('request status maps pending Host admission explicitly', () {
    final request = TalkAiSeatRequest.fromJson({
      'requestId': 'request-1',
      'status': 'pending_host',
      'message': 'Waiting for the Host.',
    });

    expect(request.status, TalkAiSeatRequestStatus.pendingHost);
  });
}

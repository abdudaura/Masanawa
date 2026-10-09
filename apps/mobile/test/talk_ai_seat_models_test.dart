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

  test('Twin ownership must be verified by the server, not inferred', () {
    final raw = <String, dynamic>{
      'personaId': 'twin-1',
      'displayName': 'My Twin',
      'kind': 'twin',
      'seatFeeLabel': '12 Credits',
      'isAvailable': true,
    };
    expect(TalkAiSeatCandidate.fromJson(raw).isOwnedByViewer, isFalse);
    expect(TalkAiSeatCandidate.fromJson({
      ...raw, 'isOwnedByViewer': 'true',
    }).isOwnedByViewer, isFalse);
    expect(TalkAiSeatCandidate.fromJson({
      ...raw, 'isOwnedByViewer': true,
    }).isOwnedByViewer, isTrue);
    expect(TalkAiSeatCandidate.fromJson({
      ...raw, 'kind': 'expert', 'isOwnedByViewer': true,
    }).isOwnedByViewer, isFalse);
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
  test('candidate missing availability does not advertise payable Seat', () {
    final raw = <String, dynamic>{
      'personaId': 'expert-1',
      'displayName': 'Verified Expert',
      'kind': 'expert',
      'seatFeeLabel': '10 Credits',
    };
    expect(TalkAiSeatCandidate.fromJson(raw).isAvailable, isFalse);
    expect(
      TalkAiSeatCandidate.fromJson({...raw, 'isAvailable': 'true'})
          .isAvailable,
      isFalse,
    );
    expect(
      TalkAiSeatCandidate.fromJson({...raw, 'isAvailable': true})
          .isAvailable,
      isTrue,
    );
  });

  test('unknown persona kind or blank identity cannot imply an Expert', () {
    final raw = <String, dynamic>{
      'personaId': 'expert-1',
      'displayName': 'Expert',
      'kind': 'expert',
      'seatFeeLabel': '10 Credits',
      'isAvailable': true,
    };
    expect(
      () => TalkAiSeatCandidate.fromJson({...raw, 'kind': 'other'}),
      throwsFormatException,
    );
    expect(
      () => TalkAiSeatCandidate.fromJson({...raw, 'personaId': '  '}),
      throwsFormatException,
    );
  });

  test('quote enforces exact approval mode and valid time', () {
    final raw = <String, dynamic>{
      'quoteId': 'q-1',
      'personaId': 'expert-1',
      'displayName': 'Expert',
      'kind': 'expert',
      'mode': 'host_add',
      'totalLabel': '10 Credits',
      'expiresAt': '2030-01-01T12:30:00Z',
      'requiresHostApproval': false,
    };
    final quote = TalkAiSeatQuote.fromJson(raw);
    expect(quote.isExpiredAt(DateTime.utc(2029)), isFalse);
    expect(quote.isExpiredAt(DateTime.utc(2030, 1, 1, 12, 30)), isTrue);
    expect(
      () => TalkAiSeatQuote.fromJson({...raw, 'expiresAt': 'invalid'}),
      throwsFormatException,
    );
    expect(
      () => TalkAiSeatQuote.fromJson({...raw, 'requiresHostApproval': true}),
      throwsFormatException,
    );
    expect(
      () => TalkAiSeatQuote.fromJson({...raw, 'mode': 'other'}),
      throwsFormatException,
    );
  });

  test('confirmation without a server request ID is never treated as complete', () {
    expect(
      () => TalkAiSeatRequest.fromJson({
        'requestId': '  ',
        'status': 'admitted',
        'message': 'Joined the Talk.',
      }),
      throwsFormatException,
    );
  });

}


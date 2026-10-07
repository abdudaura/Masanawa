import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_activity.dart';

void main() {
  test('parses privacy-safe twin activity projection', () {
    final view = TwinActivityView.fromJson({
      'hasTwin': true,
      'characterId': 'character-1',
      'summary': {
        'visitors': 3,
        'conversations': 2,
        'earningsCredits': 450,
        'pendingOwnerRequests': 1,
      },
      'items': [
        {
          'eventId': 'event-1',
          'kind': 'gift',
          'status': 'completed',
          'occurredAt': '2026-10-05T08:00:00Z',
          'amountCredits': 200,
          'title': 'Gift received',
          'detail': 'Someone blessed you through your twin.',
        },
      ],
    });

    expect(view.hasTwin, isTrue);
    expect(view.summary.visitors, 3);
    expect(view.summary.earningsCredits, 450);
    expect(view.items.single.kind, TwinActivityKind.gift);
    expect(view.items.single.amountCredits, 200);
  });

  test('parses owner request reference for Activity actions', () {
    final view = TwinActivityView.fromJson({
      'hasTwin': true,
      'characterId': 'character-1',
      'summary': {
        'visitors': 0,
        'conversations': 0,
        'earningsCredits': 0,
        'pendingOwnerRequests': 1,
      },
      'items': [
        {
          'eventId': 'event-owner-1',
          'referenceId': 'request-owner-1',
          'kind': 'owner-request',
          'status': 'pending',
          'occurredAt': '2026-10-05T08:00:00Z',
          'amountCredits': null,
          'title': 'Talk-to-owner request',
          'detail': 'Someone requested a paid conversation with you.',
        },
      ],
    });

    expect(view.items.single.kind, TwinActivityKind.ownerRequest);
    expect(view.items.single.referenceId, 'request-owner-1');
  });

  test('rejects unknown activity kinds instead of silently guessing', () {
    expect(
      () => TwinActivityView.fromJson({
        'hasTwin': true,
        'summary': {
          'visitors': 0,
          'conversations': 0,
          'earningsCredits': 0,
          'pendingOwnerRequests': 0,
        },
        'items': [
          {
            'eventId': 'event-1',
            'kind': 'raw-transcript',
            'status': 'observed',
            'occurredAt': '2026-10-05T08:00:00Z',
            'title': 'bad',
            'detail': 'bad',
          },
        ],
      }),
      throwsFormatException,
    );
  });
}

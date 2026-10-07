import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_participation.dart';

void main() {
  test('participation projection preserves raised hand and reaction', () {
    final state = TalkParticipationState.fromJson({
      'handStatus': 'raised',
      'reaction': '👏',
    });

    expect(state.handStatus, TalkHandStatus.raised);
    expect(state.reaction, '👏');
  });

  test('accepted Speaker state is distinct from a raised request', () {
    final state = TalkParticipationState.fromJson({
      'handStatus': 'accepted',
    });

    expect(state.handStatus, TalkHandStatus.accepted);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talks/talk_host_controls.dart';
import 'package:masanawa/src/talks/talk_models.dart';

void main() {
  test('human Speaker request stays distinct from sponsored AI', () {
    final human = TalkHostRequest.fromJson({
      'requestId': 'human-1',
      'kind': 'human_speaker',
      'displayName': 'Amina',
    });
    final twin = TalkHostRequest.fromJson({
      'requestId': 'twin-1',
      'kind': 'sponsored_twin',
      'displayName': 'Amina Twin',
      'amountLabel': '₦450',
    });

    expect(human.kind, TalkHostRequestKind.humanSpeaker);
    expect(human.amountLabel, isNull);
    expect(twin.kind, TalkHostRequestKind.sponsoredTwin);
    expect(twin.amountLabel, '₦450');
  });

  test('Host participant identity cannot be confused with ordinary Speaker', () {
    final view = TalkHostControlsView.fromJson({
      'participants': [
        {
          'participantId': 'host',
          'displayName': 'Abdullahi',
          'kind': 'human',
          'isHost': true,
          'isMuted': false,
        },
        {
          'participantId': 'expert',
          'displayName': 'Economist',
          'kind': 'expert',
          'isHost': false,
          'isMuted': true,
        },
      ],
    });

    expect(view.participants.first.isHost, isTrue);
    expect(view.participants.first.kind, TalkParticipantKind.human);
    expect(view.participants.last.isHost, isFalse);
    expect(view.participants.last.kind, TalkParticipantKind.expert);
    expect(view.participants.last.isMuted, isTrue);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/group_rooms/group_room_models.dart';

void main() {
  Map<String, dynamic> validProjection() => {
        'roomId': 'group-1',
        'title': 'Study group',
        'description': 'Prepare together with Gwana.',
        'privacy': {
          'memoryScope': 'group-room',
          'privateRelationshipMemoryEligible': false,
          'membershipRequired': true,
        },
        'participants': [
          {
            'participantId': 'p-user',
            'displayName': 'Amina',
            'kind': 'human',
            'role': 'owner',
            'bindingRef': 'subject:user:opaque',
          },
          {
            'participantId': 'p-gwana',
            'displayName': 'Gwana',
            'kind': 'character',
            'role': 'member',
            'bindingRef': 'presentation:character:opaque',
          },
          {
            'participantId': 'p-twin',
            'displayName': 'Bello Twin',
            'kind': 'twin',
            'role': 'member',
            'bindingRef': 'presentation:twin:opaque',
          },
        ],
        'messages': [
          {
            'messageId': 'm-1',
            'authorParticipantId': 'p-gwana',
            'text': 'Which topic should we revise first?',
            'sentAt': '2026-10-06T09:00:00Z',
          },
        ],
      };

  test('parses explicit mixed human Character and Twin membership', () {
    final projection = GroupRoomProjection.fromJson(validProjection());

    expect(projection.roomId, 'group-1');
    expect(projection.participants, hasLength(3));
    expect(
      projection.participants.map((item) => item.kind),
      containsAll([
        GroupParticipantKind.human,
        GroupParticipantKind.character,
        GroupParticipantKind.twin,
      ]),
    );
    expect(
      projection.participantFor('p-gwana').displayName,
      'Gwana',
    );
    expect(projection.messages.single.authorParticipantId, 'p-gwana');
  });

  test('rejects message attribution to a non-member', () {
    final json = validProjection();
    json['messages'] = [
      {
        'messageId': 'm-2',
        'authorParticipantId': 'not-a-member',
        'text': 'Injected message',
        'sentAt': '2026-10-06T09:00:00Z',
      },
    ];

    expect(
      () => GroupRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('rejects private Relationship memory eligibility', () {
    final json = validProjection();
    json['privacy'] = {
      'memoryScope': 'group-room',
      'privateRelationshipMemoryEligible': true,
      'membershipRequired': true,
    };

    expect(
      () => GroupRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('requires membership and the group-room memory scope', () {
    final json = validProjection();
    json['privacy'] = {
      'memoryScope': 'relationship',
      'privateRelationshipMemoryEligible': false,
      'membershipRequired': true,
    };

    expect(
      () => GroupRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('rejects duplicate participant identities', () {
    final json = validProjection();
    final participants = List<Map<String, dynamic>>.from(
      json['participants'] as List,
    );
    participants.add(Map<String, dynamic>.from(participants.first));
    json['participants'] = participants;

    expect(
      () => GroupRoomProjection.fromJson(json),
      throwsFormatException,
    );
  });

  test('rejects insecure avatar URLs', () {
    expect(
      () => GroupParticipant.fromJson({
        'participantId': 'p-1',
        'displayName': 'Amina',
        'kind': 'human',
        'role': 'member',
        'bindingRef': 'subject:user:opaque',
        'avatarUrl': 'http://example.test/avatar.png',
      }),
      throwsFormatException,
    );
  });
}

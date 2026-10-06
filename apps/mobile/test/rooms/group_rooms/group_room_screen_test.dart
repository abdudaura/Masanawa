import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/group_rooms/group_room_models.dart';
import 'package:masanawa/src/rooms/group_rooms/group_room_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  GroupRoomProjection projection() => GroupRoomProjection(
        roomId: 'group-1',
        title: 'Study group',
        description: 'Prepare together with Gwana.',
        privacy: const GroupRoomPrivacy(
          memoryScope: 'group-room',
          privateRelationshipMemoryEligible: false,
          membershipRequired: true,
        ),
        participants: const [
          GroupParticipant(
            participantId: 'p-user',
            displayName: 'Amina',
            kind: GroupParticipantKind.human,
            role: GroupParticipantRole.owner,
            bindingRef: 'subject:user:opaque',
          ),
          GroupParticipant(
            participantId: 'p-gwana',
            displayName: 'Gwana',
            kind: GroupParticipantKind.character,
            role: GroupParticipantRole.member,
            bindingRef: 'presentation:character:opaque',
          ),
        ],
        messages: [
          GroupMessageProjection(
            messageId: 'm-1',
            authorParticipantId: 'p-gwana',
            text: 'Which topic should we revise first?',
            sentAt: DateTime(2026, 10, 6, 9),
          ),
        ],
      );

  testWidgets('renders group identity membership attribution and privacy', (
    tester,
  ) async {
    var opens = 0;
    GroupParticipant? selected;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: GroupRoomScreen(
          projection: projection(),
          loading: false,
          onOpenConversation: () => opens++,
          onOpenParticipant: (value) => selected = value,
        ),
      ),
    );

    expect(find.text('Study group'), findsOneWidget);
    expect(find.text('Members only · group-scoped memory'), findsOneWidget);
    expect(find.text('Amina · owner'), findsOneWidget);
    expect(find.text('Gwana'), findsWidgets);
    expect(find.text('Which topic should we revise first?'), findsOneWidget);

    await tester.tap(find.text('Amina · owner'));
    await tester.pump();
    expect(selected?.participantId, 'p-user');

    await tester.tap(find.text('Open conversation'));
    await tester.pump();
    expect(opens, 1);
  });

  testWidgets('renders transport-independent error and retry state', (
    tester,
  ) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: GroupRoomScreen(
          projection: null,
          loading: false,
          errorMessage: 'Group Room is unavailable.',
          onRetry: () => retries++,
        ),
      ),
    );

    expect(find.text('Group Room is unavailable.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(retries, 1);
  });
}

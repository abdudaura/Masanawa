import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/room_membership_client.dart';
import 'package:masanawa/src/features/rooms/room_membership_screen.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class FakeMembership implements RoomMembershipClient {
  bool joined = false, banned = false;
  int issues = 0, rejections = 0, revocations = 0;
  bool forbidManage = false;
  @override
  Future<void> accept(String id, String token) async { joined = true; }
  @override
  Future<List<RoomMember>> members(String id) async => [
    RoomMember('fan-other', banned ? 'banned' : 'active', 'member'),
  ];
  @override
  Future<List<RoomInvite>> invites(String id) async {
    if (forbidManage) {
      throw DioException(requestOptions: RequestOptions(path: '/v1/rooms'),
          response: Response(requestOptions: RequestOptions(path: '/v1/rooms'),
              statusCode: 403));
    }
    return [RoomInvite('invite_1', '2027-01-01T00:00:00.000Z', false, false)];
  }
  @override
  Future<String> issue(String id) async { ++issues; return 'a' * 43; }
  @override
  Future<void> revoke(String id, String invite) async { ++revocations; }
  @override
  Future<void> moderate(String id, String user, String action) async {
    banned = action == 'ban';
  }
}

class FakeRooms implements RoomsClient {
  bool joined = false;
  @override Future<List<RoomInfo>> list({required bool joined,
      String query = '', String language = ''}) async => [
        RoomInfo('room_math', 'Mathematics', 'teacher', 'en', 2, false, this.joined),
      ];
  @override Future<RoomInfo> room(String id) async =>
      RoomInfo('room_math', 'Mathematics', 'teacher', 'en', 2, false, joined);
  @override Future<void> join(String id) async { joined = true; }
  @override Future<void> leave(String id) async { joined = false; }
  @override Future<RoomQuestion> ask(String id, String text, String key) async =>
      const RoomQuestion('room-question_1', 'Question', 'queued', null);
  @override Future<List<RoomQuestion>> questions(String id) async => [];
  @override Future<List<RoomLesson>> lessons(String id) async => [];
}

void main() {
  testWidgets('fan enters secret inside Room, joins, and refreshes detail', (tester) async {
    final memberships = FakeMembership();
    final rooms = FakeRooms();
    await tester.pumpWidget(MaterialApp(home: RoomHomeScreen(
      client: rooms, id: 'room_math', membershipClient: memberships)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('room-invitations')));
    await tester.pumpAndSettle();
    expect(find.text('Join with code'), findsOneWidget);
    expect(find.text('Manage invitations and members'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('room-invite-code')), 'a' * 43);
    await tester.tap(find.byKey(const Key('room-redeem-invite')));
    await tester.pumpAndSettle();
    expect(memberships.joined, isTrue);
    expect(find.text('Invitation accepted. You are a Room member.'), findsOneWidget);
  });

  testWidgets('moderator can issue, revoke and confirm a ban', (tester) async {
    final memberships = FakeMembership();
    await tester.pumpWidget(MaterialApp(home: RoomMembershipScreen(
      client: memberships, roomId: 'room_math')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('room-open-management')));
    await tester.pumpAndSettle();
    expect(find.text('fan-other'), findsOneWidget);
    await tester.tap(find.byKey(const Key('room-issue-invite')));
    await tester.pumpAndSettle();
    expect(memberships.issues, 1);
    expect(find.text('New invitation (shown once)'), findsOneWidget);
    await tester.scrollUntilVisible(find.byTooltip('Ban member'), 180,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byTooltip('Ban member'));
    await tester.pumpAndSettle();
    expect(find.text('Confirm Room action'), findsOneWidget);
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(memberships.banned, isTrue);
    await tester.scrollUntilVisible(find.byTooltip('Revoke invitation'), -180,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byTooltip('Revoke invitation'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm'));
    await tester.pumpAndSettle();
    expect(memberships.revocations, 1);
  });

  testWidgets('denied moderator read is not shown as an empty member list', (tester) async {
    final memberships = FakeMembership()..forbidManage = true;
    await tester.pumpWidget(MaterialApp(home: RoomMembershipScreen(
      client: memberships, roomId: 'room_math')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('room-open-management')));
    await tester.pumpAndSettle();
    expect(find.text('Room membership or moderator permission required.'),
        findsOneWidget);
    expect(find.text('No members yet.'), findsNothing);
    expect(find.byKey(const Key('room-issue-invite')), findsNothing);
  });

  testWidgets('invalid invitation never invokes membership acceptance', (tester) async {
    final memberships = FakeMembership();
    await tester.pumpWidget(MaterialApp(home: RoomMembershipScreen(
      client: memberships, roomId: 'room_math')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('room-invite-code')), 'bad');
    await tester.tap(find.byKey(const Key('room-redeem-invite')));
    await tester.pump();
    expect(memberships.joined, isFalse);
    expect(find.text('Enter a valid 43-character invitation code.'), findsOneWidget);
  });
}

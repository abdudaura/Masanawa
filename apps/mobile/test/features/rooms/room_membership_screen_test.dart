import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/room_membership_client.dart';
import 'package:masanawa/src/features/rooms/room_membership_screen.dart';

class FakeMembership implements RoomMembershipClient {
 Completer<List<RoomMember>>? pending;
 Completer<void>? acceptPending;
 Object? acceptError;
 int accepts=0,moderations=0;
 @override Future<List<RoomMember>> members(String id) async =>
  pending==null ? [const RoomMember('other','active','member')] : await pending!.future;
 @override Future<List<RoomInvite>> invites(String id) async => [];
 @override Future<RoomInvite> issue(String id) async =>RoomInvite('invite',DateTime(2099),false,false,token:'a'*43);
 @override Future<void> revoke(String id,String invite) async {}
 @override Future<void> moderate(String id,String target,String action) async {moderations++;}
 @override Future<void> accept(String id,String token) async {
  accepts++;if(acceptError!=null)throw acceptError!;await acceptPending?.future;
 }
}
Widget screen(FakeMembership client,{String account='a',bool manage=false})=>MaterialApp(home:
 RoomMembershipScreen(client:client,accountId:account,roomId:'room_example',title:'Room',manage:manage));
void main(){
 testWidgets('join denial keeps retry available and never claims membership',(tester) async {
  final client=FakeMembership()..acceptError=const RoomMembershipFailure('room_banned');
  await tester.pumpWidget(screen(client));await tester.enterText(find.byType(TextField),'a'*43);
  await tester.tap(find.text('Join room'));await tester.pumpAndSettle();
  expect(find.text('Access to this room has been removed.'),findsOneWidget);
  expect(find.text('You joined the room.'),findsNothing);
  client.acceptError=null;await tester.tap(find.text('Join room'));await tester.pumpAndSettle();
  expect(find.text('You joined the room.'),findsOneWidget);expect(client.accepts,2);
 });
 testWidgets('busy join cannot be submitted twice',(tester) async {
  final client=FakeMembership()..acceptPending=Completer<void>();
  await tester.pumpWidget(screen(client));await tester.tap(find.text('Join room'));await tester.pump();
  await tester.tap(find.text('Join room'));await tester.pump();expect(client.accepts,1);
  client.acceptPending!.complete();await tester.pumpAndSettle();
 });
 testWidgets('account switch clears code and ignores stale roster',(tester) async {
  final old=FakeMembership()..pending=Completer<List<RoomMember>>();
  await tester.pumpWidget(screen(old,manage:true));await tester.pump();
  await tester.pumpWidget(screen(FakeMembership(),account:'b',manage:true));await tester.pumpAndSettle();
  old.pending!.complete([const RoomMember('private-old-member','active','member')]);await tester.pumpAndSettle();
  expect(find.text('private-old-member'),findsNothing);expect(find.text('other'),findsOneWidget);
 });
 testWidgets('removing access requires confirmation',(tester) async {
  final client=FakeMembership();await tester.pumpWidget(screen(client,manage:true));await tester.pumpAndSettle();
  await tester.tap(find.text('Remove access'));await tester.pumpAndSettle();
  await tester.tap(find.text('Cancel'));await tester.pumpAndSettle();expect(client.moderations,0);
  await tester.tap(find.text('Remove access'));await tester.pumpAndSettle();
  await tester.tap(find.text('Remove access').last);await tester.pumpAndSettle();expect(client.moderations,1);
 });
 testWidgets('issued code disappears on account change',(tester) async {
  final client=FakeMembership();await tester.pumpWidget(screen(client,manage:true));await tester.pumpAndSettle();
  await tester.tap(find.text('Create single-use invitation'));await tester.pumpAndSettle();
  expect(find.text('a'*43),findsOneWidget);
  await tester.pumpWidget(screen(FakeMembership(),account:'b',manage:true));await tester.pumpAndSettle();
  expect(find.text('a'*43),findsNothing);
 });
}

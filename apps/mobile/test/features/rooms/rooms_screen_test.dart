import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class FakeRooms implements RoomsClient {
 @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''})async=>
  [const RoomInfo('room_test','Mathematics','character_teacher','en',1,false,false)];
 @override Future<RoomInfo> room(String id)async=>
  const RoomInfo('room_test','Mathematics','character_teacher','en',1,false,false);
 @override Future<void> join(String id)async{}
 @override Future<void> leave(String id)async{}
 @override Future<RoomQuestion> ask(String id,String text,String key)async=>
  const RoomQuestion('room-question_1','Can I learn algebra?','queued',null);
 @override Future<List<RoomQuestion>> questions(String id)async=>[];
 @override Future<List<RoomLesson>> lessons(String id)async=>[];
}
void main(){
 testWidgets('fan sees professional Rooms but cannot create one',(tester)async{
  await tester.pumpWidget(MaterialApp(home:RoomsScreen(client:FakeRooms())));
  await tester.pumpAndSettle();
  expect(find.text('Mathematics'),findsOneWidget);
  expect(find.text('Create Room'),findsNothing);
  await tester.tap(find.text('Mathematics'));await tester.pumpAndSettle();
  expect(find.text('Join Room'),findsOneWidget);
  expect(find.text('Lessons'),findsNothing);
  expect(find.text('Data Bundles'),findsOneWidget);
 });
}

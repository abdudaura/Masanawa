import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class AnsweringRooms implements RoomsClient {
 bool hasQuestion=false,ready=false,joined=true;
 int readCount=0;
 @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''}) async => [];
 @override Future<RoomInfo> room(String id) async =>
   RoomInfo(id,'Mathematics','character_teacher','en',1,false,joined);
 @override Future<void> join(String id) async {joined=true;}
 @override Future<void> leave(String id) async {joined=false;}
 @override Future<RoomQuestion> ask(String id,String text,String key) async {
   hasQuestion=true;
   return RoomQuestion('room-question_1',text,'queued',null);
 }
 @override Future<List<RoomQuestion>> questions(String id) async {
   readCount++;
   return hasQuestion
     ? [RoomQuestion('room-question_1','What is 2+2?',ready?'answered':'queued',ready?'4':null)]
     : [];
 }
 @override Future<List<RoomLesson>> lessons(String id) async => [];
}
void main(){
 testWidgets('asking a question refreshes the AI answer without manual reload',(tester) async {
   final api=AnsweringRooms();
   await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:api,id:'room_math')));
   await tester.pumpAndSettle();
   await tester.enterText(find.byType(TextField),'What is 2+2?');
   await tester.tap(find.byTooltip('Send message'));
   await tester.pump();
   await tester.pump(const Duration(milliseconds:250));
   expect(find.text('Teacher is preparing a reply'),findsOneWidget);
   final before=api.readCount;
   api.ready=true;
   await tester.pump(const Duration(seconds:3));
   await tester.pump(const Duration(milliseconds:250));
   expect(api.readCount,greaterThan(before));
   expect(find.text('4'),findsOneWidget);
   final completedAt=api.readCount;
   await tester.pump(const Duration(seconds:10));
   expect(api.readCount,completedAt,reason:'completed answers do not poll forever');
 });
 testWidgets('leaving the Room stops pending answer requests',(tester) async {
   final api=AnsweringRooms()..hasQuestion=true;
   await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:api,id:'room_math')));
   await tester.pump();
   await tester.pump(const Duration(milliseconds:100));
   await tester.tap(find.byTooltip('Room info'));
   await tester.pumpAndSettle();
   expect(find.text('Leave Room'),findsOneWidget);
   await tester.tap(find.text('Leave Room'));
   await tester.pump();
   await tester.pump(const Duration(milliseconds:100));
   final before=api.readCount;
   await tester.pump(const Duration(seconds:5));
   expect(api.readCount,before);
   expect(find.text('Join Room'),findsOneWidget);
 });
}

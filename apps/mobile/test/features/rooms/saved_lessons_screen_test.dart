import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/saved_lessons_client.dart';
import 'package:masanawa/src/features/rooms/saved_lessons_screen.dart';

class FakeSaves implements SavedLessonsClient {
 bool current=true,offline=false,forbidden=false;
 int reads=0,removals=0;
 List<SavedRoomLesson> items=[
  SavedRoomLesson(id:'room-lesson_12345678',body:'Introduction to algebra',kind:'lesson',bookmarkedAt:DateTime.utc(2026)),
 ];
 @override bool get isCurrentAccount=>current;
 @override Future<List<SavedRoomLesson>> list(String roomId) async {
  reads++;
  if(offline||forbidden)throw StateError('unavailable');
  return List.of(items);
 }
 @override Future<void> save(String roomId,String lessonId)async{}
 @override Future<void> remove(String roomId,String lessonId)async{
  removals++;items.removeWhere((v)=>v.id==lessonId);
 }
}
void main(){
 testWidgets('C38 renders only authenticated saved lessons and removes with server readback',(tester)async{
  final api=FakeSaves();
  await tester.pumpWidget(MaterialApp(home:SavedRoomLessonsScreen(
    client:api,roomId:'room_math',accountKey:'fanA')));
  await tester.pumpAndSettle();
  expect(find.text('Introduction to algebra'),findsOneWidget);
  await tester.tap(find.byTooltip('Remove saved lesson'));
  await tester.pumpAndSettle();
  expect(api.removals,1);
  expect(find.text('No saved lessons available.'),findsOneWidget);
 });
 testWidgets('C38 denies account switch and erases prior fan projection',(tester)async{
  final api=FakeSaves();
  await tester.pumpWidget(MaterialApp(home:SavedRoomLessonsScreen(
    client:api,roomId:'room_math',accountKey:'fanA')));
  await tester.pumpAndSettle();
  api.current=false;
  await tester.pumpWidget(MaterialApp(home:SavedRoomLessonsScreen(
    client:api,roomId:'room_math',accountKey:'fanB')));
  await tester.pumpAndSettle();
  expect(find.text('Introduction to algebra'),findsNothing);
  expect(find.textContaining('Sign in again'),findsOneWidget);
  expect(api.removals,0);
 });
 testWidgets('C38 offline failure gives retry without cached protected lesson',(tester)async{
  final api=FakeSaves()..offline=true;
  await tester.pumpWidget(MaterialApp(home:SavedRoomLessonsScreen(
    client:api,roomId:'room_math',accountKey:'fanA')));
  await tester.pumpAndSettle();
  expect(find.text('Introduction to algebra'),findsNothing);
  api.offline=false;
  await tester.tap(find.text('Retry'));
  await tester.pumpAndSettle();
  expect(find.text('Introduction to algebra'),findsOneWidget);
 });
}

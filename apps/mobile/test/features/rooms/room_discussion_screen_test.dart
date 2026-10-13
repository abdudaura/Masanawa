import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/room_discussion_screen.dart';
import 'package:masanawa/src/features/rooms/room_discussion_api.dart';
class FakeDiscussion implements RoomDiscussionApi{
 int sent=0;String? lastKey;bool deny=false;
 @override Future<List<RoomDiscussionTarget>> targets(String roomId)async{
  if(deny)throw Exception('offline');
  return [const RoomDiscussionTarget(kind:'lesson',id:'room-lesson_12345678',label:'Introduction')];
 }
 @override Future<RoomDiscussionPage> list(String roomId,RoomDiscussionTarget target,{String? cursor})async=>
   const RoomDiscussionPage([],null);
 @override Future<RoomDiscussionReply> send(String roomId,RoomDiscussionTarget target,String body,String key,{String? parentReplyId})async{
  sent++;lastKey=key;return const RoomDiscussionReply(id:'room-reply_12345678',
   body:'My question',state:'held',createdAt:'2026-10-11T00:00:00Z',byMe:true,parentReplyId:null);
 }
}
void main(){
 testWidgets('C39 offers real empty targets and submit controls',(tester)async{
  final api=FakeDiscussion();
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:RoomDiscussionScreen(
   roomId:'room_test',accountScope:'fan_1',api:api))));
  await tester.pumpAndSettle();
  expect(find.text('Be the first to discuss this topic.'),findsOneWidget);
  await tester.enterText(find.byType(TextField).last,'A thoughtful reply');
  await tester.tap(find.byTooltip('Send reply for review'));
  await tester.pumpAndSettle();
  expect(api.sent,1);expect(api.lastKey,startsWith('rd_'));
 });
 testWidgets('C39 fails closed offline, with retry',(tester)async{
  final api=FakeDiscussion()..deny=true;
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:RoomDiscussionScreen(
   roomId:'room_test',accountScope:'fan_1',api:api))));
  await tester.pumpAndSettle();
  expect(find.text('Discussion could not load. Try again.'),findsOneWidget);
  expect(find.text('Retry'),findsOneWidget);
 });
}

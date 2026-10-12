import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/rooms/room_discussion_client.dart';
import 'package:masanawa_admin/src/features/rooms/room_discussion_moderation_screen.dart';
class FakeModeration implements RoomDiscussionModerationApi {
 int approved=0;bool denied=false;
 @override Future<List<ModeratedRoomReply>> queue()async{
  if(denied)throw Exception('forbidden');
  return [const ModeratedRoomReply(id:'room-reply_12345678',roomId:'room_a',body:'Learner reply',
   parentKind:'question',parentId:'room-question_12345678',state:'held')];
 }
 @override Future<void> review(String replyId,String decision)async{
  if(decision=='approve')approved++;
 }
}
void main(){
 testWidgets('A10 staff can confirm approval of held reply',(tester)async{
  final api=FakeModeration();
  await tester.pumpWidget(MaterialApp(home:RoomDiscussionModerationScreen(api:api,accountScope:'staff_a')));
  await tester.pumpAndSettle();
  expect(find.text('Learner reply'),findsOneWidget);
  await tester.tap(find.text('Approve'));await tester.pumpAndSettle();
  expect(find.text('Approve public reply?'),findsOneWidget);
  await tester.tap(find.text('Confirm'));await tester.pumpAndSettle();
  expect(api.approved,1);
 });
 testWidgets('A10 exposes retry on queue failure',(tester)async{
  await tester.pumpWidget(MaterialApp(home:RoomDiscussionModerationScreen(
   api:FakeModeration()..denied=true,accountScope:'staff_a')));
  await tester.pumpAndSettle();
  expect(find.text('Could not load moderation queue.'),findsOneWidget);
  expect(find.text('Retry'),findsOneWidget);
 });
}

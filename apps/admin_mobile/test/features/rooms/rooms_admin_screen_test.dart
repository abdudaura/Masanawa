import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/rooms/rooms_admin_client.dart';
import 'package:masanawa_admin/src/features/rooms/rooms_admin_screen.dart';

class FakeAdmin implements RoomsAdminClient {
 @override Future<List<ReviewQuestion>> queue()async=>[ReviewQuestion('room-question_1','room_1','Explain algebra','needs_staff',null)];
 @override Future<List<Map<String,dynamic>>> rooms()async=>[];
 @override Future<void> create({required String slug,required String title,required String teacherId})async{}
 @override Future<void> publish(String id)async{}
 @override Future<void> review(String id,String answer,{required bool approve})async{}
}
void main(){
 testWidgets('staff sees question review even with a lone Room member',(tester)async{
  await tester.pumpWidget(MaterialApp(home:RoomsAdminScreen(client:FakeAdmin())));
  await tester.pumpAndSettle();
  expect(find.text('Explain algebra'),findsOneWidget);
  expect(find.text('Approve'),findsOneWidget);
 });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class _Rooms implements RoomsClient {
  @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''})async=>const [];
  @override Future<RoomInfo> room(String id)async=>const RoomInfo('room_math','Mathematics','prof_math','en',2,false,true);
  @override Future<void> join(String id)async{}
  @override Future<void> leave(String id)async{}
  @override Future<RoomQuestion> ask(String id,String text,String key)async=>
    RoomQuestion('q_new',text,'queued',null,authorUserId:'fan-a');
  @override Future<List<RoomQuestion>> questions(String id)async=>const [
    RoomQuestion('q_b','Someone else is learning algebra','answered','Try a quadratic example',authorUserId:'fan-b'),
    RoomQuestion('q_a','My own question','answered','Welcome to the class',authorUserId:'fan-a'),
  ];
  @override Future<List<RoomLesson>> lessons(String id)async=>const [];
}

void main(){
  test('room author projection handles absent and verified members',(){
    final other=RoomQuestion.fromJson({'questionId':'q','body':'Hi','state':'queued','answer':null,'authorUserId':'fan-b'});
    expect(other.authorUserId,'fan-b');
    final old=RoomQuestion.fromJson({'questionId':'q','body':'Hi','state':'queued','answer':null});
    expect(old.authorUserId,isNull);
  });
  testWidgets('other fan message is marked as another member, never own', (tester)async{
    await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(
      client:_Rooms(),id:'room_math',viewerId:'fan-a')));
    await tester.pumpAndSettle();
    expect(find.text('My own question'),findsOneWidget);
    expect(find.text('Someone else is learning algebra'),findsOneWidget);
    expect(find.text('Room member'),findsOneWidget);
    expect(find.text('Try a quadratic example'),findsOneWidget);
    expect(find.text('Lessons'),findsNothing);
    expect(tester.takeException(),isNull);
  });
}

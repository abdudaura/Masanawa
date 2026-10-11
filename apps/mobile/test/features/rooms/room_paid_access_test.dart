import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';
import 'package:masanawa/src/features/rooms/room_subscriptions_client.dart';
import 'package:masanawa/src/features/rooms/room_billing_store.dart';

class FakeRooms implements RoomsClient {
 FakeRooms({this.paid=true,this.previousMember=false});
 final bool paid,previousMember;
 int joins=0;
 @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''}) async=>
  [RoomInfo('room_math','Mathematics','masana_math','en',5,paid,previousMember||joins>0)];
 @override Future<RoomInfo> room(String id) async=>
  RoomInfo(id,'Mathematics','masana_math','en',5,paid,previousMember||joins>0);
 @override Future<void> join(String id)async{joins++;}
 @override Future<void> leave(String id)async{}
 @override Future<List<RoomQuestion>> questions(String id)async{
  if(previousMember){
   final request=RequestOptions(path:'/v1/rooms/$id/questions');
   throw DioException(requestOptions:request,
    response:Response(requestOptions:request,statusCode:403));
  }
  return [];
 }
 @override Future<List<RoomLesson>> lessons(String id)async=>[];
 @override Future<RoomQuestion> ask(String id,String text,String key)async=>throw UnimplementedError();
}
class FakePlans implements RoomSubscriptionsClient {
 int verifies=0;
 @override Future<RoomPaymentOptions> options(String id)async=>
  const RoomPaymentOptions([],false,null);
 @override Future<List<RoomSubscription>> mine()async=>[];
 @override Future<RoomSubscription> verify({
  required String roomId,required RoomStorePrice price,required String purchaseToken})async{
  verifies++;
  throw StateError('no verified Play purchase');
 }
}
class UnavailablePlay implements RoomBillingStore {
 int purchaseAttempts=0;
 @override Stream<RoomPurchaseEvent> get purchases=>const Stream<RoomPurchaseEvent>.empty();
 @override Future<bool> available()async=>false;
 @override Future<RoomPlayProduct?> product(String sku)async=>null;
 @override Future<void> buy(RoomPlayProduct product,String binding)async{
  purchaseAttempts++;throw StateError('Play unavailable');
 }
 @override Future<void> restore()async{}
 @override Future<void> complete(RoomPurchaseEvent event)async{}
}
void main(){
 testWidgets('paid Room cannot silently start billing when no adapter is injected',(tester)async{
  final rooms=FakeRooms();
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:rooms,id:'room_math')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Subscribe or join Room'));
  await tester.pump();
  expect(find.textContaining('Google Play subscriptions are not available'),findsOneWidget);
  expect(rooms.joins,0);
 });
 testWidgets('paid Room opens canonical checkout and denies unsupported Play',(tester)async{
  final rooms=FakeRooms(),plans=FakePlans(),play=UnavailablePlay();
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:rooms,id:'room_math',
   subscriptionsClient:plans,billingStore:play)));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Subscribe or join Room'));await tester.pumpAndSettle();
  expect(find.text('Room subscription'),findsOneWidget);
  expect(find.textContaining('Paid Rooms are not available'),findsOneWidget);
  expect(rooms.joins,0);expect(plans.verifies,0);expect(play.purchaseAttempts,0);
 });
 testWidgets('expired paid member is offered renewal without protected lessons',(tester)async{
  final rooms=FakeRooms(previousMember:true),plans=FakePlans(),play=UnavailablePlay();
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:rooms,id:'room_math',
   subscriptionsClient:plans,billingStore:play)));
  await tester.pumpAndSettle();
  expect(find.text('Renew subscription'),findsOneWidget);
  expect(find.textContaining('A verified subscription is required'),findsOneWidget);
  expect(find.text('Ask your teacher'),findsNothing);
  await tester.tap(find.text('Renew subscription'));await tester.pumpAndSettle();
  expect(find.text('Room subscription'),findsOneWidget);
  expect(rooms.joins,0);
 });
 testWidgets('free Rooms preserve original join without paid provider dependency',(tester)async{
  final rooms=FakeRooms(paid:false);
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:rooms,id:'room_math')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Join free Room'));await tester.pumpAndSettle();
  expect(rooms.joins,1);
  expect(find.text('Leave Room'),findsOneWidget);
 });
}

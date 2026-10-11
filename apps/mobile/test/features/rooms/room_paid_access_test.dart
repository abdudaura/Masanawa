import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/rooms_client.dart';
import 'package:masanawa/src/features/rooms/rooms_screen.dart';

class PaidRooms implements RoomsClient, RoomSubscriptionClient {
 int joins=0,verifications=0,purchases=0;
 bool subscribed=false,failVerify=false,previousMember=false;
 final price=const RoomPrice(planId:'room-plan_math',version:1,
  amountMinor:'39900',currency:'NGN',storeProductId:'maths_monthly',
  effectiveAt:'2026-10-11T00:00:00Z');
 @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''})async=>
  [const RoomInfo('room_math','Mathematics','masana_math','en',5,true,false)];
 @override Future<RoomInfo> room(String id)async=>
  RoomInfo(id,'Mathematics','masana_math','en',5,true,joins>0||previousMember);
 @override Future<List<RoomQuestion>> questions(String id)async{
  if(previousMember&&!subscribed){throw DioException(
    requestOptions:RequestOptions(path:'/v1/rooms/$id/questions'),
    response:Response(requestOptions:RequestOptions(path:'/v1/rooms/$id/questions'),statusCode:403));}
  return [];
 }
 @override Future<List<String>> lessons(String id)async=>[];
 @override Future<RoomQuestion> ask(String id,String text,String key)async=>
  throw UnimplementedError();
 @override Future<void> join(String id)async{if(!subscribed)throw StateError('no entitlement');joins++;}
 @override Future<void> leave(String id)async{joins=0;}
 @override Future<List<RoomPrice>> listPrices(String id)async=>[price];
 @override Future<List<RoomSubscription>> myEntitlements()async=>
  subscribed?[RoomSubscription('room_math','room-plan_math',1,'active',
   DateTime.now().add(const Duration(days:15)).toUtc().toIso8601String())]:[];
 @override Future<RoomSubscription> verifyPurchase(String id,RoomPrice p,String token)async{
  verifications++;
  if(token!='provider_purchase_token'||p.storeProductId!=price.storeProductId||failVerify){
   throw StateError('purchase cannot be verified');
  }
  subscribed=true;
  return RoomSubscription(id,p.planId,p.version,'active',
   DateTime.now().add(const Duration(days:15)).toUtc().toIso8601String());
 }
}
void main(){
 testWidgets('paid Room does not grant access when checkout unavailable',(tester)async{
  final c=PaidRooms();
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:c,id:'room_math')));
  await tester.pumpAndSettle();
  expect(find.text('Subscribe or join Room'),findsOneWidget);
  await tester.tap(find.text('Subscribe or join Room'));
  await tester.pumpAndSettle();
  expect(find.textContaining('Google Play checkout is unavailable'),findsOneWidget);
  expect(c.joins,0);expect(c.verifications,0);
 });
 testWidgets('verified purchase is required before Room join',(tester)async{
  final c=PaidRooms();
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:c,id:'room_math',
   playCheckout:(id)async{c.purchases++;return 'provider_purchase_token';})));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Subscribe or join Room'));await tester.pumpAndSettle();
  await tester.tap(find.textContaining('NGN 39900'));await tester.pumpAndSettle();
  expect(c.purchases,1);expect(c.verifications,1);expect(c.joins,1);
  expect(find.text('Leave Room'),findsOneWidget);
 });
 testWidgets('failed provider verification never joins or fabricates access',(tester)async{
  final c=PaidRooms()..failVerify=true;
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:c,id:'room_math',
   playCheckout:(_)async=>'provider_purchase_token')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Subscribe or join Room'));await tester.pumpAndSettle();
  await tester.tap(find.textContaining('NGN 39900'));await tester.pumpAndSettle();
  expect(find.textContaining('Could not confirm subscription'),findsOneWidget);
  expect(c.verifications,1);expect(c.joins,0);
 });
 testWidgets('already-verified subscription rejoins without another charge',(tester)async{
  final c=PaidRooms()..subscribed=true;
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:c,id:'room_math')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Subscribe or join Room'));await tester.pumpAndSettle();
  await tester.tap(find.text('Join subscribed Room'));await tester.pumpAndSettle();
  expect(c.joins,1);expect(c.purchases,0);expect(c.verifications,0);
 });
 testWidgets('expired paid Room member sees renewal instead of inaccessible loading error',(tester)async{
  final c=PaidRooms()..previousMember=true;
  await tester.pumpWidget(MaterialApp(home:RoomHomeScreen(client:c,id:'room_math',
   playCheckout:(_)async=>'provider_purchase_token')));
  await tester.pumpAndSettle();
  expect(find.text('Renew subscription'),findsOneWidget);
  expect(find.textContaining('A verified subscription is required'),findsOneWidget);
  expect(find.text('Ask your teacher'),findsNothing);
  await tester.tap(find.text('Renew subscription'));await tester.pumpAndSettle();
  await tester.tap(find.textContaining('NGN 39900'));await tester.pumpAndSettle();
  expect(c.verifications,1);expect(c.joins,1);
  expect(find.text('Leave Room'),findsOneWidget);
 });
 test('expiry or suspended payment never permits offline access',(){
  expect(const RoomSubscription('room_math','plan',1,'on_hold','2035-01-01T00:00:00Z')
   .permitsAccess,isFalse);
  expect(const RoomSubscription('room_math','plan',1,'active','2020-01-01T00:00:00Z')
   .permitsAccess,isFalse);
 });
}

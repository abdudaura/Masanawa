import 'dart:async';
import 'package:dio/dio.dart';
import 'room_billing_store.dart';
import 'rooms_client.dart';

/// Adapter for the ONE existing RoomPaidSubscriptionSheet flow.
/// No purchase token is logged, cached or used as client-side entitlement.
class RoomGooglePlayCheckout {
 RoomGooglePlayCheckout({
  required this.roomId,required this.http,required this.rooms,
  RoomBillingStore? store,
 }):store=store??InAppPurchaseRoomBillingStore();
 final String roomId;
 final Dio http;
 final RoomSubscriptionClient rooms;
 final RoomBillingStore store;
 Future<String?> call(String productId)async {
  final response=await http.get<Map<String,dynamic>>(
   '/v1/rooms/${Uri.encodeComponent(roomId)}/plans');
  final data=response.data??{};
  if(data['storeEnabled']!=true)return null;
  final buyerBinding=data['buyerBinding'];
  if(buyerBinding is! String||buyerBinding.isEmpty)return null;
  final raw=(data['prices'] as List<dynamic>?)??[];
  final matching=raw.map((j)=>RoomPrice.fromJson(j as Map<String,dynamic>)).where(
    (p)=>p.storeProductId==productId).toList();
  if(matching.length!=1||!await store.available())return null;
  final product=await store.product(productId);
  if(product==null)return null;
  final result=Completer<RoomPurchaseEvent?>();
  final listener=store.purchases.listen((event){
   if(event.productId!=productId||result.isCompleted)return;
   if(event.phase==RoomPurchasePhase.purchased||event.phase==RoomPurchasePhase.restored){
    result.complete(event);
   }else if(event.phase==RoomPurchasePhase.failed||event.phase==RoomPurchasePhase.canceled){
    result.complete(null);
   }
  },onError:(Object _){
   if(!result.isCompleted)result.complete(null);
  });
  try {
   await store.buy(product,buyerBinding);
   final event=await result.future.timeout(const Duration(minutes:3),onTimeout:()=>null);
   if(event==null||event.token.isEmpty)return null;
   // Only the authenticated Gateway can grant access. This extra verification
   // precedes Flutter completion; the existing sheet performs a safe idempotent
   // receipt readback before joining the Room.
   final paid=await rooms.verifyPurchase(roomId,matching.single,event.token);
   if(!paid.permitsAccess||paid.roomId!=roomId)return null;
   await store.complete(event);
   return event.token;
  }finally{await listener.cancel();}
 }
}

import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';

enum RoomPurchasePhase { pending, purchased, restored, canceled, failed }
class RoomPurchaseEvent {
 const RoomPurchaseEvent({required this.productId,required this.token,
  required this.phase,required this.pendingCompletion,required this.original});
 final String productId,token;
 final RoomPurchasePhase phase;
 final bool pendingCompletion;
 final PurchaseDetails original;
}
class RoomPlayProduct {
 const RoomPlayProduct(this.sku,this.displayPrice,this.details);
 final String sku,displayPrice;
 final ProductDetails details;
}
abstract class RoomBillingStore {
 Stream<RoomPurchaseEvent> get purchases;
 Future<bool> available();
 Future<RoomPlayProduct?> product(String sku);
 Future<void> buy(RoomPlayProduct item,String buyerBinding);
 Future<void> restore();
 Future<void> complete(RoomPurchaseEvent event);
}
/// Google Play subscription checkout; final entitlement ONLY comes from server verification.
/// applicationUserName is passed as BillingFlowParams obfuscated account identity.
class InAppPurchaseRoomBillingStore implements RoomBillingStore {
 InAppPurchaseRoomBillingStore({InAppPurchase? store}):_store=store??InAppPurchase.instance;
 final InAppPurchase _store;
 @override Stream<RoomPurchaseEvent> get purchases => _store.purchaseStream.expand((items) =>
  items.map((p) => RoomPurchaseEvent(
   productId:p.productID,token:p.verificationData.serverVerificationData,
   phase:switch(p.status){
    PurchaseStatus.pending=>RoomPurchasePhase.pending,
    PurchaseStatus.purchased=>RoomPurchasePhase.purchased,
    PurchaseStatus.restored=>RoomPurchasePhase.restored,
    PurchaseStatus.canceled=>RoomPurchasePhase.canceled,
    PurchaseStatus.error=>RoomPurchasePhase.failed,
   },
   pendingCompletion:p.pendingCompletePurchase,original:p,
  )));
 @override Future<bool> available()=>_store.isAvailable();
 @override Future<RoomPlayProduct?> product(String sku) async {
  final data=await _store.queryProductDetails({sku});
  if(data.error!=null)throw StateError('Play product lookup failed');
  if(data.notFoundIDs.contains(sku))return null;
  for(final item in data.productDetails){
   if(item.id==sku)return RoomPlayProduct(sku,item.price,item);
  }
  return null;
 }
 @override Future<void> buy(RoomPlayProduct item,String buyerBinding) async {
  if(buyerBinding.isEmpty||buyerBinding.length>64)throw ArgumentError.value(buyerBinding,'buyerBinding');
  final accepted=await _store.buyNonConsumable(purchaseParam:
   PurchaseParam(productDetails:item.details,applicationUserName:buyerBinding));
  if(!accepted)throw StateError('Google Play checkout could not start');
 }
 @override Future<void> restore()=>_store.restorePurchases();
 @override Future<void> complete(RoomPurchaseEvent event) async {
  if(event.pendingCompletion)await _store.completePurchase(event.original);
 }
}

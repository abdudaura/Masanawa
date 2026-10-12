import 'dart:async';
import 'package:flutter/material.dart';
import 'room_billing_store.dart';
import 'room_subscriptions_client.dart';

/// C35: store offer, explicit consent, pending verification, restore and denial.
/// Billing never directly grants Room membership or reads private lessons.
class RoomSubscribeScreen extends StatefulWidget {
 const RoomSubscribeScreen({super.key,required this.roomId,required this.client,
  required this.store});
 final String roomId;
 final RoomSubscriptionsClient client;
 final RoomBillingStore store;
 @override State<RoomSubscribeScreen> createState()=>_RoomSubscribeScreenState();
}
class _RoomSubscribeScreenState extends State<RoomSubscribeScreen> {
 RoomPaymentOptions? options;RoomStorePrice? selected;RoomPlayProduct? product;
 StreamSubscription<RoomPurchaseEvent>? listener;
 bool loading=true,processing=false,acceptedTerms=false;
 String? failure,notice;RoomSubscription? entitlement;
 @override void initState(){super.initState();
  listener=widget.store.purchases.listen(onPurchase,onError:(Object e) {
   if(mounted)setState(()=>failure='Play connection interrupted. You can retry or restore.');
  });
  load();
 }
 @override void dispose(){listener?.cancel();super.dispose();}
 Future<void> load()async{
  setState(() {loading=true;failure=null;});
  try{
   final opts=await widget.client.options(widget.roomId);
   if(!mounted)return;
   final storeReady=opts.storeEnabled&&await widget.store.available();
   final target=opts.prices.isNotEmpty?opts.prices.first:null;
   RoomPlayProduct? found;
   if(storeReady&&target!=null)found=await widget.store.product(target.storeProductId);
   if(!mounted)return;
   setState((){options=opts;selected=target;product=found;loading=false;
    if(!storeReady)notice='Paid Rooms are not available from this installation.';
   });
  }catch(_){if(mounted)setState((){failure='Unable to load subscription offer. Retry when online.';loading=false;});}
 }
 Future<void> onPurchase(RoomPurchaseEvent event)async{
  if(!mounted||event.productId!=selected?.storeProductId)return;
  if(event.phase==RoomPurchasePhase.pending){
   setState(()=>notice='Payment pending with Google Play. Access has not been granted.');return;
  }
  if(event.phase==RoomPurchasePhase.canceled){
   setState(()=>notice='Checkout cancelled. No access granted.');return;
  }
  if(event.phase==RoomPurchasePhase.failed){
   setState(()=>failure='Google Play could not complete your purchase.');return;
  }
  if(processing)return;
  setState(() {processing=true;failure=null;notice='Verifying purchase with Google Play…';});
  try{
   final price=selected;
   if(price==null||event.token.isEmpty)throw const FormatException('Missing purchase data');
   final verified=await widget.client.verify(roomId:widget.roomId,
    price:price,purchaseToken:event.token);
   if(verified.state!='active'&&verified.state!='grace'){
    throw const FormatException('Purchase not yet entitled');
   }
   // Acknowledge/complete local store only after server acceptance. Server also
   // acknowledges via Play Developer API; both operations are idempotent.
   await widget.store.complete(event);
   if(mounted)setState(() {entitlement=verified;notice='Subscription verified. You can enter the Room.';});
  }catch(_){
   if(mounted)setState(()=>failure='Purchase is not verified. Your payment will not be charged twice by retrying verification.');
  }finally{if(mounted)setState(()=>processing=false);}
 }
 Future<void> buy()async{
  final p=product,opts=options;
  if(p==null||opts==null||!acceptedTerms||processing||!opts.storeEnabled||
    opts.buyerBinding==null)return;
  setState(() {processing=true;failure=null;notice='Opening Google Play…';});
  try{await widget.store.buy(p,opts.buyerBinding!);}
  catch(_){if(mounted)setState(()=>failure='Could not open Google Play. Try again.');}
  finally{if(mounted)setState(()=>processing=false);}
 }
 Future<void> restore()async{
  if(processing||options?.storeEnabled!=true)return;
  setState(() {processing=true;failure=null;notice='Checking Google Play for existing subscriptions…';});
  try{await widget.store.restore();}
  catch(_){if(mounted)setState(()=>failure='Restore failed. Please retry while online.');}
  finally{if(mounted)setState(()=>processing=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Room subscription')),
  body:loading?const Center(child:CircularProgressIndicator()):
   failure!=null&&options==null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(failure!),TextButton(onPressed:load,child:const Text('Retry'))])):
   ListView(padding:const EdgeInsets.all(18),children:[
    Text('Subscribe to this professional Room',style:Theme.of(context).textTheme.titleLarge),
    const SizedBox(height:8),
    const Text('Membership and private lessons are unlocked only after Google Play confirms payment.'),
    if(selected!=null)Card(child:ListTile(
     title:Text(product?.displayPrice??'Store price unavailable'),
     subtitle:Text('Plan version ${selected!.version} · ${selected!.currency} · billed by Google Play'),
    )),
    if(product==null)const ListTile(title:Text('Offer unavailable'),
     subtitle:Text('No verified Google Play subscription is currently available.')),
    CheckboxListTile(value:acceptedTerms,controlAffinity:ListTileControlAffinity.leading,
     title:const Text('I agree to the subscription terms and recurring payment shown by Google Play.'),
     onChanged:product==null?null:(v)=>setState(()=>acceptedTerms=v==true)),
    FilledButton(onPressed:acceptedTerms&&!processing&&product!=null&&options?.storeEnabled==true?buy:null,
     child:Text(processing?'Working…':'Continue to Google Play')),
    TextButton(onPressed:processing?null:restore,child:const Text('Restore existing subscription')),
    TextButton(onPressed:processing?null:load,child:const Text('Refresh offer')),
    if(notice!=null)ListTile(leading:const Icon(Icons.info_outline),title:Text(notice!)),
    if(failure!=null)ListTile(leading:const Icon(Icons.error_outline),title:Text(failure!)),
    if(entitlement!=null)ListTile(leading:const Icon(Icons.verified_outlined),
     title:const Text('Verified by the server'),subtitle:Text('Access until ${entitlement!.periodEnd}'),
     trailing:TextButton(onPressed:()=>Navigator.maybePop(context,true),child:const Text('Go to Room'))),
  ])
 );
}

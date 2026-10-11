import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_client.dart';
const masanaBlue=Color(0xFF1E63D6);
/// Must launch the real Google Play sheet and yield only its purchase token.
/// The server still verifies independently. Null means cancelled/unavailable.
typedef RoomPlayCheckout=Future<String?> Function(String storeProductId);
String roomError(Object e){
 if(e is DioException){
  if(e.response?.statusCode==403)return 'Membership or verified subscription required.';
  if(e.response?.statusCode==410)return 'This feature is currently disabled.';
  if(e.response?.statusCode==429)return 'Daily question limit reached.';
  if(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout)return 'Offline. Retry after reconnecting.';
 }
 return 'Could not load. Check the network and retry.';
}
class RoomsScreen extends StatefulWidget {
 const RoomsScreen({super.key,required this.client,this.playCheckout});
 final RoomsClient client;
 final RoomPlayCheckout? playCheckout;
 @override State<RoomsScreen> createState()=>_RoomsScreenState();
}
class _RoomsScreenState extends State<RoomsScreen>{
 bool joined=false,loading=true;Object? error;List<RoomInfo> rows=[];
 String query='',language='';
 @override void initState(){super.initState();load();}
 Future<void> load()async{
  setState((){loading=true;error=null;});
  try{final list=await widget.client.list(joined:joined,query:query,language:language);
   if(mounted)setState((){rows=list;loading=false;});
  }catch(e){if(mounted)setState((){error=e;loading=false;});}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Rooms'),backgroundColor:masanaBlue,foregroundColor:Colors.white),
  body:Column(children:[
   Padding(padding:const EdgeInsets.all(12),child:TextField(
    decoration:const InputDecoration(prefixIcon:Icon(Icons.search),hintText:'Search professions'),
    onSubmitted:(v){query=v;load();})),
   Row(children:[
    ChoiceChip(label:const Text('Discover'),selected:!joined,onSelected:(_){joined=false;load();}),
    const SizedBox(width:8),
    ChoiceChip(label:const Text('Joined'),selected:joined,onSelected:(_){joined=true;load();}),
    const Spacer(),
    DropdownButton<String>(value:language,items:const [
     DropdownMenuItem(value:'',child:Text('All')),
     DropdownMenuItem(value:'en',child:Text('English')),
     DropdownMenuItem(value:'ha',child:Text('Hausa'))],
     onChanged:(v){language=v??'';load();})
   ]),
   Expanded(child:loading?const Center(child:CircularProgressIndicator()):
    error!=null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
     Text(roomError(error!)),TextButton(onPressed:load,child:const Text('Retry'))])):
    rows.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
     const Text('No Rooms match this search.'),
     TextButton(onPressed:(){query='';language='';load();},child:const Text('Show all'))])):
    RefreshIndicator(onRefresh:load,child:ListView.builder(itemCount:rows.length,itemBuilder:(context,i){
     final r=rows[i];return ListTile(
      leading:const CircleAvatar(child:Icon(Icons.school_outlined)),
      title:Text(r.title),subtitle:Text("${r.language} · ${r.members} members · ${r.paid ? 'Paid' : 'Free'}"),
      trailing:Icon(r.joined?Icons.check_circle_outline:Icons.chevron_right,color:masanaBlue),
      onTap:()async{
       await Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>RoomHomeScreen(client:widget.client,id:r.id,playCheckout:widget.playCheckout)));
       if(mounted)load();
      });
    })))
  ]),
 );
}
class RoomHomeScreen extends StatefulWidget {
 const RoomHomeScreen({super.key,required this.client,required this.id,this.playCheckout});
 final RoomsClient client;final String id;
 final RoomPlayCheckout? playCheckout;
 @override State<RoomHomeScreen> createState()=>_RoomHomeScreenState();
}
class _RoomHomeScreenState extends State<RoomHomeScreen>{
 final question=TextEditingController();
 RoomInfo? info;List<RoomQuestion> items=[];List<String> lessons=[];
 bool loading=true,busy=false;Object? error;int tab=0;String? pendingKey;
 @override void initState(){super.initState();load();}
 @override void dispose(){question.dispose();super.dispose();}
 Future<void> load()async{
  setState((){loading=true;error=null;});
  try{final room=await widget.client.room(widget.id);
   final qs=room.joined?await widget.client.questions(widget.id):<RoomQuestion>[];
   final ls=room.joined?await widget.client.lessons(widget.id):<String>[];
   if(mounted)setState((){info=room;items=qs;lessons=ls;loading=false;});
  }catch(e){if(mounted)setState((){error=e;loading=false;});}
 }
 Future<void> membership()async{
  if(info==null||busy)return;setState(()=>busy=true);
  try{if(info!.joined){await widget.client.leave(widget.id);}else{await widget.client.join(widget.id);}
   await load();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> paidJoin()async{
  if(busy||info==null)return;
  if(widget.client is! RoomSubscriptionClient){
   ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content:Text('Room subscriptions are currently unavailable.')));
   return;
  }
  setState(()=>busy=true);
  try{
   final verified=await showModalBottomSheet<bool>(context:context,isScrollControlled:true,
    builder:(_)=>RoomPaidSubscriptionSheet(roomId:widget.id,
     client:widget.client as RoomSubscriptionClient,checkout:widget.playCheckout));
   if(verified==true){
    // This endpoint re-checks the Play entitlement before creating membership.
    await widget.client.join(widget.id);
    await load();
   }
  }catch(e){
   if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));
  }finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> ask()async{
  if(busy||question.text.trim().length<4)return;
  pendingKey??='rq_'+DateTime.now().microsecondsSinceEpoch.toString()+'_'
   +List.generate(12,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  setState(()=>busy=true);
  try{await widget.client.ask(widget.id,question.text.trim(),pendingKey!);
   pendingKey=null;question.clear();await load();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:Text(info?.title??'Room'),backgroundColor:masanaBlue,foregroundColor:Colors.white),
  body:loading?const Center(child:CircularProgressIndicator()):
   error!=null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(roomError(error!)),TextButton(onPressed:load,child:const Text('Retry'))])):
   info==null?const Center(child:Text('Room not found')):
   Column(children:[
    Padding(padding:const EdgeInsets.all(16),child:Column(children:[
     Text(info!.title,style:Theme.of(context).textTheme.titleLarge),
     Text('Teacher: ${info!.teacher} · ${info!.members} members'),
     if(info!.paid)const Text('Paid lessons need a verified Google Play subscription.'),
     FilledButton(onPressed:busy?null:(info!.paid&&!info!.joined?paidJoin:membership),
      child:Text(info!.joined?'Leave Room':info!.paid?'Subscribe or join Room':'Join free Room'))])),
    if(info!.joined)...[
     SegmentedButton<int>(segments:const [
       ButtonSegment(value:0,label:Text('Lessons')),ButtonSegment(value:1,label:Text('Questions')),
       ButtonSegment(value:2,label:Text('Discussion'))],
       selected:{tab},onSelectionChanged:(selection)=>setState(()=>tab=selection.first)),
     Expanded(child:tab==2?const Center(child:Text('Moderated discussion is not available yet.')):
       tab==0?(lessons.isEmpty?const Center(child:Text('Lessons coming soon')):
       ListView.builder(itemCount:lessons.length,itemBuilder:(_,i)=>ListTile(title:Text(lessons[i])))):
       RefreshIndicator(onRefresh:load,child:ListView(children:[
        if(items.isEmpty)const ListTile(title:Text('Ask the first question.')),
        for(final q in items)ListTile(title:Text(q.body),
         subtitle:Text(q.answer??'Teacher reply pending · ${q.status}')),
       ]))),
     if(tab==1)SafeArea(child:Padding(padding:const EdgeInsets.all(8),child:Row(children:[
       Expanded(child:TextField(controller:question,maxLength:2000,maxLines:2,
        decoration:const InputDecoration(hintText:'Ask your teacher',border:OutlineInputBorder()))),
       IconButton(icon:const Icon(Icons.send,color:masanaBlue),onPressed:busy?null:ask,tooltip:'Send question'),
     ]))),
    ]else Expanded(child:Center(child:Text(info!.paid?'Subscribe or join to access lessons and questions':'Join to see lessons and ask questions'))),
   ])
 );
}

/// C35 — Never treat a client-side purchase result as an entitlement. The token
/// goes to the authenticated Gateway, then Room join rechecks verified PG state.
class RoomPaidSubscriptionSheet extends StatefulWidget {
 const RoomPaidSubscriptionSheet({super.key,required this.roomId,
  required this.client,this.checkout});
 final String roomId;
 final RoomSubscriptionClient client;
 final RoomPlayCheckout? checkout;
 @override State<RoomPaidSubscriptionSheet> createState()=>_RoomPaidSubscriptionSheetState();
}
class _RoomPaidSubscriptionSheetState extends State<RoomPaidSubscriptionSheet>{
 bool loading=true,busy=false,alreadyEntitled=false;
 Object? failure;
 List<RoomPrice> prices=[];
 @override void initState(){super.initState();refresh();}
 Future<void> refresh()async{
  if(busy)return;
  setState((){loading=true;failure=null;});
  try{
   final all=await Future.wait<dynamic>([
    widget.client.listPrices(widget.roomId),
    widget.client.myEntitlements()]);
   final p=all[0] as List<RoomPrice>,e=all[1] as List<RoomSubscription>;
   if(mounted)setState((){
    prices=p;alreadyEntitled=e.any((x)=>x.roomId==widget.roomId&&x.permitsAccess);
    loading=false;
   });
  }catch(err){if(mounted)setState((){failure=err;loading=false;});}
 }
 Future<void> buy(RoomPrice price)async{
  if(busy||loading||widget.checkout==null)return;
  setState((){busy=true;failure=null;});
  try{
   final token=await widget.checkout!(price.storeProductId);
   if(token==null||token.isEmpty)return; // Cancelled; do not fabricate access.
   final result=await widget.client.verifyPurchase(widget.roomId,price,token);
   if(!result.permitsAccess||result.roomId!=widget.roomId){
    throw StateError('The subscription is not yet active.');
   }
   if(mounted)Navigator.pop(context,true);
  }catch(err){
   // If network confirmation is ambiguous, reload server truth rather than
   // automatically charging / opening another billing sheet.
   if(mounted)setState(()=>failure=err);
  }finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>SafeArea(child:Padding(
  padding:EdgeInsets.fromLTRB(20,20,20,20+MediaQuery.viewInsetsOf(context).bottom),
  child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.stretch,children:[
   Text('Room subscription',style:Theme.of(context).textTheme.titleLarge),
   const SizedBox(height:8),
   const Text('Your access starts only after Google Play verifies the purchase.'),
   if(loading)const Padding(padding:EdgeInsets.all(18),child:Center(child:CircularProgressIndicator())),
   if(failure!=null)...[
    Text('Could not confirm subscription. Check your Google Play purchases, then refresh.',
     style:TextStyle(color:Theme.of(context).colorScheme.error)),
    TextButton(onPressed:busy?null:refresh,child:const Text('Refresh status')),
   ],
   if(!loading&&alreadyEntitled)
    FilledButton(onPressed:busy?null:()=>Navigator.pop(context,true),
     child:const Text('Join subscribed Room')),
   if(!loading&&!alreadyEntitled)...[
    if(prices.isEmpty)const Text('No subscription plans are currently available.'),
    for(final price in prices)ListTile(
     title:Text('${price.currency} ${price.amountMinor} minor units'),
     subtitle:Text('Google Play product: ${price.storeProductId}'),
     trailing:busy?const SizedBox(height:18,width:18,child:CircularProgressIndicator()):
      const Icon(Icons.open_in_new),
     onTap:busy||widget.checkout==null?null:()=>buy(price)),
    if(widget.checkout==null)const Text('Google Play checkout is unavailable on this device.'),
   ],
   TextButton(onPressed:busy?null:()=>Navigator.pop(context,false),
    child:const Text('Cancel')),
  ]),
 ));
}

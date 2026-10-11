import 'room_discussion_api.dart';
import 'room_discussion_screen.dart';
import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_client.dart';
import 'room_subscriptions_client.dart';
import 'room_billing_store.dart';
import 'room_subscribe_screen.dart';
const masanaBlue=Color(0xFF1E63D6);
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
 const RoomsScreen({super.key,required this.client,this.subscriptionsClient,this.billingStore,this.discussionApi,this.discussionAccountScope,this.onDiscussionReport});
 final RoomsClient client;
 final RoomSubscriptionsClient? subscriptionsClient;
 final RoomBillingStore? billingStore;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
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
       await Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>RoomHomeScreen(client:widget.client,id:r.id,
        subscriptionsClient:widget.subscriptionsClient,billingStore:widget.billingStore,
        discussionApi:widget.discussionApi,discussionAccountScope:widget.discussionAccountScope,
        onDiscussionReport:widget.onDiscussionReport)));
       if(mounted)load();
      });
    })))
  ]),
 );
}
class RoomHomeScreen extends StatefulWidget {
 const RoomHomeScreen({super.key,required this.client,required this.id,
  this.subscriptionsClient,this.billingStore,this.discussionApi,this.discussionAccountScope,this.onDiscussionReport});
 final RoomsClient client;final String id;
 final RoomSubscriptionsClient? subscriptionsClient;
 final RoomBillingStore? billingStore;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
 @override State<RoomHomeScreen> createState()=>_RoomHomeScreenState();
}
class _RoomHomeScreenState extends State<RoomHomeScreen>{
 final question=TextEditingController();
 RoomInfo? info;List<RoomQuestion> items=[];List<String> lessons=[];
 bool loading=true,busy=false,paidAccessBlocked=false;Object? error;int tab=0;String? pendingKey;
 @override void initState(){super.initState();load();}
 @override void dispose(){question.dispose();super.dispose();}
 Future<void> load()async{
  setState((){loading=true;error=null;});
  try{final room=await widget.client.room(widget.id);
   List<RoomQuestion> qs=[];
   List<String> ls=[];
   bool subscriptionBlocked=false;
   if(room.joined){
    try{
     qs=await widget.client.questions(widget.id);
     ls=await widget.client.lessons(widget.id);
    }on DioException catch(e){
     // Membership is not entitlement. Expired/held paid users must still see
     // the Room preview and regain access through verified Play checkout.
     if(room.paid&&e.response?.statusCode==403){subscriptionBlocked=true;}
     else{rethrow;}
    }
   }
   if(mounted)setState((){
    info=room;items=qs;lessons=ls;paidAccessBlocked=subscriptionBlocked;loading=false;
   });
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
  final subscription=widget.subscriptionsClient;
  final billing=widget.billingStore;
  if(subscription==null||billing==null){
   ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content:Text('Google Play subscriptions are not available on this device.')));
   return;
  }
  setState(()=>busy=true);
  try{
   final verified=await Navigator.push<bool>(context,MaterialPageRoute(
    builder:(_)=>RoomSubscribeScreen(roomId:widget.id,
     client:subscription,store:billing)));
   if(!mounted)return;
   if(verified==true){
    // Only the Gateway's verified Play entitlement can authorize this join.
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
     FilledButton(onPressed:busy?null:(info!.paid&&(paidAccessBlocked||!info!.joined)?paidJoin:membership),
      child:Text(paidAccessBlocked?'Renew subscription':
       info!.joined?'Leave Room':info!.paid?'Subscribe or join Room':'Join free Room'))])),
    if(info!.joined&&!paidAccessBlocked)...[
     SegmentedButton<int>(segments:const [
       ButtonSegment(value:0,label:Text('Lessons')),ButtonSegment(value:1,label:Text('Questions')),
       ButtonSegment(value:2,label:Text('Discussion'))],
       selected:{tab},onSelectionChanged:(selection)=>setState(()=>tab=selection.first)),
     Expanded(child:tab==2?(widget.discussionApi==null||widget.discussionAccountScope==null?
       const Center(child:Text('Discussion is not available yet.')):
       RoomDiscussionScreen(roomId:widget.id,api:widget.discussionApi!,
        accountScope:widget.discussionAccountScope!,onReport:widget.onDiscussionReport)):
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
    ]else Expanded(child:Center(child:Text(info!.paid?'A verified subscription is required to access lessons and questions':'Join to see lessons and ask questions'))),
   ])
 );
}


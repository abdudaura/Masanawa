import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_client.dart';
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
 const RoomsScreen({super.key,required this.client});
 final RoomsClient client;
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
       await Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>RoomHomeScreen(client:widget.client,id:r.id)));
       if(mounted)load();
      });
    })))
  ]),
 );
}
class RoomHomeScreen extends StatefulWidget {
 const RoomHomeScreen({super.key,required this.client,required this.id});
 final RoomsClient client;final String id;
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
  if(info==null||info!.paid||busy)return;setState(()=>busy=true);
  try{if(info!.joined){await widget.client.leave(widget.id);}else{await widget.client.join(widget.id);}
   await load();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>busy=false);}
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
     if(info!.paid)const Text('Subscriptions require verified Google Play checkout. Not available yet.'),
     FilledButton(onPressed:busy||info!.paid?null:membership,
      child:Text(info!.paid?'Subscribe (unavailable)':info!.joined?'Leave Room':'Join free Room'))])),
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
    ]else Expanded(child:Center(child:Text(info!.paid?'Paid membership not available':'Join to see lessons and ask questions'))),
   ])
 );
}

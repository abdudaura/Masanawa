import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'room_discussion_client.dart';
class RoomDiscussionModerationScreen extends StatefulWidget {
 const RoomDiscussionModerationScreen({super.key,required this.api,required this.accountScope});
 final RoomDiscussionModerationApi api;final String accountScope;
 @override State<RoomDiscussionModerationScreen> createState()=>_RoomDiscussionModerationScreenState();
}
class _RoomDiscussionModerationScreenState extends State<RoomDiscussionModerationScreen>{
 List<ModeratedRoomReply> rows=[];bool loading=true,busy=false;Object? error;int epoch=0;
 @override void initState(){super.initState();load();}
 @override void didUpdateWidget(covariant RoomDiscussionModerationScreen old){
  super.didUpdateWidget(old);
  if(old.api!=widget.api||old.accountScope!=widget.accountScope){
   epoch++;rows=[];load();
  }
 }
 @override void dispose(){epoch++;super.dispose();}
 Future<void> load()async{
  final e=++epoch;setState((){loading=true;error=null;});
  try{
   final r=await widget.api.queue();
   if(mounted&&e==epoch)setState((){rows=r;loading=false;});
  }catch(x){if(mounted&&e==epoch)setState((){error=x;loading=false;});}
 }
 String explain(Object e){
  if(e is DioException){
   if(e.response?.statusCode==403||e.response?.statusCode==401)return 'Moderator permission or session required.';
   if(e.response?.statusCode==410)return 'Discussion review is disabled.';
   if(e.response?.statusCode==409)return 'The reply has already changed. Reload the queue.';
   if(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout)
    return 'Offline. Reconnect and retry.';
  }
  return 'Could not load moderation queue.';
 }
 Future<void> decide(ModeratedRoomReply reply,String decision)async{
  if(busy)return;
  final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
   title:Text(decision=='approve'?'Approve public reply?':'Moderate this reply?'),
   content:Text('Room: '+reply.roomId+'\n'+reply.body),
   actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
  if(confirmed!=true||!mounted)return;
  final e=epoch;setState(()=>busy=true);
  try{
   await widget.api.review(reply.id,decision);
   if(mounted&&e==epoch)await load();
  }catch(x){
   if(mounted&&e==epoch)ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content:Text(explain(x))));
  }finally{if(mounted&&e==epoch)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Room discussion review'),
   actions:[IconButton(onPressed:busy?null:load,tooltip:'Refresh',icon:const Icon(Icons.refresh))]),
  body:loading&&rows.isEmpty?const Center(child:CircularProgressIndicator()):
   error!=null&&rows.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(explain(error!)),TextButton(onPressed:load,child:const Text('Retry'))])):
   RefreshIndicator(onRefresh:load,child:ListView(children:[
    if(error!=null)ListTile(title:Text(explain(error!)),trailing:TextButton(onPressed:load,child:const Text('Retry'))),
    if(rows.isEmpty)const ListTile(title:Text('No replies awaiting review.')),
    for(final r in rows)Card(child:Column(children:[
     ListTile(title:Text(r.body),subtitle:Text(r.roomId+' · '+r.parentKind+' · '+r.parentId)),
     Wrap(spacing:8,children:[
      TextButton(onPressed:busy?null:()=>decide(r,'approve'),child:const Text('Approve')),
      TextButton(onPressed:busy?null:()=>decide(r,'hide'),child:const Text('Hide')),
      TextButton(onPressed:busy?null:()=>decide(r,'remove'),child:const Text('Remove')),
     ]),
    ]))
   ])),
 );
}

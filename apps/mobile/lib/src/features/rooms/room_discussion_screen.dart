import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'room_discussion_api.dart';

String roomDiscussionError(Object e){
 if(e is DioException){
  if(e.response?.statusCode==410)return 'Discussion is not available yet.';
  if(e.response?.statusCode==401)return 'Sign in again to continue.';
  if(e.response?.statusCode==403)return 'Join this Room and verify any required subscription.';
  if(e.response?.statusCode==409)return 'This reply changed. Refresh and try again.';
  if(e.response?.statusCode==429)return 'Please try again later.';
  if(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout)
   return 'Offline. Your draft is still here; retry when connected.';
 }
 return 'Discussion could not load. Try again.';
}
class RoomDiscussionScreen extends StatefulWidget {
 const RoomDiscussionScreen({super.key,required this.roomId,required this.api,
  required this.accountScope,this.onReport});
 final String roomId,accountScope;final RoomDiscussionApi api;
 final ValueChanged<RoomDiscussionReply>? onReport;
 @override State<RoomDiscussionScreen> createState()=>_RoomDiscussionScreenState();
}
class _RoomDiscussionScreenState extends State<RoomDiscussionScreen>{
 final input=TextEditingController();
 List<RoomDiscussionTarget> targets=[];RoomDiscussionTarget? selected;
 List<RoomDiscussionReply> items=[];String? cursor,pendingKey;Object? error;
 bool loading=true,sending=false,loadingMore=false;int revision=0;
 @override void initState(){super.initState();refresh();}
 @override void didUpdateWidget(covariant RoomDiscussionScreen old){
  super.didUpdateWidget(old);
  if(old.accountScope!=widget.accountScope||old.roomId!=widget.roomId||old.api!=widget.api){
   revision++;targets=[];selected=null;items=[];cursor=null;pendingKey=null;input.clear();refresh();
  }
 }
 @override void dispose(){revision++;input.dispose();super.dispose();}
 Future<void> refresh()async{
  final n=++revision;setState((){loading=true;error=null;});
  try{
   final ts=await widget.api.targets(widget.roomId);
   if(!mounted||n!=revision)return;
   RoomDiscussionTarget? target;
   for(final t in ts){if(t.kind==selected?.kind&&t.id==selected?.id){target=t;break;}}
   if(target==null&&ts.isNotEmpty)target=ts.first;
   final page=target==null?const RoomDiscussionPage([],null):await widget.api.list(widget.roomId,target);
   if(!mounted||n!=revision)return;
   setState((){targets=ts;selected=target;items=page.items;cursor=page.cursor;loading=false;});
  }catch(e){if(mounted&&n==revision)setState((){error=e;loading=false;});}
 }
 Future<void> switchTarget(RoomDiscussionTarget? target)async{
  if(target==null)return;
  setState((){selected=target;items=[];cursor=null;pendingKey=null;input.clear();});
  await refresh();
 }
 Future<void> more()async{
  final next=cursor,t=selected;if(next==null||t==null||loadingMore)return;
  final n=revision;setState(()=>loadingMore=true);
  try{
   final page=await widget.api.list(widget.roomId,t,cursor:next);
   if(mounted&&n==revision)setState((){items=[...items,...page.items];cursor=page.cursor;});
  }catch(e){
   if(mounted&&n==revision)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomDiscussionError(e))));
  }finally{if(mounted&&n==revision)setState(()=>loadingMore=false);}
 }
 Future<void> send({String? parentReplyId})async{
  final target=selected,body=input.text.trim();
  if(sending||target==null||body.isEmpty||body.length>2000)return;
  pendingKey??='rd_'+DateTime.now().microsecondsSinceEpoch.toString()+'_'
   +List.generate(12,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  final n=revision, scope=widget.accountScope, room=widget.roomId, api=widget.api;
  setState(()=>sending=true);
  try{
   await widget.api.send(widget.roomId,target,body,pendingKey!,parentReplyId:parentReplyId);
   if(!mounted||n!=revision)return;
   input.clear();pendingKey=null;await refresh();
  }catch(e){
   if(mounted&&n==revision)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomDiscussionError(e))));
  }finally{if(mounted&&widget.accountScope==scope&&widget.roomId==room&&identical(widget.api,api))setState(()=>sending=false);}
 }
 @override Widget build(BuildContext context)=>Column(children:[
  if(targets.isNotEmpty)Padding(padding:const EdgeInsets.all(8),child:DropdownButtonFormField<String>(
   value:selected==null?null:selected!.kind+':'+selected!.id,
   isExpanded:true,decoration:const InputDecoration(labelText:'Discuss a lesson or question'),
   items:targets.map((t)=>DropdownMenuItem(value:t.kind+':'+t.id,
    child:Text((t.kind=='lesson'?'Lesson':'Question')+' · '+t.label,maxLines:1,overflow:TextOverflow.ellipsis))).toList(),
   onChanged:(v){for(final t in targets){if(t.kind+':'+t.id==v){switchTarget(t);break;}}})),
  Expanded(child:loading&&items.isEmpty?const Center(child:CircularProgressIndicator()):
   error!=null&&items.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(roomDiscussionError(error!)),TextButton(onPressed:refresh,child:const Text('Retry'))])):
   targets.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    const Text('No lessons or questions to discuss yet.'),
    TextButton(onPressed:refresh,child:const Text('Refresh'))])):
   RefreshIndicator(onRefresh:refresh,child:ListView(children:[
    if(error!=null)ListTile(title:Text(roomDiscussionError(error!)),
     subtitle:const Text('Showing previously loaded replies'),
     trailing:TextButton(onPressed:refresh,child:const Text('Retry'))),
    if(items.isEmpty)const ListTile(title:Text('Be the first to discuss this topic.')),
    for(final r in items)Card(child:Padding(
     padding:EdgeInsets.only(left:r.parentReplyId==null?8:28,right:8,top:4,bottom:4),
     child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Text(r.body),
      Text(r.state=='held'?'Pending moderator approval':r.state,
       style:Theme.of(context).textTheme.bodySmall),
      if(r.state=='visible')Row(children:[
       if(r.parentReplyId==null)TextButton(onPressed:()=>replyTo(r),child:const Text('Reply')),
       if(widget.onReport!=null)TextButton(onPressed:()=>widget.onReport!(r),child:const Text('Report')),
      ]),
     ]))),
    if(cursor!=null)Center(child:TextButton(onPressed:loadingMore?null:more,
     child:Text(loadingMore?'Loading':'Load more'))),
   ]))),
  if(selected!=null)SafeArea(top:false,child:Padding(padding:const EdgeInsets.all(8),
   child:Row(children:[
    Expanded(child:TextField(controller:input,maxLength:2000,maxLines:2,
     decoration:const InputDecoration(labelText:'Write a moderated reply',border:OutlineInputBorder()))),
    IconButton(icon:Icon(Icons.send,color:Theme.of(context).colorScheme.primary),tooltip:'Send reply for review',
     onPressed:sending?null:()=>send()),
   ]))),
 ]);
 Future<void> replyTo(RoomDiscussionReply parent)async{
  final target=selected;if(target==null)return;
  final text=TextEditingController();
  try{
   final body=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
    title:const Text('Reply in thread'),content:TextField(controller:text,maxLength:2000,maxLines:3,
     decoration:const InputDecoration(hintText:'Your reply is reviewed before publication')),
    actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Cancel')),
     FilledButton(onPressed:()=>Navigator.pop(ctx,text.text.trim()),child:const Text('Send'))]));
   if(body==null||body.isEmpty||!mounted)return;
   input.text=body;pendingKey=null;await send(parentReplyId:parent.id);
  }finally{text.dispose();}
 }
}

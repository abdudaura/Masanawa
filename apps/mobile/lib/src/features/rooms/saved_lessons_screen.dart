import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'saved_lessons_client.dart';

/// C38: saved lessons never render from an expired entitlement or another fan's account.
class SavedRoomLessonsScreen extends StatefulWidget {
 const SavedRoomLessonsScreen({super.key,required this.client,required this.roomId,required this.accountKey});
 final SavedLessonsClient client;
 final String roomId,accountKey;
 @override State<SavedRoomLessonsScreen> createState()=>_SavedRoomLessonsScreenState();
}
class _SavedRoomLessonsScreenState extends State<SavedRoomLessonsScreen> {
 List<SavedRoomLesson> items=const [];
 bool loading=true,working=false;
 String? message;
 int epoch=0;
 bool get active=>widget.accountKey.isNotEmpty&&widget.client.isCurrentAccount;
 @override void initState(){super.initState();load();}
 @override void didUpdateWidget(covariant SavedRoomLessonsScreen oldWidget){
  super.didUpdateWidget(oldWidget);
  if(oldWidget.accountKey!=widget.accountKey||oldWidget.client!=widget.client||oldWidget.roomId!=widget.roomId){
   epoch++;items=const [];loading=true;load();
  }
 }
 @override void dispose(){epoch++;super.dispose();}
 String friendly(Object error) {
  if(!active)return 'Sign in again to view your saved lessons.';
  if(error is DioException){
   if(error.response?.statusCode==401)return 'Session expired. Sign in again.';
   if(error.response?.statusCode==403)return 'Room membership or verified subscription is required.';
   if(error.response?.statusCode==503)return 'Saved lessons are temporarily unavailable.';
   if(error.response==null)return 'Offline. Connect and retry.';
  }
  return 'Could not load saved lessons. Retry.';
 }
 Future<void> load()async{
  final current=++epoch;
  if(!active){
   if(mounted)setState((){items=const [];loading=false;message='Sign in again to view your saved lessons.';});
   return;
  }
  setState((){loading=true;message=null;items=const [];});
  try {
   final rows=await widget.client.list(widget.roomId);
   if(!mounted||current!=epoch||!active)return;
   setState((){items=rows;loading=false;});
  }catch(error){
   if(!mounted||current!=epoch)return;
   setState((){items=const [];loading=false;message=friendly(error);});
  }
 }
 Future<void> remove(SavedRoomLesson lesson)async{
  if(working||!active)return;
  final current=epoch;
  setState((){working=true;message=null;});
  try {
   await widget.client.remove(widget.roomId,lesson.id);
   if(!mounted||current!=epoch||!active)return;
   await load();
  }catch(error){
   if(mounted&&current==epoch)setState(()=>message=friendly(error));
  }finally{
   if(mounted&&current==epoch)setState(()=>working=false);
  }
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Saved lessons')),
  body:SafeArea(child:!active?
   const Center(child:Text('Sign in again to view your saved lessons.')):
   loading?const Center(child:CircularProgressIndicator()):
   Column(children:[
    if(message!=null)Padding(padding:const EdgeInsets.all(16),child:Column(children:[
     Text(message!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
     TextButton(onPressed:working?null:load,child:const Text('Retry')),
    ])),
    Expanded(child:items.isEmpty?const Center(child:Text('No saved lessons available.')):
      RefreshIndicator(onRefresh:load,child:ListView.builder(
       itemCount:items.length,itemBuilder:(context,index){
        final lesson=items[index];
        return ListTile(
         key:Key('saved-lesson-${lesson.id}'),
         title:Text(lesson.body,maxLines:3,overflow:TextOverflow.ellipsis),
         subtitle:Text(lesson.kind=='lesson'?'Lesson':'Announcement'),
         trailing:IconButton(
          tooltip:'Remove saved lesson',icon:const Icon(Icons.bookmark_remove_outlined),
          onPressed:working?null:()=>remove(lesson)),
        );
       }))),
   ])),
 );
}

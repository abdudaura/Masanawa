import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'call_history_api.dart';

String callHistoryError(Object error){
 if(error is DioException){
  if(error.response?.statusCode==401)return 'Sign in again to view your calls.';
  if(error.response?.statusCode==403)return 'You do not have access to these calls.';
  if(error.response?.statusCode==410)return 'Call history is not available yet.';
  if(error.type==DioExceptionType.connectionError ||
     error.type==DioExceptionType.connectionTimeout ||
     error.type==DioExceptionType.receiveTimeout)return 'Offline. Retry when connected.';
 }
 return 'Call history could not load. Please try again.';
}
/// Reuses J04 call initiation through onCall; never creates a second call transport.
class MasanaCallHistoryScreen extends StatefulWidget {
 const MasanaCallHistoryScreen({super.key,required this.accountKey,
  required this.reader,this.onCall});
 final String accountKey;final MasanaCallHistoryReader reader;
 final ValueChanged<String>? onCall;
 @override State<MasanaCallHistoryScreen> createState()=>_HistoryState();
}
class _HistoryState extends State<MasanaCallHistoryScreen>{
 List<MasanaCallHistoryEntry> items=[];
 String? cursor;Object? error;bool loading=true,moreLoading=false;
 int epoch=0;
 @override void initState(){super.initState();_load();}
 @override void didUpdateWidget(covariant MasanaCallHistoryScreen old){
  super.didUpdateWidget(old);
  if(old.accountKey!=widget.accountKey || !identical(old.reader,widget.reader)){
   epoch++;items=[];cursor=null;error=null;loading=true;moreLoading=false;_load();
  }
 }
 Future<void> _load({bool more=false})async{
  if(more && (cursor==null||moreLoading||loading))return;
  final n=++epoch,reader=widget.reader,account=widget.accountKey;
  if(mounted)setState((){if(more)moreLoading=true;else{loading=true;error=null;}});
  try{
   final page=await reader.load(cursor:more?cursor:null);
   if(!mounted||n!=epoch||account!=widget.accountKey||
      !identical(reader,widget.reader))return;
   setState((){
    items=more?[...items,...page.items]:page.items;
    cursor=page.nextCursor;error=null;loading=false;moreLoading=false;
   });
  }catch(e){
   if(mounted&&n==epoch&&account==widget.accountKey){
    setState((){error=e;loading=false;moreLoading=false;});
   }
  }
 }
 @override void dispose(){epoch++;super.dispose();}
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Call history')),
  body:SafeArea(child:loading&&items.isEmpty?
   const Center(child:CircularProgressIndicator()):
   error!=null&&items.isEmpty?Center(child:Column(
    mainAxisSize:MainAxisSize.min,children:[
    Text(callHistoryError(error!),textAlign:TextAlign.center),
    TextButton(onPressed:()=>_load(),child:const Text('Retry'))])):
   RefreshIndicator(onRefresh:()=>_load(),child:ListView(children:[
    if(error!=null)ListTile(title:Text(callHistoryError(error!)),
     trailing:TextButton(onPressed:()=>_load(),child:const Text('Retry'))),
    if(items.isEmpty)const Padding(padding:EdgeInsets.all(28),
      child:Center(child:Text('Your Masana calls will appear here.'))),
    for(final item in items)ListTile(
      leading:Icon(item.state=='ended'?Icons.call:Icons.call_missed),
      title:Text(item.name),
      subtitle:Text(item.state+' · '+item.createdAt.toLocal().toString().split('.').first+
       ' · '+item.durationSeconds.toString()+'s'),
      trailing:widget.onCall!=null && !{'active','connecting'}.contains(item.state)?
       IconButton(tooltip:'Call again',icon:const Icon(Icons.call),
        onPressed:()=>widget.onCall!(item.characterId)):null,
    ),
    if(cursor!=null)Center(child:TextButton(
     onPressed:moreLoading?null:()=>_load(more:true),
     child:Text(moreLoading?'Loading more…':'Load more'))),
   ]))),
 );
}

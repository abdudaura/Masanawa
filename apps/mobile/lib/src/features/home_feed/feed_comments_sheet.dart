import 'package:flutter/material.dart';
import 'feed_api.dart';

/// C22 comment thread and original fan reply composer. The server decides visibility.
class FeedCommentsSheet extends StatefulWidget {
  const FeedCommentsSheet({super.key,required this.api,required this.post});
  final FeedApi api;
  final FeedPost post;
  @override State<FeedCommentsSheet> createState()=>_FeedCommentsSheetState();
}
class _FeedCommentsSheetState extends State<FeedCommentsSheet> {
  final controller=TextEditingController();
  List<FeedComment> comments=[];
  String? error,pendingBody,pendingKey;
  bool loading=true,sending=false;
  @override void initState(){super.initState();load();}
  @override void dispose(){controller.dispose();super.dispose();}
  String tr(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  Future<void> load()async{
    try{
      final result=await widget.api.comments(widget.post.id);
      if(mounted)setState((){comments=result;loading=false;error=null;});
    }catch(_){if(mounted)setState((){loading=false;error=tr('Unable to load comments','Ba a samu sharhi ba');});}
  }
  Future<void> send()async{
    if(sending)return;
    final body=controller.text.trim();
    if(body.isEmpty||body.length>1000)return;
    final key=pendingBody==body&&pendingKey!=null?pendingKey!:'feed-${DateTime.now().microsecondsSinceEpoch}';
    setState((){sending=true;pendingBody=body;pendingKey=key;error=null;});
    try{
      await widget.api.comment(widget.post.id,body,key);
      if(!mounted)return;
      controller.clear();pendingBody=null;pendingKey=null;
      await load();
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(tr('Sent. New-member comments may await moderation.','An aika. Ana iya duba sharhin sabbin mambobi.'))));
    }catch(_){if(mounted)setState(()=>error=tr('Could not send. Retry keeps the same request.','An kasa aikawa. Sake gwadawa ba zai maimaita ba.'));}
    finally{if(mounted)setState(()=>sending=false);}
  }
  @override Widget build(BuildContext context)=>SafeArea(child:Padding(padding:const EdgeInsets.all(12),child:Column(children:[
    Text(tr('Comments','Sharhi'),style:Theme.of(context).textTheme.titleLarge),
    if(error!=null)MaterialBanner(content:Text(error!),actions:[TextButton(onPressed:load,child:Text(tr('Retry','Sake gwadawa')))]),
    Expanded(child:loading?const Center(child:CircularProgressIndicator()):
      comments.isEmpty?Center(child:Text(tr('No comments yet','Babu sharhi tukuna'))):
      RefreshIndicator(onRefresh:load,child:ListView.builder(itemCount:comments.length,itemBuilder:(ctx,i){
        final comment=comments[i];
        return ListTile(title:Text(comment.body),subtitle:comment.state=='pending'?
          Text(tr('Awaiting review','Ana jiran dubawa')):null);
      }))),
    Row(children:[
      Expanded(child:TextField(controller:controller,maxLength:1000,maxLines:1,
        decoration:InputDecoration(hintText:tr('Add a comment','Rubuta sharhi')))),
      IconButton(tooltip:tr('Send','Aika'),onPressed:sending?null:send,icon:const Icon(Icons.send))
    ])
  ])));
}

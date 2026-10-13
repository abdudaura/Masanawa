import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'feed_api.dart';

/// C22 uses the canonical published-post projection and moderated comment journal.
/// AF00 owns root/deep-link registration. This screen never exposes fan publishing.
class FeedPostDetailScreen extends StatefulWidget {
  const FeedPostDetailScreen({super.key,required this.initialPost,
    required this.accountKey,required this.loadPost,required this.loadThread,
    required this.sendComment,this.onMasanaProfile,this.onMedia,this.onReport,
    this.enabled=true,this.canReply=true});
  final FeedPost initialPost;
  final String accountKey;
  final Future<FeedPost> Function(String) loadPost;
  final Future<List<FeedComment>> Function(String,String) loadThread;
  final Future<void> Function(String,String,String,String?) sendComment;
  final ValueChanged<String>? onMasanaProfile,onMedia,onReport;
  final bool enabled,canReply;
  @override State<FeedPostDetailScreen> createState()=>_FeedPostDetailState();
}
class _FeedPostDetailState extends State<FeedPostDetailScreen> {
  final input=TextEditingController();
  FeedPost? post;
  List<FeedComment> comments=[];
  String? error,replyTo,pendingBody,pendingKey,pendingParent;
  String sort='newest';
  bool loading=true,sending=false,offline=false,denied=false;
  int generation=0;
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){super.initState();post=widget.initialPost;
    WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});}
  @override void didUpdateWidget(covariant FeedPostDetailScreen old){
    super.didUpdateWidget(old);
    if(old.accountKey!=widget.accountKey||old.initialPost.id!=widget.initialPost.id){
      generation++;post=null;comments=[];error=null;replyTo=null;
      pendingBody=null;pendingKey=null;pendingParent=null;sending=false;input.clear();refresh();
    }else if(!old.enabled&&widget.enabled){refresh();}
  }
  @override void dispose(){generation++;input.dispose();super.dispose();}
  Future<void> refresh() async {
    if(!widget.enabled)return;
    final ticket=++generation;
    setState((){loading=true;error=null;denied=false;});
    try {
      final p=await widget.loadPost(widget.initialPost.id);
      final thread=await widget.loadThread(p.id,sort);
      if(!mounted||ticket!=generation)return;
      setState((){post=p;comments=thread;loading=false;offline=false;});
    }on DioException catch(e){
      if(!mounted||ticket!=generation)return;
      setState((){loading=false;denied=e.response?.statusCode==401||
        e.response?.statusCode==403||e.response?.statusCode==404;
        offline=e.type==DioExceptionType.connectionTimeout||
          e.type==DioExceptionType.connectionError;
        error=denied?t('Not permitted or post unavailable','Ba a da izini ko babu labarin'):
          t('Unable to load post','An kasa dauko labarin');});
    }catch(_){
      if(mounted&&ticket==generation)setState((){
        loading=false;error=t('Unable to load post','An kasa dauko labarin');});
    }
  }
  Future<void> submit() async {
    if(sending||post==null||!widget.enabled)return;
    final body=input.text.trim();
    if(body.isEmpty||body.length>1000)return;
    final key=pendingBody==body&&pendingParent==replyTo&&pendingKey!=null?pendingKey!:
      'c22-'+DateTime.now().microsecondsSinceEpoch.toString();
    final ticket=generation,parent=replyTo,account=widget.accountKey;
    setState((){sending=true;pendingBody=body;pendingParent=parent;pendingKey=key;error=null;});
    try{
      await widget.sendComment(post!.id,body,key,parent);
      if(!mounted||ticket!=generation)return;
      input.clear();pendingBody=null;pendingParent=null;pendingKey=null;replyTo=null;
      setState(()=>sending=false);
      await refresh();
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:
        Text(t('Sent. Review may be required.','An aika. Ana iya duba sharhin.'))));
    }on DioException catch(e){
      if(!mounted||ticket!=generation)return;
      setState(()=>error=e.response?.statusCode==401||e.response?.statusCode==403?
        t('Sign in to comment','Shiga domin yin sharhi'):
        t('Could not send. Retry keeps the same request.','An kasa aikawa. Sake gwadawa ba zai maimaita ba.'));
    }catch(_){
      if(mounted&&ticket==generation)setState(()=>error=
        t('Could not send. Retry keeps the same request.','An kasa aikawa. Sake gwadawa ba zai maimaita ba.'));
    }finally{if(mounted&&account==widget.accountKey)setState(()=>sending=false);}
  }
  Widget commentRow(FeedComment c){
    final reply=c.parentId!=null;
    return Padding(padding:EdgeInsetsDirectional.only(start:reply?24:0),child:
      ListTile(dense:true,leading:Icon(reply?Icons.subdirectory_arrow_right:Icons.chat_bubble_outline,size:18),
        title:Text(c.body),subtitle:c.state=='pending'?Text(t('Awaiting review','Ana jiran dubawa')):null,
        trailing:!reply&&c.state=='visible'&&widget.canReply?
          TextButton(onPressed:()=>setState(()=>replyTo=c.id),
            child:Text(t('Reply','Amsa'))):null));
  }
  @override Widget build(BuildContext context){
    if(!widget.enabled)return Scaffold(appBar:AppBar(title:Text(t('Post','Labari'))),
      body:Center(child:Text(t('This feature is unavailable','Ba a samun wannan aikin'))));
    final p=post;
    return Scaffold(appBar:AppBar(title:Text(t('Post','Labari'))),
      body:SafeArea(child:Column(children:[
        if(loading)const LinearProgressIndicator(),
        if(offline)MaterialBanner(content:Text(t('Offline — showing last loaded content','Babu intanet — ana nuna abin da aka samu')),
          actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
        if(error!=null)MaterialBanner(content:Text(error!),
          actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
        if(denied||p==null)
          Expanded(child:Center(child:Text(t('Post not available','Babu labarin'))))
        else Expanded(child:RefreshIndicator(onRefresh:refresh,child:ListView(children:[
          Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            TextButton.icon(onPressed:widget.onMasanaProfile==null?null:
              ()=>widget.onMasanaProfile!(p.authorMasanaId),icon:const Icon(Icons.verified_outlined),
              label:Text(p.authorName??p.authorMasanaId)),
            Text(p.body,style:Theme.of(context).textTheme.bodyLarge),
            for(final media in p.mediaIds)ListTile(leading:Icon(p.kind=='audio'?
              Icons.play_circle_outline:Icons.image_outlined),
              title:Text(p.kind=='audio'?t('Play audio','Kunna sauti'):t('View image','Duba hoto')),
              onTap:widget.onMedia==null?null:()=>widget.onMedia!(media)),
            Row(children:[
              Text(t('Comments','Sharhi')+' ('+p.commentCount.toString()+')'),
              const Spacer(),
              IconButton(tooltip:t('Report','Kai rahoto'),onPressed:widget.onReport==null?null:
                ()=>widget.onReport!(p.id),icon:const Icon(Icons.flag_outlined))
            ]),
            Row(children:[
              ChoiceChip(label:Text(t('Newest','Sabbi')),selected:sort=='newest',
                onSelected:(_){setState(()=>sort='newest');refresh();}),
              const SizedBox(width:8),
              ChoiceChip(label:Text(t('Oldest','Tsofaffi')),selected:sort=='oldest',
                onSelected:(_){setState(()=>sort='oldest');refresh();}),
            ]),
            if(comments.isEmpty&&!loading)Text(t('No comments yet','Babu sharhi tukuna')),
            for(final c in comments)commentRow(c)
          ]))
        ]))),
        if(!denied&&p!=null)Padding(padding:const EdgeInsets.all(8),child:Column(children:[
          if(replyTo!=null)Row(children:[Expanded(child:Text(t('Replying to comment','Amsa ga sharhi'))),
            IconButton(tooltip:t('Cancel reply','Soke amsa'),
              onPressed:()=>setState(()=>replyTo=null),icon:const Icon(Icons.close))]),
          Row(children:[
            Expanded(child:TextField(controller:input,maxLength:1000,minLines:1,maxLines:3,
              enabled:!sending,decoration:InputDecoration(
                hintText:t('Write a comment','Rubuta sharhi')))),
            IconButton(tooltip:t('Send','Aika'),onPressed:sending?null:submit,
              icon:sending?const SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2)):
                const Icon(Icons.send)),
          ])
        ])),
      ])));
  }
}

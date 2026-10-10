import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'feed_api.dart';
import 'feed_comments_sheet.dart';

/// Feature-local C21 screen. AF00 wires this in the sole Home center shell.
class MasanaFeedScreen extends StatefulWidget {
  const MasanaFeedScreen({super.key,required this.api,required this.accountKey,
    this.onMasanaProfile,this.onOpenMedia,this.onReport,this.enabled=true});
  final FeedApi api;
  final String accountKey;
  final ValueChanged<String>? onMasanaProfile;
  final ValueChanged<String>? onOpenMedia;
  final ValueChanged<String>? onReport;
  final bool enabled;
  @override State<MasanaFeedScreen> createState()=>_MasanaFeedScreenState();
}
class _MasanaFeedScreenState extends State<MasanaFeedScreen> {
  String mode='for_you';
  List<FeedPost> items=[];
  String? cursor,error;
  bool loading=false,fetchingMore=false,offline=false;
  int generation=0;
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){super.initState();WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});}
  @override void didUpdateWidget(covariant MasanaFeedScreen old) {
    super.didUpdateWidget(old);
    if(old.accountKey!=widget.accountKey||old.api!=widget.api){generation++;items=[];cursor=null;error=null;offline=false;refresh();}
    if(!old.enabled&&widget.enabled)refresh();
  }
  Future<void> refresh() async {
    if(!widget.enabled)return;
    final ticket=++generation;
    setState((){loading=true;error=null;});
    try{
      final page=await widget.api.list(mode:mode);
      if(!mounted||ticket!=generation)return;
      setState((){items=page.items;cursor=page.nextCursor;offline=false;loading=false;});
    }catch(e){
      if(!mounted||ticket!=generation)return;
      setState((){error=e.toString();offline=e is DioException&&(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout);loading=false;});
    }
  }
  Future<void> nextPage() async {
    if(fetchingMore||cursor==null||loading)return;
    final ticket=generation,after=cursor;
    setState(()=>fetchingMore=true);
    try{
      final page=await widget.api.list(mode:mode,cursor:after);
      if(!mounted||ticket!=generation)return;
      setState((){
        final seen=items.map((p)=>p.id).toSet();
        items=[...items,...page.items.where((p)=>seen.add(p.id))];
        cursor=page.nextCursor;fetchingMore=false;
      });
    }catch(_){if(mounted&&ticket==generation)setState(()=>fetchingMore=false);}
  }
  Future<void> action(FeedPost p,{required bool like}) async {
    final index=items.indexWhere((row)=>row.id==p.id);
    if(index<0)return;
    final enabled=like?!p.liked:!p.saved,scope=generation;
    setState(()=>items[index]=like?p.withAction(liked:enabled):p.withAction(saved:enabled));
    try{
      if(like){await widget.api.like(p.id,enabled);}else{await widget.api.save(p.id,enabled);}
    }catch(_){
      if(!mounted||scope!=generation)return;
      final now=items.indexWhere((row)=>row.id==p.id);
      if(now>=0)setState(()=>items[now]=p);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(t('Action failed. Retry.','Ba a yi nasara ba. Sake gwadawa.'))));
    }
  }
  void openComments(FeedPost post) {
    showModalBottomSheet<void>(context:context,isScrollControlled:true,
      builder:(ctx)=>SizedBox(height:MediaQuery.sizeOf(ctx).height*0.78,
        child:FeedCommentsSheet(api:widget.api,post:post)));
  }
  @override Widget build(BuildContext context){
    if(!widget.enabled)return Center(child:Text(t('Feed is currently unavailable','Ba a samun labarai a yanzu')));
    return Column(children:[
      Row(children:[
        Expanded(child:ChoiceChip(label:Text(t('For You','Domin Kai')),selected:mode=='for_you',onSelected:(_){setState((){mode='for_you';items=[];cursor=null;});refresh();})),
        const SizedBox(width:8),
        Expanded(child:ChoiceChip(label:Text(t('Following','Wadanda nake bi')),selected:mode=='following',onSelected:(_){setState((){mode='following';items=[];cursor=null;});refresh();})),
      ]),
      if(offline)MaterialBanner(content:Text(t('Offline — showing cached posts','Ba intanet — ana nuna bayanan baya')),actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      if(error!=null&&!offline)MaterialBanner(content:Text(t('Could not load posts','An kasa dauko labarai')),actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      Expanded(child:loading&&items.isEmpty
        ?const Center(child:CircularProgressIndicator())
        :items.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          const Icon(Icons.article_outlined,size:48),
          Text(t('No posts yet','Babu labarai tukuna')),
          TextButton(onPressed:refresh,child:Text(t('Refresh','Sabunta')))]))
        :RefreshIndicator(onRefresh:refresh,child:ListView.builder(
          itemCount:items.length+(cursor==null?0:1),
          itemBuilder:(ctx,i){
            if(i==items.length)return Center(child:TextButton(onPressed:fetchingMore?null:nextPage,child:Text(t('Load more','Kara nunawa'))));
            final post=items[i];
            return Card(key:ValueKey(post.id),margin:const EdgeInsets.symmetric(vertical:5,horizontal:8),
              child:Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
                TextButton.icon(onPressed:widget.onMasanaProfile==null?null:()=>widget.onMasanaProfile!(post.authorMasanaId),
                  icon:const Icon(Icons.verified_outlined),label:Text(post.authorName??post.authorMasanaId)),
                if(post.body.isNotEmpty)Text(post.body,style:Theme.of(context).textTheme.bodyLarge),
                if(post.mediaIds.isNotEmpty)Wrap(spacing:8,children:post.mediaIds.map((id)=>ActionChip(
                  avatar:Icon(post.kind=='audio'?Icons.play_circle_outline:Icons.image_outlined),
                  label:Text(post.kind=='audio'?t('Play audio','Kunna sauti'):t('View image','Duba hoto')),
                  onPressed:widget.onOpenMedia==null?null:()=>widget.onOpenMedia!(id))).toList()),
                Wrap(spacing:4,children:[
                  TextButton.icon(onPressed:()=>action(post,like:true),icon:Icon(post.liked?Icons.favorite:Icons.favorite_border),
                    label:Text('${post.likeCount}')),
                  TextButton.icon(onPressed:()=>openComments(post),icon:const Icon(Icons.mode_comment_outlined),label:Text('${post.commentCount}')),
                  IconButton(tooltip:t('Save','Ajiye'),onPressed:()=>action(post,like:false),
                    icon:Icon(post.saved?Icons.bookmark:Icons.bookmark_border)),
                  IconButton(tooltip:t('Report','Kai rahoto'),onPressed:widget.onReport==null?null:()=>widget.onReport!(post.id),
                    icon:const Icon(Icons.flag_outlined))
                ])
              ])));
          })))
    ]);
  }
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'feed_api.dart';
import 'feed_comments_sheet.dart';
import 'feed_post_detail_screen.dart';

/// Masana-only Status feed. The coordinating shell supplies account-owned API and identity.
class MasanaFeedScreen extends StatefulWidget {
  const MasanaFeedScreen({super.key,required this.api,required this.accountKey,
    this.onMasanaProfile,this.onOpenMedia,this.onReport,this.enabled=true});
  final FeedApi api;
  final String accountKey;
  final ValueChanged<String>? onMasanaProfile;
  final void Function(FeedPost post, String mediaId)? onOpenMedia;
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
  final Set<String> pendingActions={};
  String? pageError;
  void clearProjection() {
    generation++;items=[];cursor=null;error=null;pageError=null;offline=false;
    loading=false;fetchingMore=false;pendingActions.clear();
  }
  bool accessLost(Object e) {
    if(e is! DioException)return false;
    final status=e.response?.statusCode,data=e.response?.data;
    return status==401||status==403||status==410||
      (data is Map&&data['code']=='feature_disabled');
  }
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){super.initState();WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});}
  @override void didUpdateWidget(covariant MasanaFeedScreen old) {
    super.didUpdateWidget(old);
    if(old.accountKey!=widget.accountKey||old.api!=widget.api||old.enabled!=widget.enabled){
      clearProjection();
      if(widget.enabled)refresh();
    }
  }
  Future<void> refresh() async {
    if(!widget.enabled)return;
    final ticket=++generation;
    setState((){loading=true;fetchingMore=false;error=null;pageError=null;pendingActions.clear();});
    try{
      final page=await widget.api.list(mode:mode);
      if(!mounted||ticket!=generation)return;
      setState((){items=page.items;cursor=page.nextCursor;offline=false;loading=false;});
    }catch(e){
      if(!mounted||ticket!=generation)return;
      setState((){if(accessLost(e)){items=[];cursor=null;}error=e.toString();offline=e is DioException&&(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout);loading=false;});
    }
  }
  Future<void> nextPage() async {
    if(!widget.enabled||fetchingMore||cursor==null||loading)return;
    final ticket=generation,after=cursor;
    setState((){fetchingMore=true;pageError=null;});
    try{
      final page=await widget.api.list(mode:mode,cursor:after);
      if(!mounted||ticket!=generation)return;
      setState((){
        final seen=items.map((p)=>p.id).toSet();
        items=[...items,...page.items.where((p)=>seen.add(p.id))];
        cursor=page.nextCursor;fetchingMore=false;
      });
    }catch(e){if(mounted&&ticket==generation)setState((){
      if(accessLost(e)){items=[];cursor=null;error=e.toString();}
      fetchingMore=false;pageError=e.toString();
    });}
  }
  Future<void> action(FeedPost p,{required bool like}) async {
    final index=items.indexWhere((row)=>row.id==p.id);
    if(!widget.enabled||index<0||pendingActions.contains(p.id))return;
    final enabled=like?!p.liked:!p.saved,scope=generation;
    setState((){pendingActions.add(p.id);items[index]=like?p.withAction(liked:enabled):p.withAction(saved:enabled);});
    try{
      if(like){await widget.api.like(p.id,enabled);}else{await widget.api.save(p.id,enabled);}
    }catch(e){
      if(!mounted||scope!=generation)return;
      if(accessLost(e)){setState((){clearProjection();error=e.toString();});return;}
      final now=items.indexWhere((row)=>row.id==p.id);
      if(now>=0)setState(()=>items[now]=p);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(t('Action failed. Retry.','Ba a yi nasara ba. Sake gwadawa.'))));
    }finally{
      if(mounted&&scope==generation)setState(()=>pendingActions.remove(p.id));
    }
  }
  void openPost(FeedPost post) {
    final feed=widget.api,account=widget.accountKey;
    Navigator.of(context).push(MaterialPageRoute<void>(builder:(_)=>FeedPostDetailScreen(
      initialPost:post,accountKey:account,
      loadPost:(id)=>feed is DioFeedApi?feed.detail(id):Future.value(post),
      loadThread:(id,sort)=>feed is DioFeedApi?feed.thread(id,sort):feed.comments(id),
      sendComment:(id,body,key,parent) async {
        if(feed is DioFeedApi){await feed.sendThreadComment(id,body,key,parent);}
        else if(parent==null){await feed.comment(id,body,key);}
        else {throw StateError('Reply transport unavailable');}
      },
      canReply:feed is DioFeedApi,
      onMasanaProfile:widget.onMasanaProfile,onMedia:widget.onOpenMedia==null?null:(id)=>widget.onOpenMedia!(post,id),onReport:widget.onReport,
      enabled:widget.enabled,
    )));
  }
  void openComments(FeedPost post) {
    showModalBottomSheet<void>(context:context,isScrollControlled:true,
      builder:(ctx)=>SizedBox(height:MediaQuery.sizeOf(ctx).height*0.78,
        child:FeedCommentsSheet(api:widget.api,post:post)));
  }
  @override Widget build(BuildContext context){
    if(!widget.enabled)return Center(child:Text(t('Status is currently unavailable','Ba a samun labarai a yanzu')));
    return Column(children:[
      Row(children:[
        Expanded(child:ChoiceChip(label:Text(t('For You','Domin Kai')),selected:mode=='for_you',onSelected:(_){setState((){mode='for_you';items=[];cursor=null;});refresh();})),
        const SizedBox(width:8),
        Expanded(child:ChoiceChip(label:Text(t('Following','Wadanda nake bi')),selected:mode=='following',onSelected:(_){setState((){mode='following';items=[];cursor=null;});refresh();})),
      ]),
      if(pageError!=null&&items.isNotEmpty)MaterialBanner(content:Text(t('Could not load more updates','An kasa dauko karin labarai')),actions:[TextButton(onPressed:nextPage,child:Text(t('Retry','Sake gwadawa')))]),
      if(offline)MaterialBanner(content:Text(t('Offline — showing previous updates','Ba intanet — ana nuna bayanan baya')),actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      if(error!=null&&!offline)MaterialBanner(content:Text(t('Could not load updates','An kasa dauko labarai')),actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      Expanded(child:loading&&items.isEmpty
        ?const Center(child:CircularProgressIndicator())
        :items.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          const Icon(Icons.article_outlined,size:48),
          Text(t('No Status updates yet','Babu labarai tukuna')),
          TextButton(onPressed:refresh,child:Text(t('Refresh','Sabunta')))]))
        :RefreshIndicator(onRefresh:refresh,child:ListView.builder(
          physics:const AlwaysScrollableScrollPhysics(),
          itemCount:items.length+(cursor==null?0:1),
          itemBuilder:(ctx,i){
            if(i==items.length)return Center(child:TextButton(onPressed:fetchingMore?null:nextPage,child:Text(t('Load more','Kara nunawa'))));
            final post=items[i];
            return Card(key:ValueKey(post.id),margin:const EdgeInsets.symmetric(vertical:5,horizontal:8),
              child:Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
                TextButton.icon(onPressed:widget.onMasanaProfile==null?null:()=>widget.onMasanaProfile!(post.authorMasanaId),
                  icon:const Icon(Icons.verified_outlined),label:Text(post.authorName??post.authorMasanaId)),
                if(post.body.isNotEmpty)Text(post.body,style:Theme.of(context).textTheme.bodyLarge),
                Align(alignment:AlignmentDirectional.centerStart,
                  child:TextButton(onPressed:()=>openPost(post),
                    child:Text(t('Open post','Bude labari')))),
                if(post.mediaIds.isNotEmpty)Wrap(spacing:8,children:post.mediaIds.map((id)=>ActionChip(
                  avatar:Icon(post.kind=='audio'?Icons.play_circle_outline:Icons.image_outlined),
                  label:Text(post.kind=='audio'?t('Play audio','Kunna sauti'):t('View image','Duba hoto')),
                  onPressed:widget.onOpenMedia==null?null:()=>widget.onOpenMedia!(post,id))).toList()),
                Wrap(spacing:4,children:[
                  TextButton.icon(onPressed:pendingActions.contains(post.id)?null:()=>action(post,like:true),icon:Icon(post.liked?Icons.favorite:Icons.favorite_border),
                    label:Text('${post.likeCount}')),
                  TextButton.icon(onPressed:()=>openComments(post),icon:const Icon(Icons.mode_comment_outlined),label:Text('${post.commentCount}')),
                  IconButton(tooltip:t('Save','Ajiye'),onPressed:pendingActions.contains(post.id)?null:()=>action(post,like:false),
                    icon:Icon(post.saved?Icons.bookmark:Icons.bookmark_border)),
                  IconButton(tooltip:t('Report','Kai rahoto'),onPressed:widget.onReport==null?null:()=>widget.onReport!(post.id),
                    icon:const Icon(Icons.flag_outlined))
                ])
              ])));
          })))
    ]);
  }
}


import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'saved_api.dart';

/// C25: fan-private saved Masana posts and approved provider videos.
/// AF00 wires this through Account/Saved, never as a sixth root tab.
class MasanaSavedScreen extends StatefulWidget {
  const MasanaSavedScreen({super.key,required this.api,required this.accountKey,
    this.onOpenPost,this.onOpenVideo,this.onOpenMasana,this.enabled=true});
  final SavedLibraryApi api;
  final String accountKey;
  final ValueChanged<String>? onOpenPost;
  final ValueChanged<Uri>? onOpenVideo;
  final ValueChanged<String>? onOpenMasana;
  final bool enabled;
  @override State<MasanaSavedScreen> createState()=>_MasanaSavedScreenState();
}

class _MasanaSavedScreenState extends State<MasanaSavedScreen> {
  List<SavedEntry> items=[];
  String? cursor,error;
  bool loading=false,more=false,offline=false,permissionDenied=false;
  final Set<String> working={};
  int generation=0;
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});
  }
  @override void didUpdateWidget(covariant MasanaSavedScreen oldWidget){
    super.didUpdateWidget(oldWidget);
    if(oldWidget.accountKey!=widget.accountKey||oldWidget.api!=widget.api){
      generation++;
      items=[];cursor=null;error=null;offline=false;permissionDenied=false;more=false;working.clear();
      WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});
    }else if(!oldWidget.enabled&&widget.enabled){
      WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});
    }
  }
  Future<void> refresh() async {
    if(!widget.enabled||widget.accountKey.isEmpty)return;
    final ticket=++generation;
    setState((){loading=true;error=null;permissionDenied=false;});
    try{
      final page=await widget.api.list();
      if(!mounted||ticket!=generation)return;
      setState((){items=page.items;cursor=page.nextCursor;loading=false;offline=false;});
    }catch(e){
      if(!mounted||ticket!=generation)return;
      final denied=e is DioException&&(e.response?.statusCode==401||e.response?.statusCode==403);
      final unavailable=e is DioException&&(e.type==DioExceptionType.connectionError||
        e.type==DioExceptionType.connectionTimeout||e.type==DioExceptionType.receiveTimeout);
      setState((){loading=false;permissionDenied=denied;offline=unavailable;
        error=e.toString();if(denied) {items=[];cursor=null;}});
    }
  }
  Future<void> nextPage() async {
    if(more||loading||cursor==null)return;
    final ticket=generation,after=cursor;
    setState(()=>more=true);
    try {
      final page=await widget.api.list(cursor:after);
      if(!mounted||ticket!=generation)return;
      setState((){
        final seen=items.map((x)=>x.kind+':'+x.id).toSet();
        items=[...items,...page.items.where((x)=>seen.add(x.kind+':'+x.id))];
        cursor=page.nextCursor;more=false;
      });
    }catch(_){if(mounted&&ticket==generation)setState(()=>more=false);}
  }
  Future<void> unsave(SavedEntry item) async {
    final key=item.kind+':'+item.id;
    if(working.contains(key))return;
    final ticket=generation;
    setState(()=>working.add(key));
    try {
      await widget.api.unsave(item);
      if(!mounted||ticket!=generation)return;
      setState((){items=items.where((x)=>x.kind+':'+x.id!=key).toList();working.remove(key);});
    }catch(_){
      if(!mounted||ticket!=generation)return;
      setState(()=>working.remove(key));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:Text(t('Could not remove saved item. Retry.','An kasa cire abin da aka ajiye. Sake gwadawa.'))));
    }
  }
  @override Widget build(BuildContext context) {
    if(!widget.enabled)return Center(child:Text(t('Saved is unavailable','Ba a samun ajiyayyu yanzu')));
    if(permissionDenied)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
      Text(t('Sign in to see saved items','Shiga domin ganin abubuwan da aka ajiye')),
      TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]));
    return Column(children:[
      if(offline)MaterialBanner(content:Text(t('Offline — showing previously loaded items',
        'Ba intanet — ana nuna abubuwan da aka riga aka dauko')),
        actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      if(error!=null&&!offline)MaterialBanner(
        content:Text(t('Could not refresh saved items','An kasa sabunta ajiyayyu')),
        actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      Expanded(child:loading&&items.isEmpty
        ?const Center(child:CircularProgressIndicator())
        :items.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          const Icon(Icons.bookmark_border,size:48),
          Text(t('Nothing saved yet','Ba a ajiye komai ba')),
          TextButton(onPressed:refresh,child:Text(t('Refresh','Sabunta')))]))
        :RefreshIndicator(onRefresh:refresh,child:ListView.builder(
          itemCount:items.length+(cursor==null?0:1),
          itemBuilder:(context,i){
            if(i==items.length)return Center(child:TextButton(
              onPressed:more?null:nextPage,child:Text(t('Load more','Kara nunawa'))));
            final item=items[i],post=item.post,video=item.video;
            final key=item.kind+':'+item.id;
            return Card(key:ValueKey(key),child:Padding(
              padding:const EdgeInsets.symmetric(horizontal:12,vertical:8),
              child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
                if(post!=null)TextButton.icon(
                  onPressed:widget.onOpenMasana==null?null:()=>widget.onOpenMasana!(post.authorMasanaId),
                  icon:const Icon(Icons.person_outline),
                  label:Text(post.authorName??post.authorMasanaId)),
                if(video!=null)Text(video.channelName,style:Theme.of(context).textTheme.labelMedium),
                Text(post?.body??video?.title??'',
                  maxLines:5,overflow:TextOverflow.ellipsis),
                Row(children:[
                  TextButton.icon(
                    onPressed:post!=null&&widget.onOpenPost!=null
                      ?()=>widget.onOpenPost!(item.id)
                      :video!=null&&widget.onOpenVideo!=null
                        ?()=>widget.onOpenVideo!(video.sourceUrl):null,
                    icon:Icon(video!=null?Icons.play_circle_outline:Icons.open_in_new),
                    label:Text(video!=null?t('Watch at source','Kalla a tushe'):t('Open post','Bude rubutu'))),
                  const Spacer(),
                  IconButton(tooltip:t('Remove saved item','Cire ajiyayye'),
                    onPressed:working.contains(key)?null:()=>unsave(item),
                    icon:working.contains(key)
                      ?const SizedBox(width:18,height:18,child:CircularProgressIndicator(strokeWidth:2))
                      :const Icon(Icons.bookmark_remove_outlined))
                ])
              ])));
          })))
    ]);
  }
}

/// Add to C27 provider cards through L-VIDEO coordination. No new video player.
class SavedVideoToggle extends StatefulWidget {
  const SavedVideoToggle({super.key,required this.api,required this.accountKey,required this.videoId,
    required this.initiallySaved});
  final SavedLibraryApi api;
  final String accountKey,videoId;
  final bool initiallySaved;
  @override State<SavedVideoToggle> createState()=>_SavedVideoToggleState();
}
class _SavedVideoToggleState extends State<SavedVideoToggle> {
  late bool saved;
  bool busy=false;
  int generation=0;
  @override void initState(){super.initState();saved=widget.initiallySaved;}
  @override void didUpdateWidget(covariant SavedVideoToggle old){
    super.didUpdateWidget(old);
    if(old.videoId!=widget.videoId||old.api!=widget.api||old.accountKey!=widget.accountKey){
      generation++;saved=widget.initiallySaved;busy=false;
    }
  }
  @override Widget build(BuildContext context)=>IconButton(
    tooltip:saved?'Remove saved video':'Save video',
    icon:Icon(saved?Icons.bookmark:Icons.bookmark_border),
    onPressed:busy?null:()async {
      final next=!saved,ticket=generation;
      setState(()=>busy=true);
      try {await widget.api.saveVideo(widget.videoId,next);
        if(mounted&&ticket==generation)setState(()=>saved=next);
      }catch(_){if(mounted&&ticket==generation)ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content:Text('Could not update saved video. Retry.')));}
      finally {if(mounted&&ticket==generation)setState(()=>busy=false);}
    });
}

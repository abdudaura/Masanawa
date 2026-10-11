import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'following_repository.dart';

/// C46: private Following management; AF00 supplies navigation and auth-aware Dio.
class MasanaFollowingScreen extends StatefulWidget {
  const MasanaFollowingScreen({super.key,required this.repository,required this.accountKey,
    required this.openProfile,this.openDiscovery});
  final FollowingRepository repository;
  final String accountKey;
  final ValueChanged<String> openProfile;
  final VoidCallback? openDiscovery;
  @override State<MasanaFollowingScreen> createState()=>_MasanaFollowingState();
}
class _MasanaFollowingState extends State<MasanaFollowingScreen> {
  final query=TextEditingController();
  List<FollowedMasana> people=[];
  String language='',error='';
  String? cursor;
  bool loading=false,paging=false,offline=false,denied=false,disabled=false;
  int epoch=0;
  final busy=<String>{};
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){super.initState();WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)refresh();});}
  @override void didUpdateWidget(covariant MasanaFollowingScreen old){
    super.didUpdateWidget(old);
    if(old.accountKey!=widget.accountKey||old.repository!=widget.repository){
      epoch++;people=[];cursor=null;error='';offline=false;denied=false;
      disabled=false;busy.clear();query.clear();language='';refresh();
    }
  }
  @override void dispose(){epoch++;query.dispose();super.dispose();}
  Future<void> refresh() async {
    final stamp=++epoch;
    setState((){loading=true;error='';denied=false;disabled=false;});
    try{
      final page=await widget.repository.list(q:query.text.trim(),language:language);
      if(!mounted||stamp!=epoch)return;
      setState((){people=page.items;cursor=page.nextCursor;loading=false;offline=false;});
    }catch(e){
      if(!mounted||stamp!=epoch)return;
      final status=e is DioException?e.response?.statusCode:null;
      setState((){loading=false;denied=status==401||status==403;disabled=status==410;
        // Authorization loss is never an offline-cache exception. Clear private
        // fan data before the next frame instead of displaying stale records.
        if(denied||disabled){people=[];cursor=null;busy.clear();offline=false;}
        else {offline=people.isNotEmpty;}
        error=denied?t('Please sign in again.','Sake shiga.')
          :disabled?t('Following unavailable.','Ba a samun wadanda ake bi.')
          :t('Could not load Following. Retry.','An kasa dauko jerin bi. Sake gwadawa.');});
    }
  }
  Future<void> more() async {
    if(loading||paging||cursor==null||offline)return;
    final stamp=epoch,after=cursor;
    setState(()=>paging=true);
    try{
      final page=await widget.repository.list(q:query.text.trim(),language:language,cursor:after);
      if(!mounted||stamp!=epoch)return;
      setState((){
        final seen=people.map((p)=>p.id).toSet();
        people=[...people,...page.items.where((p)=>seen.add(p.id))];
        cursor=page.nextCursor;paging=false;
      });
    }catch(_){if(mounted&&stamp==epoch)setState((){paging=false;
      offline=true;error=t('Retry to load more.','Sake gwadawa.');});}
  }
  Future<void> mute(FollowedMasana item) async {
    if(offline||denied||disabled||busy.contains(item.id))return;
    final stamp=epoch;setState(()=>busy.add(item.id));
    try{
      final value=await widget.repository.setMute(item.id,!item.muted);
      if(!mounted||stamp!=epoch)return;
      setState((){
        final i=people.indexWhere((p)=>p.id==item.id);
        if(i>=0)people[i]=people[i].withMute(value);
      });
    }catch(_){if(mounted&&stamp==epoch)setState(()=>
      error=t('Mute failed. Retry.','An kasa yin shiru. Sake gwadawa.'));}
    finally{if(mounted&&stamp==epoch)setState(()=>busy.remove(item.id));}
  }
  Future<void> unfollow(FollowedMasana item) async {
    if(offline||denied||disabled||busy.contains(item.id))return;
    final yes=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(t('Unfollow Masana?','Daina bin Masana?')),content:Text(item.name),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:Text(t('Cancel','Soke'))),
        TextButton(onPressed:()=>Navigator.pop(ctx,true),child:Text(t('Unfollow','Daina bi')))]));
    if(yes!=true||!mounted)return;
    final stamp=epoch;setState(()=>busy.add(item.id));
    try{
      await widget.repository.unfollow(item.id);
      if(mounted&&stamp==epoch)setState(()=>people.removeWhere((p)=>p.id==item.id));
    }catch(_){if(mounted&&stamp==epoch)setState(()=>
      error=t('Unfollow failed. Retry.','An kasa daina bi. Sake gwadawa.'));}
    finally{if(mounted&&stamp==epoch)setState(()=>busy.remove(item.id));}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(t('Following','Wadanda nake bi'))),
    body:Column(children:[
      Padding(padding:const EdgeInsets.all(12),child:Column(children:[
        TextField(key:const Key('following_search'),controller:query,
          onSubmitted:(_)=>refresh(),decoration:InputDecoration(
          labelText:t('Name, profession or skill','Suna, sana’a ko fasaha'),
          border:const OutlineInputBorder(),prefixIcon:const Icon(Icons.search),
          suffixIcon:IconButton(onPressed:refresh,icon:const Icon(Icons.arrow_forward),
            tooltip:t('Search','Nema')))),
        const SizedBox(height:8),
        DropdownButtonFormField<String>(key:const Key('following_language'),initialValue:language,
          decoration:InputDecoration(labelText:t('Language','Harshe'),border:const OutlineInputBorder()),
          items:[DropdownMenuItem(value:'',child:Text(t('All languages','Duk harsuna'))),
            const DropdownMenuItem(value:'ha',child:Text('Hausa')),
            const DropdownMenuItem(value:'en',child:Text('English'))],
          onChanged:(value){setState(()=>language=value??'');refresh();})
      ])),
      if(error.isNotEmpty)MaterialBanner(content:Text(error),actions:[
        TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
      if(offline)Text(t('Offline: cached view only; changes disabled.',
        'Babu intanet: tsofaffin bayanai kawai, babu canji.')),
      Expanded(child:loading&&people.isEmpty
        ?const Center(child:CircularProgressIndicator())
        :people.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          Text(t('No followed Masana match.','Babu Masana da ya dace.')),
          TextButton(onPressed:widget.openDiscovery??refresh,
            child:Text(t('Find Masana','Nemi Masana')))]))
        :RefreshIndicator(onRefresh:refresh,child:ListView.builder(
          itemCount:people.length+(cursor==null?0:1),
          itemBuilder:(context,index){
            if(index==people.length)return Center(child:TextButton(
              onPressed:paging?null:more,
              child:Text(paging?t('Loading…','Ana lodawa…'):t('Load more','Kara nunawa'))));
            final p=people[index];
            return ListTile(key:Key('followed_'+p.id),
              leading:CircleAvatar(child:Text(p.name.isEmpty?'?':p.name.substring(0,1))),
              title:Text(p.name),subtitle:Text(p.profession),
              onTap:()=>widget.openProfile(p.id),
              trailing:PopupMenuButton<String>(
                tooltip:t('Following options','Zabukan bi'),
                enabled:!offline&&!denied&&!disabled&&!busy.contains(p.id),
                onSelected:(choice){if(choice=='mute'){mute(p);}else{unfollow(p);}},
                itemBuilder:(_)=>[
                  PopupMenuItem(value:'mute',child:Text(p.muted
                    ?t('Unmute','Daina shiru'):t('Mute','Yi shiru'))),
                  PopupMenuItem(value:'unfollow',child:Text(t('Unfollow','Daina bi')))]));
          })))
    ])
  );
}

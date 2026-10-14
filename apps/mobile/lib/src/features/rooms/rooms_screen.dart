import 'dart:async';
import 'room_discussion_api.dart';
import 'room_discussion_screen.dart';
import 'room_membership_client.dart';
import 'room_membership_screen.dart';
import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_client.dart';
import 'saved_lessons_client.dart';
import 'saved_lessons_screen.dart';
const masanaBlue=Color(0xFF075E54);

/// Host session must guard details pushed beyond the account-keyed tab.
typedef RoomDetailProtector = Widget Function(BuildContext routeContext, Widget detail);
String roomError(Object e){
 if(e is StateError&&e.message=='account_changed')return 'Session changed. Sign in again.';
 if(e is DioException){
  if(e.response?.statusCode==403)return 'Membership or verified subscription required.';
  if(e.response?.statusCode==410)return 'This feature is currently disabled.';

  if(e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout)return 'Offline. Retry after reconnecting.';
 }
 return 'Could not load. Check the network and retry.';
}
class RoomsScreen extends StatefulWidget {
 const RoomsScreen({super.key,required this.client,this.discussionApi,this.discussionAccountScope,this.onDiscussionReport,this.savedLessonsClient,this.savedLessonsAccountKey,this.membershipClient,this.protectDetail});
 final RoomsClient client;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
 final SavedLessonsClient? savedLessonsClient;
 final String? savedLessonsAccountKey;
 final RoomMembershipClient? membershipClient;
 final RoomDetailProtector? protectDetail;
 @override State<RoomsScreen> createState()=>_RoomsScreenState();
}
class _RoomsScreenState extends State<RoomsScreen>{
 bool joined=false,loading=true;Object? error;List<RoomInfo> rows=[];
 int _loadVersion=0;
 Timer? _searchDebounce;
 @override void dispose(){_searchDebounce?.cancel();super.dispose();}
 String query='',language='';
 @override void initState(){super.initState();load();}
 Future<void> load()async{
  final version=++_loadVersion;
  setState((){loading=true;error=null;});
  try{final list=await widget.client.list(joined:joined,query:query,language:language);
   if(mounted&&version==_loadVersion)setState((){rows=list;loading=false;});
  }catch(e){if(mounted&&version==_loadVersion)setState((){error=e;loading=false;});}
 }
  void _resetSearch() {
    _searchDebounce?.cancel();
    _searchController.clear();
    query = '';
    language = '';
    load();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Rooms')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            controller: _searchController,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Search rooms or topics',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: query.isEmpty ? null : IconButton(
                tooltip: 'Clear Rooms search',
                icon: const Icon(Icons.close),
                onPressed: _resetSearch,
              ),
              border: const OutlineInputBorder(),
            ),
            onChanged: (value) {
              setState(() => query = value.trim());
              // Invalidate all in-flight results immediately; the next
              // debounced query is the sole authority for this list.
              ++_loadVersion;
              _searchDebounce?.cancel();
              _searchDebounce = Timer(const Duration(milliseconds: 300), load);
            },
            onSubmitted: (value) {
              _searchDebounce?.cancel();
              query = value.trim();
              load();
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 0,
              children: [
                ChoiceChip(
                  label: const Text('Discover'),
                  selected: !joined,
                  onSelected: (_) => setState(() { joined = false; load(); }),
                ),
                ChoiceChip(
                  label: const Text('Joined'),
                  selected: joined,
                  onSelected: (_) => setState(() { joined = true; load(); }),
                ),
                DropdownButton<String>(
                  value: language,
                  isDense: true,
                  underline: const SizedBox.shrink(),
                  items: const [
                    DropdownMenuItem(value: '', child: Text('All languages')),
                    DropdownMenuItem(value: 'en', child: Text('English')),
                    DropdownMenuItem(value: 'ha', child: Text('Hausa')),
                  ],
                  onChanged: (value) =>
                      setState(() { language = value ?? ''; load(); }),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? Center(child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(roomError(error!)),
                        TextButton(onPressed: load, child: const Text('Retry')),
                      ],
                    ))
                  : rows.isEmpty
                      ? Center(child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('No Rooms match this search.'),
                            TextButton(onPressed: _resetSearch,
                              child: const Text('Show all')),
                          ],
                        ))
                      : RefreshIndicator(
                          onRefresh: load,
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            itemCount: rows.length,
                            itemBuilder: (context, index) {
                              final room = rows[index];
                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 2),
                                child: Card(
                                  margin: EdgeInsets.zero,
                                  child: ListTile(
                                    visualDensity: VisualDensity.compact,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 2),
                                    leading: CircleAvatar(
                                      backgroundColor: color.primaryContainer,
                                      foregroundColor: color.onPrimaryContainer,
                                      child: const Icon(Icons.school_outlined,
                                        size: 20),
                                    ),
                                    title: Text(room.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600)),
                                    subtitle: Text(
                                      '${room.language} · ${room.members} members'
                                      '${room.paid ? ' · Paid' : ''}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                    trailing: Icon(
                                      room.joined
                                          ? Icons.check_circle_outline
                                          : Icons.chevron_right,
                                      color: color.primary),
                                    onTap: () async {
                                      await Navigator.push<void>(
                                        context,
                                        MaterialPageRoute(builder: (routeContext) {
                                          final detail = RoomHomeScreen(
                                            client: widget.client,
                                            id: room.id,
                                            discussionApi: widget.discussionApi,
                                            discussionAccountScope:
                                                widget.discussionAccountScope,
                                            onDiscussionReport:
                                                widget.onDiscussionReport,
                                            savedLessonsClient:
                                                widget.savedLessonsClient,
                                            savedLessonsAccountKey:
                                                widget.savedLessonsAccountKey,
                                            membershipClient:
                                                widget.membershipClient,
                                          );
                                          return widget.protectDetail
                                              ?.call(routeContext, detail) ?? detail;
                                        }),
                                      );
                                      if (mounted) load();
                                    },
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ]),
    );
  }
}

class RoomHomeScreen extends StatefulWidget {
 const RoomHomeScreen({super.key,required this.client,required this.id,
  this.discussionApi,this.discussionAccountScope,this.onDiscussionReport,this.savedLessonsClient,this.savedLessonsAccountKey,
  this.membershipClient});
 final RoomsClient client;final String id;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
 final SavedLessonsClient? savedLessonsClient;
 final String? savedLessonsAccountKey;
 final RoomMembershipClient? membershipClient;
 @override State<RoomHomeScreen> createState()=>_RoomHomeScreenState();
}
class _RoomHomeScreenState extends State<RoomHomeScreen>{
 final question=TextEditingController();
 RoomInfo? info;List<RoomQuestion> items=[];List<RoomLesson> lessons=[];
 bool loading=true,busy=false,paidAccessBlocked=false;Object? error;int tab=0;String? pendingKey;
 Timer? _answerPoll;
 int _viewVersion=0,_pollFailures=0;
 bool _polling=false;
 @override void initState(){super.initState();load();}
 @override void didUpdateWidget(covariant RoomHomeScreen oldWidget){
  super.didUpdateWidget(oldWidget);
  if(oldWidget.client!=widget.client||oldWidget.id!=widget.id){
   _answerPoll?.cancel();
   ++_viewVersion;
   items=[];info=null;lessons=[];paidAccessBlocked=false;pendingKey=null;
   load();
  }
 }
 @override void dispose(){_answerPoll?.cancel();++_viewVersion;question.dispose();super.dispose();}
 bool get _hasPendingAnswers=>info?.joined==true&&!paidAccessBlocked&&
     items.any((item)=>item.answer==null);
 void _scheduleAnswers(){
  _answerPoll?.cancel();
  if(!mounted||!_hasPendingAnswers||loading||busy)return;
  final delay=Duration(seconds:_pollFailures==0?3:_pollFailures==1?8:20);
  _answerPoll=Timer(delay,_refreshAnswers);
 }
 Future<void> _refreshAnswers()async{
  if(!mounted||loading||busy||!_hasPendingAnswers)return;
  if(_polling){_scheduleAnswers();return;}
  final version=_viewVersion,roomId=widget.id,client=widget.client;
  _polling=true;
  try{
   final next=await client.questions(roomId);
   if(!mounted||version!=_viewVersion||roomId!=widget.id||!identical(client,widget.client))return;
   _pollFailures=0;
   setState(()=>items=next);
  }on DioException catch(error){
   if(!mounted||version!=_viewVersion)return;
   if(error.response?.statusCode==401||error.response?.statusCode==403){
    setState(()=>paidAccessBlocked=true);
   }else{_pollFailures=(_pollFailures+1).clamp(0,2);}
  }catch(_){
   if(mounted&&version==_viewVersion)_pollFailures=(_pollFailures+1).clamp(0,2);
  }finally{
   _polling=false;
   if(mounted&&version==_viewVersion)_scheduleAnswers();
  }
 }
 Future<void> load()async{
  _answerPoll?.cancel();
  final version=++_viewVersion;
  setState((){loading=true;error=null;});
  try{final room=await widget.client.room(widget.id);
   List<RoomQuestion> qs=[];
   List<RoomLesson> ls=[];
   bool subscriptionBlocked=false;
   if(room.joined){
    try{
     qs=await widget.client.questions(widget.id);
     ls=await widget.client.lessons(widget.id);
    }on DioException catch(e){
     // Membership is not entitlement. Expired/held paid users must still see
     // the Room preview and regain access through verified Play checkout.
     if(room.paid&&e.response?.statusCode==403){subscriptionBlocked=true;}
     else{rethrow;}
    }
   }
   if(mounted&&version==_viewVersion){
    _pollFailures=0;
    setState((){
     info=room;items=qs;lessons=ls;paidAccessBlocked=subscriptionBlocked;loading=false;
    });
    _scheduleAnswers();
   }
  }catch(e){if(mounted&&version==_viewVersion)setState((){error=e;loading=false;});}
 }
 Future<void> membership()async{
  if(info==null||busy)return;setState(()=>busy=true);
  try{if(info!.joined){await widget.client.leave(widget.id);}else{await widget.client.join(widget.id);}
   await load();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> bookmark(RoomLesson lesson)async{
  final client=widget.savedLessonsClient;
  if(busy||client==null||!client.isCurrentAccount||widget.savedLessonsAccountKey!=client.accountKey||paidAccessBlocked)return;
  setState(()=>busy=true);
  try{
   await client.save(widget.id,lesson.id);
   if(mounted&&client.isCurrentAccount)ScaffoldMessenger.of(context)
    .showSnackBar(const SnackBar(content:Text('Lesson saved.')));
  }catch(error){
   if(mounted)ScaffoldMessenger.of(context)
    .showSnackBar(SnackBar(content:Text(roomError(error))));
  }finally{if(mounted)setState(()=>busy=false);}
 }
 void openSaved(){
  final client=widget.savedLessonsClient;
  final key=widget.savedLessonsAccountKey;
  if(client==null||key==null||key!=client.accountKey||!client.isCurrentAccount||!info!.joined||paidAccessBlocked)return;
  Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>
   SavedRoomLessonsScreen(client:client,roomId:widget.id,accountKey:key)));
 }
 Future<void> ask()async{
  if(busy||question.text.trim().isEmpty)return;
  pendingKey??='rq_'+DateTime.now().microsecondsSinceEpoch.toString()+'_'
   +List.generate(12,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  setState(()=>busy=true);
  try{await widget.client.ask(widget.id,question.text.trim(),pendingKey!);
   pendingKey=null;question.clear();await load();
  }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(roomError(e))));}
  finally{if(mounted){setState(()=>busy=false);_scheduleAnswers();}}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:Text(info?.title??'Room'),backgroundColor:Colors.white,foregroundColor:Colors.black87,
   actions:[
    if(widget.membershipClient!=null) IconButton(
      key:const Key('room-invitations'),tooltip:'Room invitations',
      onPressed:()=>Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>
        RoomMembershipScreen(client:widget.membershipClient!,roomId:widget.id,onJoined:load))),
      icon:const Icon(Icons.mark_email_unread_outlined)),
    if(widget.savedLessonsClient!=null) IconButton(
    key:const Key('room-saved-lessons'),tooltip:'Saved lessons',
    onPressed:info?.joined==true&&!paidAccessBlocked&&widget.savedLessonsAccountKey==widget.savedLessonsClient?.accountKey?openSaved:null,
    icon:const Icon(Icons.bookmarks_outlined))]),
  body:loading?const Center(child:CircularProgressIndicator()):
   error!=null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(roomError(error!)),TextButton(onPressed:load,child:const Text('Retry'))])):
   info==null?const Center(child:Text('Room not found')):
   Column(children:[
    Padding(padding:const EdgeInsets.all(16),child:Column(children:[
     Text(info!.title,style:Theme.of(context).textTheme.titleLarge),
     Text('Teacher: ${info!.teacher} · ${info!.members} members'),
     if(info!.paid)const Text('Paid lessons need a verified Google Play subscription.'),
     FilledButton(
      onPressed:busy||(!info!.joined&&info!.paid)?null:membership,
      child:Text(info!.paid&&!info!.joined?'Subscription unavailable':
       info!.joined?'Leave Room':'Join free Room'))])),
    if(info!.joined&&!paidAccessBlocked)...[
     SegmentedButton<int>(segments:const [
       ButtonSegment(value:0,label:Text('Lessons')),ButtonSegment(value:1,label:Text('Questions')),
       ButtonSegment(value:2,label:Text('Discussion'))],
       selected:{tab},onSelectionChanged:(selection)=>setState(()=>tab=selection.first)),
     Expanded(child:tab==2?(widget.discussionApi==null||widget.discussionAccountScope==null?
       const Center(child:Text('Discussion is not available yet.')):
       RoomDiscussionScreen(roomId:widget.id,api:widget.discussionApi!,
        accountScope:widget.discussionAccountScope!,onReport:widget.onDiscussionReport)):
       tab==0?(lessons.isEmpty?const Center(child:Text('Lessons coming soon')):
       ListView.builder(itemCount:lessons.length,itemBuilder:(_,i)=>ListTile(
        title:Text(lessons[i].body),
        trailing:widget.savedLessonsClient==null?null:IconButton(
         tooltip:'Save lesson',icon:const Icon(Icons.bookmark_add_outlined),
         onPressed:busy||!widget.savedLessonsClient!.isCurrentAccount||widget.savedLessonsAccountKey!=widget.savedLessonsClient!.accountKey?null:()=>bookmark(lessons[i]))))):
       RefreshIndicator(onRefresh:load,child:ListView(children:[
        if(items.isEmpty)const ListTile(title:Text('Ask the first question.')),
        for(final q in items)ListTile(title:Text(q.body),
         subtitle:Text(q.answer??'AI teacher is preparing an answer')),
       ]))),
     if(tab==1)SafeArea(child:Padding(padding:const EdgeInsets.all(8),child:Row(children:[
       Expanded(child:TextField(controller:question,maxLength:2000,maxLines:2,
        decoration:const InputDecoration(hintText:'Ask your teacher',border:OutlineInputBorder()))),
       IconButton(icon:const Icon(Icons.send,color:masanaBlue),onPressed:busy?null:ask,tooltip:'Send question'),
     ]))),
    ]else Expanded(child:Center(child:Text(info!.paid?'A verified subscription is required to access lessons and questions':'Join to see lessons and ask questions'))),
   ])
 );
}


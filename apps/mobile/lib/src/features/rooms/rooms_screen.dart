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
import 'package:go_router/go_router.dart';

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
 const RoomsScreen({super.key,required this.client,this.discussionApi,this.discussionAccountScope,this.onDiscussionReport,this.savedLessonsClient,this.savedLessonsAccountKey,this.membershipClient,this.protectDetail,this.teacherNames = const {},this.viewerId});
 final RoomsClient client;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
 final SavedLessonsClient? savedLessonsClient;
 final String? savedLessonsAccountKey;
 final RoomMembershipClient? membershipClient;
 final RoomDetailProtector? protectDetail;
 final Map<String,String> teacherNames;
 final String? viewerId;
 @override State<RoomsScreen> createState()=>_RoomsScreenState();
}
class _RoomsScreenState extends State<RoomsScreen>{
 bool joined=false,loading=true;Object? error;List<RoomInfo> rows=[];
 int _loadVersion=0;
 Timer? _searchDebounce;
 final TextEditingController _searchController = TextEditingController();
 @override void dispose(){_searchDebounce?.cancel();_searchController.dispose();super.dispose();}
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
                                      maxLines: 2, overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 16, fontWeight: FontWeight.w700)),
                                    subtitle: Padding(
                                      padding: const EdgeInsets.only(top: 7),
                                      child: Wrap(spacing: 6,runSpacing: 4,children: [
                                        Chip(
                                          visualDensity: VisualDensity.compact,
                                          label: Text(room.teacherDisplayName ??
                                            widget.teacherNames[room.teacher] ??
                                            'Masana teacher',
                                            style: const TextStyle(fontSize: 11))),
                                        Chip(
                                          visualDensity: VisualDensity.compact,
                                          label: Text(room.paid
                                            ? (room.priceKobo == null ? 'Paid room'
                                              : '₦' + (room.priceKobo! / 100).toStringAsFixed(2))
                                            : 'Free',
                                            style: const TextStyle(fontSize: 11))),
                                        Text(room.language + ' · ' + room.members.toString() + ' members',
                                          style: Theme.of(context).textTheme.bodySmall),
                                      ]),
                                    ),
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
                                            teacherNames: widget.teacherNames,
                                            viewerId: widget.viewerId,
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


/// A Room opens as one conversation, not a lesson document or multi-tab feed.
/// Existing /questions is the current persisted, idempotent teacher-answer
/// transport. A proper room-wide participant message feed still requires a
/// server contract; never manufacture member posts or teacher answers.
class RoomHomeScreen extends StatefulWidget {
 const RoomHomeScreen({super.key,required this.client,required this.id,
  this.discussionApi,this.discussionAccountScope,this.onDiscussionReport,
  this.savedLessonsClient,this.savedLessonsAccountKey,this.membershipClient,
  this.teacherNames = const {},this.viewerId});
 final RoomsClient client; final String id;
 final RoomDiscussionApi? discussionApi;
 final String? discussionAccountScope;
 final ValueChanged<RoomDiscussionReply>? onDiscussionReport;
 final SavedLessonsClient? savedLessonsClient;
 final String? savedLessonsAccountKey;
 final RoomMembershipClient? membershipClient;
 final Map<String,String> teacherNames;
 final String? viewerId;
 @override State<RoomHomeScreen> createState()=>_RoomHomeScreenState();
}

class _RoomHomeScreenState extends State<RoomHomeScreen>{
 final input=TextEditingController();
 RoomInfo? info;
 List<RoomQuestion> messages=[];
 bool loading=true,sending=false,joining=false,accessBlocked=false;
 Object? error;
 String? pendingKey;
 int _version=0;
 Timer? _poll;

 @override void initState(){super.initState();load();}
 @override void didUpdateWidget(covariant RoomHomeScreen old){
  super.didUpdateWidget(old);
  if(old.client!=widget.client || old.id!=widget.id ||
     old.discussionAccountScope!=widget.discussionAccountScope){
    _poll?.cancel();_version++;messages=[];info=null;pendingKey=null;
    input.clear();load();
  }
 }
 @override void dispose(){
  _poll?.cancel();_version++;input.dispose();super.dispose();
 }
 String teacherLabel(RoomInfo room)=> room.teacherDisplayName ??
      widget.teacherNames[room.teacher] ?? 'Masana teacher';

 void schedulePoll(){
  _poll?.cancel();
  // Poll only while an answer is outstanding; stop after it arrives
  // to avoid needless repeated calls and battery/network drain.
  if(mounted && info?.joined==true && !accessBlocked &&
      messages.any((message)=>message.answer==null)){
   _poll=Timer(const Duration(seconds: 3),refreshMessages);
  }
 }
 Future<void> refreshMessages() async {
  final version=_version,roomId=widget.id;
  if(info?.joined!=true || accessBlocked)return;
  try{
   final fresh=await widget.client.questions(roomId);
   if(!mounted || version!=_version || roomId!=widget.id)return;
   setState(()=>messages=fresh.reversed.toList());
  }on DioException catch(e){
   if(mounted && version==_version && e.response?.statusCode==403){
    setState(()=>accessBlocked=true);
   }
  }catch(_){
   // Keep previously confirmed chat messages during short network outages.
  }
  schedulePoll();
 }
 Future<void> load()async{
  _poll?.cancel();
  final version=++_version,roomId=widget.id,client=widget.client;
  setState((){loading=true;error=null;});
  try{
   final room=await client.room(roomId);
   if(!mounted || version!=_version || roomId!=widget.id)return;
   List<RoomQuestion> next=[];
   var blocked=false;
   if(room.joined){
    try{next=await client.questions(roomId);}
    on DioException catch(e){
     if(e.response?.statusCode==403){blocked=true;}else{rethrow;}
    }
   }
   if(!mounted || version!=_version || roomId!=widget.id)return;
   setState((){
    info=room;messages=next.reversed.toList();accessBlocked=blocked;loading=false;
   });
   schedulePoll();
  }catch(e){
   if(mounted && version==_version)setState((){error=e;loading=false;});
  }
 }
 Future<void> join()async{
  final room=info;
  if(room==null || room.joined || joining)return;
  setState(()=>joining=true);
  try{await widget.client.join(widget.id);await load();}
  catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>joining=false);}
 }
 Future<void> leave()async{
  if(info?.joined!=true || joining)return;
  setState(()=>joining=true);
  try{await widget.client.leave(widget.id);await load();}
  catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text(roomError(e))));}
  finally{if(mounted)setState(()=>joining=false);}
 }
 Future<void> send()async{
  final message=input.text.trim();
  if(sending || info?.joined!=true || accessBlocked ||
     message.isEmpty || message.length>2000)return;
  pendingKey ??= 'rq_' + DateTime.now().microsecondsSinceEpoch.toString()
    + '_' + List.generate(12,(_)=>Random.secure().nextInt(16).toRadixString(16)).join();
  final version=_version,scope=widget.discussionAccountScope;
  setState(()=>sending=true);
  try{
   await widget.client.ask(widget.id,message,pendingKey!);
   if(!mounted || version!=_version || scope!=widget.discussionAccountScope)return;
   pendingKey=null;input.clear();await refreshMessages();
  }catch(e){
   if(mounted && version==_version)ScaffoldMessenger.of(context).showSnackBar(
     SnackBar(content:Text(roomError(e))));
  }finally{
   if(mounted && version==_version)setState(()=>sending=false);
  }
 }
 Future<void> showInfo()async{
  final room=info;
  if(room==null)return;
  await showModalBottomSheet<void>(context:context,showDragHandle:true,builder:(ctx)=>
    SafeArea(child:Padding(padding:const EdgeInsets.all(20),child:Column(
      mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,
      children:[
       Text(room.title,style:Theme.of(ctx).textTheme.titleLarge),
       const SizedBox(height:8),
       Text('Teacher: ' + teacherLabel(room)),
       const SizedBox(height:10),
       Text(room.paid
          ? (room.priceKobo == null
             ? 'Paid access · price must be confirmed before joining'
             : 'Price: ₦' + (room.priceKobo!/100).toStringAsFixed(2))
          : 'Free room',style:Theme.of(ctx).textTheme.titleMedium),
       Text(room.trialMinutes==null?'No verified free trial advertised'
         : 'Trial: ' + room.trialMinutes.toString() + ' minutes'),
       const SizedBox(height:12),
       if(!room.joined)FilledButton(
         onPressed:room.paid || joining?null:(){
           Navigator.of(ctx).pop();join();
         },
         child:Text(room.paid?'Subscription required':'Join Room')),
       if(room.joined)TextButton(onPressed:(){
         Navigator.of(ctx).pop();leave();
       },child:const Text('Leave Room')),
      ],
    ))));
 }
 @override Widget build(BuildContext context){
  final room=info;
  final color=Theme.of(context).colorScheme;
  return Scaffold(
   backgroundColor:color.surface,
   appBar:AppBar(
    backgroundColor:color.surface,
    title:Text(room?.title??'Room',maxLines:1,overflow:TextOverflow.ellipsis),
    actions:[
     TextButton(onPressed:()=>context.push('/billing?service=data'),
       child:Text('Data Bundles',style:TextStyle(
         color:color.primary,fontWeight:FontWeight.w700,fontSize:12))),
     IconButton(tooltip:'Room info',onPressed:room==null?null:showInfo,
       icon:const Icon(Icons.info_outline)),
     if(widget.membershipClient!=null && room?.joined==true)
       IconButton(tooltip:'Room invitations',
         onPressed:()=>Navigator.push<void>(context,
           MaterialPageRoute(builder:(_)=>RoomMembershipScreen(
            client:widget.membershipClient!,roomId:widget.id,onJoined:load))),
         icon:const Icon(Icons.group_add_outlined)),
    ],
   ),
   body:loading?const Center(child:CircularProgressIndicator()):
    error!=null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
      Text(roomError(error!)),TextButton(onPressed:load,child:const Text('Retry'))])):
    room==null?const Center(child:Text('Room not found')):
    !room.joined || accessBlocked?Center(child:Padding(
      padding:const EdgeInsets.symmetric(horizontal:24),
      child:Column(mainAxisSize:MainAxisSize.min,children:[
       CircleAvatar(radius:28,child:const Icon(Icons.groups_outlined)),
       const SizedBox(height:14),
       Text(room.title,style:Theme.of(context).textTheme.titleLarge,textAlign:TextAlign.center),
       const SizedBox(height:6),
       Chip(label:Text(teacherLabel(room))),
       const SizedBox(height:12),
       Text(room.paid
         ? (room.priceKobo==null?'Paid · price unavailable'
           :'₦' + (room.priceKobo!/100).toStringAsFixed(2))
         :'Free',style:Theme.of(context).textTheme.titleMedium),
       Text(room.trialMinutes==null?'No verified trial'
         :'Trial: ' + room.trialMinutes.toString() + ' minutes'),
       const SizedBox(height:18),
       FilledButton(onPressed:joining || room.paid?null:join,
         child:Text(joining?'Joining…':room.paid
           ? 'Subscription required':'Join Room')),
       if(accessBlocked)const Text('Your Room access must be verified.'),
      ]))):
    Column(children:[
      Expanded(child:RefreshIndicator(onRefresh:refreshMessages,
       child:ListView.builder(
        padding:const EdgeInsets.symmetric(horizontal:12,vertical:12),
        itemCount:messages.isEmpty?1:messages.length*2,
        itemBuilder:(ctx,index){
         if(messages.isEmpty)return const Padding(
          padding:EdgeInsets.all(32),
          child:Text('Start a conversation with your Masana teacher.',
            textAlign:TextAlign.center));
         final message=messages[index~/2];
         final fromTeacher=index.isOdd;
         final ownMessage=widget.viewerId!=null &&
             message.authorUserId==widget.viewerId;
         if(fromTeacher && (message.answer==null || message.answer!.isEmpty)){
          return Align(alignment:Alignment.centerLeft,
           child:Padding(padding:const EdgeInsets.symmetric(vertical:5),
             child:Text('Teacher is preparing a reply',
               style:Theme.of(ctx).textTheme.bodySmall)));
         }
         return Align(
          alignment:fromTeacher || !ownMessage
              ? Alignment.centerLeft : Alignment.centerRight,
          child:ConstrainedBox(constraints:BoxConstraints(
            maxWidth:MediaQuery.sizeOf(ctx).width*.82),
            child:Card(
             color:fromTeacher || !ownMessage
                ? color.surface : color.primaryContainer,
             margin:const EdgeInsets.symmetric(vertical:4),
             child:Padding(padding:const EdgeInsets.symmetric(
               horizontal:12,vertical:9),
               child:Column(crossAxisAlignment:CrossAxisAlignment.start,
                children:[
                 if(!fromTeacher && !ownMessage)
                   Text('Room member',style:TextStyle(
                     color:color.primary,fontSize:11,fontWeight:FontWeight.w700)),
                 if(fromTeacher)Text(teacherLabel(room),
                   style:TextStyle(color:color.primary,
                     fontWeight:FontWeight.w700,fontSize:11)),
                 Text(fromTeacher?message.answer!:message.body),
                 if(!fromTeacher && message.status!='answered')
                   Text(message.status,
                     style:Theme.of(ctx).textTheme.bodySmall),
               ]))),
            ));
        },
       ))),
      SafeArea(top:false,child:Padding(
       padding:const EdgeInsets.fromLTRB(10,8,10,8),
       child:Row(children:[
        Expanded(child:TextField(controller:input,
         minLines:1,maxLines:3,maxLength:2000,
         textInputAction:TextInputAction.send,
         onSubmitted:(_)=>send(),
         decoration:InputDecoration(
           hintText:'Message your teacher',
           counterText:'',isDense:true,
           contentPadding:const EdgeInsets.symmetric(horizontal:16,vertical:13),
           border:OutlineInputBorder(borderRadius:BorderRadius.circular(24))))),
        const SizedBox(width:4),
        IconButton.filled(
          tooltip:'Send message',
          onPressed:sending?null:send,
          icon:const Icon(Icons.send_rounded)),
       ]))),
    ]),
  );
 }
}

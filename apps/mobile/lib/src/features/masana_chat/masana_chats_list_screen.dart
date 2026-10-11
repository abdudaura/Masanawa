import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'masana_chats_list_api.dart';

/// C10: no fan phonebook and no person-to-person messaging entry point.
class MasanaChatsListScreen extends StatefulWidget {
  const MasanaChatsListScreen({
    super.key,
    required this.accountId,
    required this.inbox,
    required this.onOpen,
    this.onDiscover,
  });
  final String accountId;
  final MasanaInboxAccess inbox;
  final void Function(String characterId,String displayName) onOpen;
  final VoidCallback? onDiscover;

  @override
  State<MasanaChatsListScreen> createState()=>_MasanaChatsListScreenState();
}
class _MasanaChatsListScreenState extends State<MasanaChatsListScreen> {
  final _search=TextEditingController();
  List<MasanaInboxItem> _chats=[];
  Timer? _debounce;
  int _generation=0;
  bool _loading=true,_offline=false,_denied=false,_retired=false;
  String? _error;

  @override
  void initState(){super.initState();_bootstrap();}
  @override
  void didUpdateWidget(covariant MasanaChatsListScreen oldWidget){
    super.didUpdateWidget(oldWidget);
    if(oldWidget.accountId!=widget.accountId) {
      _generation++;
      _search.clear();
      _chats=[];_loading=true;_offline=false;_error=null;
      _denied=false;_retired=false;
      _bootstrap();
    }
  }
  @override
  void dispose(){
    _generation++;_debounce?.cancel();_search.dispose();super.dispose();
  }
  bool _current(int n)=>mounted&&n==_generation;
  Future<void> _bootstrap() async {
    final n=++_generation, account=widget.accountId;
    try {
      final cached=await widget.inbox.readCache(account);
      if(_current(n)) setState(() { _chats=cached;_loading=cached.isEmpty; });
    } catch (_) { /* network refresh follows */ }
    if(_current(n)) await _refresh();
  }
  Future<void> _refresh() async {
    final n=++_generation;
    if(mounted) setState(() {
      _loading=_chats.isEmpty;_error=null;_denied=false;_retired=false;
    });
    try {
      final rows=await widget.inbox.load(widget.accountId,
        query:_search.text.trim());
      if(!_current(n)) return;
      setState(() { _chats=rows;_loading=false;_offline=false;_error=null; });
    } on DioException catch(e) {
      if(!_current(n)) return;
      setState(() {
        _loading=false;
        final status=e.response?.statusCode;
        _denied=status==401||status==403;
        _retired=status==410;
        _offline=status==null;
        _error=_denied?'Sign in to see your chats'
          :_retired?'Chats are temporarily unavailable'
          :_offline?'Offline — showing saved chats'
          :'Could not load chats. Retry.';
        if(_denied||_retired) _chats=[]; // never reveal stale account data
      });
    } catch (_) {
      if(_current(n)) setState(() {
        _loading=false;_error='Could not load chats. Retry.';
      });
    }
  }
  void _scheduleSearch(String _) {
    _debounce?.cancel();
    _debounce=Timer(const Duration(milliseconds:350),_refresh);
  }
  Future<void> _togglePin(MasanaInboxItem chat) async {
    try {
      final newVersion=await widget.inbox.pin(
        chat.characterId,!chat.pinned,chat.revision);
      if(!mounted) return;
      setState((){
        _chats=[for(final c in _chats)
          if(c.characterId==chat.characterId)
            c.pinnedCopy(!chat.pinned,newVersion) else c];
        _chats.sort((a,b)=>a.pinned==b.pinned?0:a.pinned?-1:1);
      });
      // Refresh cache and authoritative ordering after the mutation.
      unawaited(_refresh());
    } catch (_) {
      if(mounted) setState(() {
        _error='Pin not saved. Refresh and retry.';
      });
    }
  }
  void _open(MasanaInboxItem chat) {
    widget.onOpen(chat.characterId,chat.displayName);
    unawaited(widget.inbox.markRead(chat.characterId).then((_) {
      if(mounted) unawaited(_refresh());
    }).catchError((Object _) { /* keep unread on failure */ }));
  }
  @override
  Widget build(BuildContext context) {
    final isHausa=Localizations.localeOf(context).languageCode=='ha';
    String copy(String en,String ha)=>isHausa?ha:en;
    return Scaffold(
      appBar:AppBar(title:Text(copy('Chats','Hirarraki'))),
      body:Column(children:[
        Padding(padding:const EdgeInsets.fromLTRB(12,8,12,4),
          child:TextField(controller:_search,onChanged:_scheduleSearch,
            decoration:InputDecoration(
              prefixIcon:const Icon(Icons.search),
              hintText:copy('Search Masana or profession',
                'Nemi Masana ko sana\'a'),
              border:const OutlineInputBorder()))),
        if(_error!=null) MaterialBanner(
          content:Text(_error!),actions:[
            TextButton(onPressed:_refresh,
              child:Text(copy('Retry','Sake gwadawa')))]),
        Expanded(child:_loading
          ? const Center(child:CircularProgressIndicator())
          : _chats.isEmpty
            ? Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
                const Icon(Icons.forum_outlined,size:48),
                const SizedBox(height:12),
                Text(copy('No Masana conversations yet',
                  'Babu hirarrakin Masana tukuna')),
                const SizedBox(height:8),
                TextButton(onPressed:widget.onDiscover,
                  child:Text(copy('Find Masana','Nemi Masana'))),
              ]))
            : RefreshIndicator(onRefresh:_refresh,
              child:ListView.builder(
                itemCount:_chats.length,
                itemBuilder:(context,i) {
                  final chat=_chats[i];
                  return ListTile(
                    key:ValueKey(chat.characterId),
                    onTap:()=>_open(chat),
                    leading:CircleAvatar(
                      child:Text(chat.displayName.isEmpty?'M':
                        chat.displayName.characters.first.toUpperCase())),
                    title:Text(chat.displayName,
                      maxLines:1,overflow:TextOverflow.ellipsis),
                    subtitle:Text(
                      chat.lastMessage.isEmpty?chat.profession:chat.lastMessage,
                      maxLines:1,overflow:TextOverflow.ellipsis),
                    trailing:Row(mainAxisSize:MainAxisSize.min,children:[
                      if(chat.unreadCount>0)
                        CircleAvatar(radius:14,child:Text(
                          chat.unreadCount>99?'99+':'${chat.unreadCount}',
                          style:const TextStyle(fontSize:12))),
                      IconButton(
                        tooltip:chat.pinned
                          ?copy('Unpin chat','Cire makala')
                          :copy('Pin chat','Makala hira'),
                        onPressed:()=>_togglePin(chat),
                        icon:Icon(chat.pinned?Icons.push_pin:Icons.push_pin_outlined)),
                    ]),
                  );
                })),
        ),
      ]),
      floatingActionButton:widget.onDiscover==null?null:
        FloatingActionButton(
          tooltip:copy('Find Masana','Nemi Masana'),
          onPressed:widget.onDiscover,
          child:const Icon(Icons.add_comment_outlined)),
    );
  }
}

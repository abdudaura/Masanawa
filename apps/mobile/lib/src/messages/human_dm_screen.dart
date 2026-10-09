import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../human_calls/human_call_flow.dart';

import '../state/session_state.dart';
import 'human_dm_controller.dart';
import 'human_dm_transport.dart';

/// C08 mounts this human-only inbox under the canonical Chats tab.
class HumanDmInboxScreen extends ConsumerStatefulWidget {
  const HumanDmInboxScreen({super.key, this.onNewMessage});
  final VoidCallback? onNewMessage;
  @override
  ConsumerState<HumanDmInboxScreen> createState()=>_HumanDmInboxScreenState();
}
class _HumanDmInboxScreenState extends ConsumerState<HumanDmInboxScreen> {
  Future<List<HumanDmThread>>? _future;
  String? _forUser;
  Future<List<HumanDmThread>> _reload() {
    final next=ref.read(humanDmTransportProvider).inbox();
    setState(()=>_future=next);
    return next;
  }
  @override
  Widget build(BuildContext context) {
    final current=ref.watch(sessionProvider);
    if(current is! SessionSignedIn) {
      _forUser=null;
      _future=null;
      return const Scaffold(body:Center(child:Text('Sign in to view private messages.')));
    }
    if(_forUser!=current.user.id) {
      _forUser=current.user.id;
      _future=ref.read(humanDmTransportProvider).inbox();
    }
    return Scaffold(
      appBar:AppBar(title:const Text('Chats'),actions:[
        IconButton(tooltip:'Call history',icon:const Icon(Icons.call),
          onPressed:()=>context.push('/messages/calls')),
        IconButton(tooltip:'Refresh messages',onPressed:_reload,icon:const Icon(Icons.refresh))
      ]),
      bottomNavigationBar:const HumanCallIncomingStrip(),
      floatingActionButton: widget.onNewMessage == null ? null :
        FloatingActionButton.extended(
          tooltip: 'New message',
          onPressed: widget.onNewMessage,
          icon: const Icon(Icons.edit_outlined),
          label: const Text('New message'),
        ),
      body:FutureBuilder<List<HumanDmThread>>(
        key:ValueKey(current.user.id),
        future:_future,
        builder:(context,snapshot) {
          if(!snapshot.hasData && snapshot.connectionState!=ConnectionState.done) {
            return const Center(child:CircularProgressIndicator());
          }
          if(snapshot.hasError) {
            return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
              const Text('Messages could not be loaded.'),
              const SizedBox(height:12),
              FilledButton(onPressed:_reload,child:const Text('Retry')),
            ]));
          }
          final threads=snapshot.data??[];
          return RefreshIndicator(
            onRefresh:() async {await _reload();},
            child:threads.isEmpty
            ?ListView(children:const [SizedBox(height:140),
                Center(child:Text('No private conversations yet.')),
                Center(child:Text('Find a person through Contacts to start messaging.'))])
            :ListView.builder(itemCount:threads.length,itemBuilder:(context,index) {
              final item=threads[index];
              return ListTile(
                key:ValueKey(item.conversationId),
                leading:CircleAvatar(child:Text(item.otherDisplayName.isNotEmpty?item.otherDisplayName[0].toUpperCase():'?')),
                title:Text(item.otherDisplayName),
                subtitle:Text(item.otherHandle==null?'Private message':'@${item.otherHandle}'),
                trailing:item.unreadCount>0
                  ?CircleAvatar(radius:13,child:Text(item.unreadCount>99?'99+':'${item.unreadCount}',
                      style:const TextStyle(fontSize:11))) :null,
                onTap:()=>Navigator.of(context).push(MaterialPageRoute<void>(
                  builder:(_)=>HumanDmThreadScreen(conversationId:item.conversationId,
                    otherDisplayName:item.otherDisplayName))),
              );
            }),
          );
        },
      ),
    );
  }
}

/// Real contact-to-thread entry. Use from a C01 consenting person or human profile;
/// failure never creates a local fake thread.
class HumanDmOpenContactAction extends ConsumerStatefulWidget {
  const HumanDmOpenContactAction({super.key,required this.otherUserId,required this.label});
  final String otherUserId,label;
  @override
  ConsumerState<HumanDmOpenContactAction> createState()=>_HumanDmOpenContactActionState();
}
class _HumanDmOpenContactActionState extends ConsumerState<HumanDmOpenContactAction> {
  bool _busy=false;
  Future<void> _open() async {
    if(_busy) return;
    setState(()=>_busy=true);
    try {
      final id=await ref.read(humanDmTransportProvider).open(widget.otherUserId);
      if(!mounted)return;
      await Navigator.of(context).push(MaterialPageRoute<void>(builder:(_)=>
        HumanDmThreadScreen(conversationId:id,otherDisplayName:widget.label)));
    }catch(e) {
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content:Text('Messaging unavailable for this person. Check their permissions and retry.')));
    }finally{if(mounted)setState(()=>_busy=false);}
  }
  @override
  Widget build(BuildContext context)=>FilledButton.icon(
    onPressed:_busy?null:_open,
    icon:_busy?const SizedBox(height:16,width:16,child:CircularProgressIndicator(strokeWidth:2)):const Icon(Icons.chat_bubble_outline),
    label:Text(_busy?'Opening…':'Message'),
  );
}

class HumanDmThreadScreen extends ConsumerStatefulWidget {
  const HumanDmThreadScreen({super.key,required this.conversationId,required this.otherDisplayName});
  final String conversationId,otherDisplayName;
  @override
  ConsumerState<HumanDmThreadScreen> createState()=>_HumanDmThreadScreenState();
}
class _HumanDmThreadScreenState extends ConsumerState<HumanDmThreadScreen> {
  TextEditingController _draft=TextEditingController();
  String? _draftOwner;
  void _isolateDraft(String? userId) {
    if(_draftOwner==userId)return;
    _draftOwner=userId;
    final old=_draft;
    _draft=TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_)=>old.dispose());
  }
  @override
  void dispose(){_draft.dispose();super.dispose();}
  void _send(HumanDmController actions) {
    final text=_draft.text.trim();
    if(text.isEmpty)return;
    if(text.length>4096) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Keep messages under 4,096 characters.')));
      return;
    }
    _draft.clear();
    actions.send(text);
  }
  Future<void> _actions(HumanDmController controller,HumanDmMessage message) async {
    final action=await showModalBottomSheet<String>(context:context,builder:(sheet)=>
      SafeArea(child:Wrap(children:[
        if(message.deletedAt==null)ListTile(title:const Text('Edit message'),leading:const Icon(Icons.edit_outlined),
          onTap:()=>Navigator.pop(sheet,'edit')),
        ListTile(title:const Text('Delete for everyone'),leading:const Icon(Icons.delete_outline),
          onTap:()=>Navigator.pop(sheet,'delete')),
      ])));
    if(!mounted||action==null)return;
    if(action=='delete') {
      final confirmed=await showDialog<bool>(context:context,builder:(dialog)=>
        AlertDialog(title:const Text('Delete this message?'),content:const Text('Other participants will see a deleted-message marker.'),
        actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Keep')),
          FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Delete'))]));
      if(confirmed==true)await controller.remove(message);
    }
    if(action=='edit' && message.text!=null) {
      final editor=TextEditingController(text:message.text);
      final replacement=await showDialog<String>(context:context,builder:(dialog)=>AlertDialog(
        title:const Text('Edit message'),content:TextField(controller:editor,maxLength:4096,maxLines:4),
        actions:[TextButton(onPressed:()=>Navigator.pop(dialog),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,editor.text.trim()),child:const Text('Save'))]));
      editor.dispose();
      if(replacement!=null && replacement.isNotEmpty)await controller.edit(message,replacement);
    }
  }
  @override
  Widget build(BuildContext context) {
    final session=ref.watch(sessionProvider);
    _isolateDraft(session is SessionSignedIn ? session.user.id : null);
    if(session is! SessionSignedIn) {
      return const Scaffold(body:Center(child:Text('Sign in to read this private conversation.')));
    }
    final key=(userId:session.user.id,conversationId:widget.conversationId);
    final value=ref.watch(humanDmThreadProvider(key));
    final actions=ref.read(humanDmThreadProvider(key).notifier);
    return Scaffold(
      appBar:AppBar(title:Text(widget.otherDisplayName),actions:[
        HumanDmCallButtons(conversationId:widget.conversationId),
        IconButton(tooltip:'Refresh thread',onPressed:actions.load,icon:const Icon(Icons.refresh))
      ]),
      body:Column(children:[
        if(value.error!=null)MaterialBanner(
          content:Text(value.error!),actions:[TextButton(onPressed:actions.load,child:const Text('Refresh'))]),
        Expanded(child:value.loading && value.messages.isEmpty && value.pending.isEmpty
          ?const Center(child:CircularProgressIndicator())
          :ListView(children:[
              if(value.nextBeforeSequence!=null)Center(child:TextButton(
                onPressed:value.loadingOlder?null:actions.older,
                child:Text(value.loadingOlder?'Loading older…':'Load older messages'))),
              for(final m in value.messages.reversed)
                Align(alignment:m.senderUserId==session.user.id?Alignment.centerRight:Alignment.centerLeft,
                  child:GestureDetector(
                    onLongPress:m.senderUserId==session.user.id?()=>_actions(actions,m):null,
                    child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:300),child:Card(
                      color:m.senderUserId==session.user.id?Theme.of(context).colorScheme.primaryContainer:null,
                      child:Padding(padding:const EdgeInsets.all(12),child:Column(
                        crossAxisAlignment:CrossAxisAlignment.start,
                        children:[
                          Text(m.text??'Message deleted'),
                          if(m.editedAt!=null)const Text('Edited',style:TextStyle(fontSize:11)),
                          Text('${m.createdAt.toLocal().hour.toString().padLeft(2,'0')}:${m.createdAt.toLocal().minute.toString().padLeft(2,'0')}',
                            style:Theme.of(context).textTheme.labelSmall),
                        ])),
                    )))),
              for(final pending in value.pending)
                Align(alignment:Alignment.centerRight,child:Card(
                  child:Padding(padding:const EdgeInsets.all(8),child:Column(
                    crossAxisAlignment:CrossAxisAlignment.end,children:[
                      Text(pending.text),
                      const Text('Not confirmed',style:TextStyle(fontSize:11)),
                      TextButton(onPressed:()=>actions.retry(pending.id),child:const Text('Retry send')),
                    ])))),
            ])),
        SafeArea(top:false,child:Padding(padding:const EdgeInsets.fromLTRB(8,6,8,8),
          child:Row(children:[
            Expanded(child:TextField(controller:_draft,maxLines:4,minLines:1,maxLength:4096,
              textCapitalization:TextCapitalization.sentences,
              decoration:const InputDecoration(hintText:'Message',counterText:'',border:OutlineInputBorder()),
              textInputAction:TextInputAction.newline)),
            IconButton(tooltip:'Send message',onPressed:()=>_send(actions),
              icon:const Icon(Icons.send)),
          ]))),
      ]),
    );
  }
}


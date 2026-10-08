import 'package:flutter/material.dart';
import 'human_dm_controller.dart';
import 'human_dm_models.dart';
import 'human_dm_transport.dart';

/// Self-contained C02 human thread. R17/C08 exclusively owns root route registration.
/// No local AI chat, fake messages, auto-mic, payments or public Talk stream.
class HumanDmThreadScreen extends StatefulWidget {
  const HumanDmThreadScreen({
    super.key,required this.conversationId,required this.otherDisplayName,
    required this.currentUserId,required this.transport,
  });
  final String conversationId,otherDisplayName,currentUserId;
  final HumanDmTransport transport;
  @override State<HumanDmThreadScreen> createState()=>_HumanDmThreadScreenState();
}
class _HumanDmThreadScreenState extends State<HumanDmThreadScreen> {
  late final HumanDmThreadController controller;
  final TextEditingController draft=TextEditingController();
  @override void initState() {
    super.initState();
    controller=HumanDmThreadController(conversationId:widget.conversationId,
      transport:widget.transport);
    controller.refresh();
  }
  @override void dispose(){controller.dispose();draft.dispose();super.dispose();}
  Future<void> send() async {
    final body=draft.text.trim();
    if(body.isEmpty)return;
    if(await controller.send(body) && mounted){draft.clear();}
  }
  Future<void> editMessage(HumanDmMessage message) async {
    final editor=TextEditingController(text:message.body);
    try{
      final value=await showDialog<String>(context:context,builder:(context)=>
        AlertDialog(title:const Text('Edit message'),
          content:TextField(controller:editor,maxLength:4000,minLines:1,maxLines:5,
            autofocus:true,decoration:const InputDecoration(labelText:'Message')),
          actions:[
            TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Cancel')),
            TextButton(onPressed:()=>Navigator.pop(context,editor.text.trim()),child:const Text('Save')),
          ]));
      if(value!=null && value.isNotEmpty){await controller.edit(message,value);}
    }finally{editor.dispose();}
  }
  Future<void> removeMessage(HumanDmMessage message) async {
    final sure=await showDialog<bool>(context:context,builder:(context)=>
      AlertDialog(title:const Text('Delete message?'),
        content:const Text('This removes the message for both people.'),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
          TextButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Delete')),
        ]));
    if(sure==true){await controller.delete(message);}
  }
  @override Widget build(BuildContext context){
    final theme=Theme.of(context);
    return Scaffold(
      appBar:AppBar(title:Text(widget.otherDisplayName),
        actions:[IconButton(icon:const Icon(Icons.refresh),
          tooltip:'Refresh conversation',onPressed:()=>controller.refresh())]),
      body:SafeArea(child:AnimatedBuilder(animation:controller,builder:(context,_){
        return Column(children:[
          if(controller.error!=null)
            MaterialBanner(content:Text(controller.error!),actions:[
              if(controller.pendingRequestId!=null)
                TextButton(onPressed:controller.sending?null:send,
                  child:const Text('Retry same message')),
              if(controller.pendingRequestId!=null)
                TextButton(onPressed:controller.sending?null:controller.discardPending,
                  child:const Text('Discard pending')),
              TextButton(onPressed:()=>controller.refresh(),child:const Text('Refresh')),
            ]),
          if(controller.loading)const LinearProgressIndicator(),
          if(controller.nextBefore!=null)
            TextButton(onPressed:controller.loadingOlder?null:controller.older,
              child:const Text('Load older messages')),
          Expanded(child:controller.messages.isEmpty && !controller.loading
            ? Center(child:Text(controller.error==null?'No messages yet. Say hello.':'Messages unavailable'))
            :ListView.builder(
              key:const ValueKey('human-dm-messages'),
              reverse:true,itemCount:controller.messages.length,
              itemBuilder:(context,i){
                final message=controller.messages[i];
                final self=message.senderUserId==widget.currentUserId;
                return Align(
                  alignment:self?Alignment.centerRight:Alignment.centerLeft,
                  child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:320),
                    child:Card(margin:const EdgeInsets.symmetric(horizontal:12,vertical:3),
                      color:self?theme.colorScheme.primaryContainer:theme.colorScheme.surfaceContainerHigh,
                      child:Padding(padding:const EdgeInsets.all(10),child:Column(
                        crossAxisAlignment:CrossAxisAlignment.start,
                        children:[
                          Text(message.deletedAt!=null?'Message deleted':message.body??'',
                            style:message.deletedAt!=null?const TextStyle(fontStyle:FontStyle.italic):null),
                          Text(message.createdAt.toLocal().toString().substring(0,16),
                            style:theme.textTheme.labelSmall),
                          if(message.editedAt!=null)
                            Text('Edited',style:theme.textTheme.labelSmall),
                          if(self && message.deletedAt==null)
                            Row(mainAxisSize:MainAxisSize.min,children:[
                              IconButton(icon:const Icon(Icons.edit_outlined,size:18),
                                tooltip:'Edit message',onPressed:()=>editMessage(message)),
                              IconButton(icon:const Icon(Icons.delete_outline,size:18),
                                tooltip:'Delete message',onPressed:()=>removeMessage(message)),
                            ]),
                        ])))));}
            )),
          if(controller.pendingRequestId!=null)
            Padding(padding:const EdgeInsets.symmetric(horizontal:12,vertical:4),
              child:Text(controller.sending?'Sending…':'Not yet sent: ${controller.pendingBody}',
                style:theme.textTheme.bodySmall)),
          Padding(padding:const EdgeInsets.all(8),
            child:Row(children:[
              Expanded(child:TextField(controller:draft,
                keyboardType:TextInputType.multiline,minLines:1,maxLines:5,
                maxLength:4000,textCapitalization:TextCapitalization.sentences,
                decoration:const InputDecoration(hintText:'Message',counterText:'',
                  border:OutlineInputBorder()),
                onSubmitted:(_)=>send())),
              IconButton.filled(icon:const Icon(Icons.send),tooltip:'Send text message',
                onPressed:controller.sending||controller.pendingRequestId!=null?null:send),
            ])),
        ]);
      })),
    );
  }
}

/// Server-backed inbox module for C08 integration. Person selection belongs to C01.
class HumanDmInboxScreen extends StatefulWidget {
  const HumanDmInboxScreen({super.key,required this.transport,required this.currentUserId});
  final HumanDmTransport transport;
  final String currentUserId;
  @override State<HumanDmInboxScreen> createState()=>_HumanDmInboxScreenState();
}
class _HumanDmInboxScreenState extends State<HumanDmInboxScreen>{
  late Future<List<HumanDmConversation>> conversations;
  @override void initState(){super.initState();conversations=widget.transport.inbox();}
  void refresh(){setState(()=>conversations=widget.transport.inbox());}
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Chats'),
      actions:[IconButton(icon:const Icon(Icons.refresh),tooltip:'Refresh chats',onPressed:refresh)]),
    body:FutureBuilder<List<HumanDmConversation>>(
      future:conversations,builder:(context,snapshot){
        if(!snapshot.hasData){
          if(snapshot.hasError)return Center(child:Column(
            mainAxisSize:MainAxisSize.min,children:[
              const Text('Could not load chats.'),TextButton(onPressed:refresh,child:const Text('Retry'))]));
          return const Center(child:CircularProgressIndicator());
        }
        final items=snapshot.data!;
        if(items.isEmpty)return const Center(child:Text('No conversations yet.'));
        return ListView.builder(itemCount:items.length,itemBuilder:(context,i){
          final item=items[i];
          return ListTile(
            title:Text(item.otherDisplayName),
            subtitle:Text(item.preview??'Message deleted',maxLines:1,
              overflow:TextOverflow.ellipsis),
            trailing:item.unreadCount>0?CircleAvatar(radius:14,
              child:Text('${item.unreadCount}')):null,
            onTap:() async {
              await Navigator.of(context).push(MaterialPageRoute<void>(
                builder:(_)=>HumanDmThreadScreen(
                  conversationId:item.conversationId,
                  otherDisplayName:item.otherDisplayName,
                  currentUserId:widget.currentUserId,transport:widget.transport)));
              if(mounted)refresh();
            },
          );
        });
      }),
  );
}

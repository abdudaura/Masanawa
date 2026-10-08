import 'package:flutter/material.dart';
import 'human_messages_controller.dart';
import 'human_messages_transport.dart';

/// Standalone C02 surface for R17/C08 to integrate with authenticated Chats.
/// Never aliases old AI `/chats` or accesses public Talk/Assistant history.
class HumanConversationScreen extends StatefulWidget {
  const HumanConversationScreen({super.key,required this.controller,required this.otherDisplayName});
  final HumanConversationController controller;
  final String otherDisplayName;
  @override
  State<HumanConversationScreen> createState()=>_HumanConversationScreenState();
}
class _HumanConversationScreenState extends State<HumanConversationScreen> {
  final TextEditingController _text=TextEditingController();
  @override
  void initState(){super.initState();widget.controller.open();}
  @override
  void dispose(){_text.dispose();super.dispose();}
  Future<void> _send() async {
    final draft=_text.text;
    final sent=await widget.controller.send(draft);
    if(sent&&mounted&&_text.text==draft)_text.clear();
  }
  Future<void> _edit(HumanMessageDto message) async {
    final input=TextEditingController(text:message.text);
    final next=await showDialog<String>(
      context:context,
      builder:(context)=>AlertDialog(
        title:const Text('Edit message'),
        content:TextField(controller:input,autofocus:true,maxLength:4000,maxLines:4,minLines:1),
        actions:[
          TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(context,input.text),child:const Text('Save')),
        ],
      ),
    );
    input.dispose();
    if(next==null||!mounted)return;
    try{await widget.controller.edit(message,next);}
    catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content:Text('Edit not confirmed. Refresh the conversation.')));}
  }
  Future<void> _remove(HumanMessageDto message) async {
    final approved=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(
      title:const Text('Delete your message?'),
      content:const Text('It will be removed from the conversation history.'),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Delete')),
      ],
    ));
    if(approved!=true||!mounted)return;
    try{await widget.controller.delete(message);}
    catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content:Text('Delete not confirmed. Refresh the conversation.')));}
  }
  Widget _bubble(HumanMessageDto message) {
    final own=message.senderUserId==widget.controller.ownerUserId;
    final theme=Theme.of(context);
    return Align(
      alignment:own?Alignment.centerRight:Alignment.centerLeft,
      child:ConstrainedBox(
        constraints:const BoxConstraints(maxWidth:310),
        child:Card(
          color:own?theme.colorScheme.primaryContainer:theme.colorScheme.surfaceContainerHigh,
          child:Padding(
            padding:const EdgeInsets.symmetric(horizontal:12,vertical:8),
            child:Column(crossAxisAlignment:CrossAxisAlignment.end,mainAxisSize:MainAxisSize.min,children:[
              Text(message.deleted?'Message deleted':message.text,
                style:message.deleted?const TextStyle(fontStyle:FontStyle.italic):null),
              const SizedBox(height:4),
              Row(mainAxisSize:MainAxisSize.min,children:[
                Text(TimeOfDay.fromDateTime(message.createdAt.toLocal()).format(context),
                  style:theme.textTheme.labelSmall),
                if(message.editedAt!=null)const Text(' · Edited'),
                if(own&&!message.deleted)
                  PopupMenuButton<String>(
                    tooltip:'Message actions',padding:EdgeInsets.zero,
                    icon:const Icon(Icons.more_vert,size:18),
                    onSelected:(action){
                      if(action=='edit')_edit(message);
                      if(action=='delete')_remove(message);
                    },
                    itemBuilder:(_)=>const [
                      PopupMenuItem(value:'edit',child:Text('Edit')),
                      PopupMenuItem(value:'delete',child:Text('Delete')),
                    ],
                  ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:AppBar(title:Text(widget.otherDisplayName)),
      body:SafeArea(child:AnimatedBuilder(animation:widget.controller,builder:(context,_) {
        final state=widget.controller;
        return Column(children:[
          if(state.loading)const LinearProgressIndicator(),
          if(state.error!=null)
            MaterialBanner(content:Text(state.error!),actions:[
              TextButton(onPressed:state.pending!=null
                ?state.retryPending:state.open,child:Text(state.pending!=null?'Retry message':'Retry')),
            ]),
          if(state.pending!=null)
            ListTile(key:const ValueKey('human-dm-pending'),leading:const Icon(Icons.schedule),
              title:const Text('Delivery not confirmed'),
              subtitle:Text(state.pending!.text,maxLines:2,overflow:TextOverflow.ellipsis),
              trailing:TextButton(onPressed:state.sending?null:state.retryPending,child:const Text('Retry'))),
          Expanded(child:ListView.builder(
            reverse:true,padding:const EdgeInsets.fromLTRB(12,8,12,8),
            itemCount:state.messages.length+(state.nextCursor==null?0:1),
            itemBuilder:(context,index){
              if(index==state.messages.length) {
                return Center(child:TextButton(
                  onPressed:state.loadingOlder?null:state.older,
                  child:Text(state.loadingOlder?'Loading…':'Load earlier messages'),
                ));
              }
              return _bubble(state.messages[index]);
            },
          )),
          Padding(
            padding:const EdgeInsets.fromLTRB(8,4,8,8),
            child:Row(children:[
              Expanded(child:TextField(
                key:const ValueKey('human-dm-compose'),controller:_text,
                minLines:1,maxLines:4,maxLength:4000,
                textCapitalization:TextCapitalization.sentences,
                decoration:const InputDecoration(
                  hintText:'Message',border:OutlineInputBorder(),counterText:'',
                ),
                onSubmitted:(_)=>_send(),
              )),
              IconButton.filled(
                key:const ValueKey('human-dm-send'),tooltip:'Send message',
                onPressed:state.sending||state.pending!=null?null:_send,
                icon:state.sending
                    ?const SizedBox(width:19,height:19,child:CircularProgressIndicator(strokeWidth:2))
                    :const Icon(Icons.send),
              ),
            ]),
          ),
        ]);
      })),
    );
  }
}

import 'package:flutter/material.dart';
import 'masana_chat_controller.dart';

/// Single compact composer; fan cannot message another fan or create a Room.
class MasanaChatScreen extends StatefulWidget {
  const MasanaChatScreen({
    super.key, required this.controller, required this.displayName,
    this.onAttach, this.onRecordVoice, this.voiceQualified = false,
  });
  final MasanaChatController controller;
  final String displayName;
  final VoidCallback? onAttach, onRecordVoice;
  final bool voiceQualified;
  @override
  State<MasanaChatScreen> createState() => _MasanaChatScreenState();
}
class _MasanaChatScreenState extends State<MasanaChatScreen> {
  final _composer=TextEditingController();
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _composer.addListener(_changed);
    widget.controller.restore();
  }
  void _changed() { if(mounted) setState((){}); }
  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _composer.removeListener(_changed);
    _composer.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final items=widget.controller.turns, ready=_composer.text.trim().isNotEmpty;
    return Scaffold(
      appBar:AppBar(title:Text(widget.displayName)),
      body:SafeArea(child:Column(children:[
        if(widget.controller.error!=null) MaterialBanner(
          content:Text(widget.controller.error!),
          actions:[TextButton(
            onPressed:()=>widget.controller.restore(),
            child:const Text('Retry'),
          )]),
        Expanded(child:items.isEmpty
          ? const Center(child:Text('Ask a question to begin'))
          : ListView.builder(
            padding:const EdgeInsets.all(12),itemCount:items.length,
            itemBuilder:(context,i){
              final m=items[i];
              return Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
                Align(alignment:Alignment.centerRight,
                  child:Card(child:Padding(
                    padding:const EdgeInsets.all(12),child:Text(m.text)))),
                if(m.state==ChatSendState.failed)
                  Align(alignment:Alignment.centerRight,
                    child:TextButton.icon(
                      onPressed:()=>widget.controller.retry(m.requestId),
                      icon:const Icon(Icons.refresh),
                      label:const Text('Retry message')))
                else if(m.state!=ChatSendState.sent)
                  const Align(alignment:Alignment.centerRight,
                    child:Text('Sending or queued…')),
                if(m.reply!=null) Align(alignment:Alignment.centerLeft,
                  child:Card(child:Padding(
                    padding:const EdgeInsets.all(12),child:Text(m.reply!)))),
              ]);
            })),
        Padding(padding:const EdgeInsets.fromLTRB(8,4,8,8),
          child:Row(children:[
            IconButton(
              tooltip:'Attach a file',onPressed:widget.onAttach,
              icon:const Icon(Icons.add_circle_outline)),
            Expanded(child:TextField(controller:_composer,maxLines:5,minLines:1,
              decoration:const InputDecoration(
                hintText:'Message',border:OutlineInputBorder()))),
            IconButton(
              tooltip:ready?'Send message':'Record voice message',
              onPressed:ready?(){
                final text=_composer.text;
                _composer.clear();
                widget.controller.send(text);
              }:widget.voiceQualified?widget.onRecordVoice:null,
              icon:Icon(ready?Icons.send:Icons.mic)),
          ])),
      ])),
    );
  }
}

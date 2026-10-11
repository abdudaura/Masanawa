import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'masana_chat_controller.dart';

/// Single compact composer; fan cannot message another fan or create a Room.
class MasanaChatScreen extends StatefulWidget {
  const MasanaChatScreen({
    super.key, required this.controller, required this.displayName,
    this.onAttach, this.onRecordVoice, this.onReportMessage,
    this.voiceQualified = false, this.hideQualified = false,
  });
  final MasanaChatController controller;
  final String displayName;
  final VoidCallback? onAttach, onRecordVoice;
  /// Use the existing Gwani moderation case journey, never a new report API.
  final Future<void> Function(String requestId, String body)? onReportMessage;
  final bool voiceQualified;
  /// C13 is unusable until the canonical hide route and 0006 schema are enabled.
  final bool hideQualified;
  @override
  State<MasanaChatScreen> createState() => _MasanaChatScreenState();
}
class _MasanaChatScreenState extends State<MasanaChatScreen> {
  final _composer=TextEditingController();
  final _composerFocus=FocusNode();
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _composer.addListener(_changed);
    widget.controller.restore();
  }
  void _changed() { if(mounted) setState((){}); }
  @override
  void didUpdateWidget(covariant MasanaChatScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.controller, widget.controller)) {
      oldWidget.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
      _composer.clear();
      widget.controller.restore();
    }
  }
  void _notice(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
  Future<void> _action(String action, MasanaChatTurn turn, {String? message}) async {
    final body=message ?? turn.text;
    if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: body));
      _notice('Copied');
    } else if (action == 'reply') {
      final quote=body.replaceAll(RegExp(r'[\r\n]+'), ' ');
      _composer.text='> ' + (quote.length > 180
        ? quote.substring(0, 180) + '…' : quote) + '\n\n';
      _composer.selection=TextSelection.collapsed(offset:_composer.text.length);
      _composerFocus.requestFocus();
    } else if (action == 'hide' && widget.hideQualified) {
      final confirmed=await showDialog<bool>(context:context,builder:(dialogContext)=>
        AlertDialog(
          title:const Text('Remove this message for me?'),
          content:const Text('It will be hidden from your chat. Service records are retained.'),
          actions:[
            TextButton(onPressed:()=>Navigator.pop(dialogContext,false),
              child:const Text('Cancel')),
            TextButton(onPressed:()=>Navigator.pop(dialogContext,true),
              child:const Text('Remove')),
          ]));
      if(confirmed!=true || !mounted) return;
      final owner=widget.controller;
      final ok=await owner.hideSentTurn(turn.requestId);
      if(!mounted || !identical(owner,widget.controller)) return;
      _notice(ok?'Message hidden for you':'Message not removed. Retry when connected.');
    } else if (action == 'report' && widget.onReportMessage!=null) {
      try { await widget.onReportMessage!(turn.requestId,body); }
      catch (_) { _notice('Could not open Gwani report. Try again.'); }
    }
  }
  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _composer.removeListener(_changed);
    _composer.dispose();
    _composerFocus.dispose();
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
                    padding:const EdgeInsets.all(12),
                    child:Column(mainAxisSize:MainAxisSize.min,
                      crossAxisAlignment:CrossAxisAlignment.end,children:[
                        Text(m.text),
                        if(m.state==ChatSendState.sent)
                          PopupMenuButton<String>(
                            tooltip:'Message actions',
                            onSelected:(value)=>_action(value,m),
                            itemBuilder:(context)=>[
                              const PopupMenuItem(value:'reply',child:Text('Reply')),
                              const PopupMenuItem(value:'copy',child:Text('Copy')),
                              if(widget.hideQualified)
                                const PopupMenuItem(value:'hide',child:Text('Remove for me')),
                              if(widget.onReportMessage!=null)
                                const PopupMenuItem(value:'report',child:Text('Report to Gwani')),
                            ]),
                      ])))),
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
                    padding:const EdgeInsets.all(12),
                    child:Column(mainAxisSize:MainAxisSize.min,
                      crossAxisAlignment:CrossAxisAlignment.end,children:[
                        Text(m.reply!),
                        PopupMenuButton<String>(
                          tooltip:'Masana reply actions',
                          onSelected:(action)=>_action(action,m,message:m.reply),
                          itemBuilder:(context)=>[
                            const PopupMenuItem(value:'reply',child:Text('Reply')),
                            const PopupMenuItem(value:'copy',child:Text('Copy')),
                            if(widget.onReportMessage!=null)
                              const PopupMenuItem(value:'report',child:Text('Report to Gwani')),
                          ]),
                      ])))),
              ]);
            })),
        Padding(padding:const EdgeInsets.fromLTRB(8,4,8,8),
          child:Row(children:[
            IconButton(
              tooltip:'Attach a file',onPressed:widget.onAttach,
              icon:const Icon(Icons.add_circle_outline)),
            Expanded(child:TextField(controller:_composer,focusNode:_composerFocus,maxLines:5,minLines:1,
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

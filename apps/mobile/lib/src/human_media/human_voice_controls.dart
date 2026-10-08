import 'dart:async';
import 'package:flutter/material.dart';
import 'human_voice_controller.dart';
import 'human_voice_transport.dart';

/// Human-only voice note controls for insertion into the authorized C02 thread.
/// No microphone opens automatically. Text composer remains independently usable.
class HumanVoiceNotesPanel extends StatefulWidget {
  const HumanVoiceNotesPanel({
    super.key,required this.conversationId,required this.currentUserId,
    required this.transport,this.capture,this.player,this.privatePath,
  });
  final String conversationId,currentUserId;
  final HumanVoiceTransport transport;
  final HumanVoiceCapture? capture;
  final HumanVoicePlayer? player;
  final Future<String> Function()? privatePath;
  @override State<HumanVoiceNotesPanel> createState()=>_HumanVoiceNotesPanelState();
}
class _HumanVoiceNotesPanelState extends State<HumanVoiceNotesPanel> {
  late HumanVoiceController controller;
  @override void initState(){
    super.initState();
    _create();
  }
  void _create(){
    controller=HumanVoiceController(
      conversationId:widget.conversationId,ownerUserId:widget.currentUserId,
      transport:widget.transport,capture:widget.capture,
      player:widget.player,privatePath:widget.privatePath,
    )..addListener(_update);
    unawaited(controller.refresh());
  }
  void _update(){if(mounted)setState((){});}
  @override void didUpdateWidget(covariant HumanVoiceNotesPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if(oldWidget.conversationId!=widget.conversationId||
       oldWidget.currentUserId!=widget.currentUserId||
       !identical(oldWidget.transport,widget.transport)||
       !identical(oldWidget.player,widget.player)||
       !identical(oldWidget.privatePath,widget.privatePath)){
      final previous=controller;
      previous.removeListener(_update);
      unawaited(previous.shutdown());
      _create();
    }
  }
  @override void dispose(){
    controller.removeListener(_update);
    unawaited(controller.shutdown());
    super.dispose();
  }
  @override Widget build(BuildContext context){
    final controls=controller;
    return Column(mainAxisSize:MainAxisSize.min,children:[
      if(controls.error!=null)
        Padding(padding:const EdgeInsets.all(6),child:Row(children:[
          const Icon(Icons.error_outline,size:18),
          Expanded(child:Text(controls.error!,
            style:TextStyle(color:Theme.of(context).colorScheme.error))),
          IconButton(
            tooltip:'Retry loading voice notes',icon:const Icon(Icons.refresh),
            onPressed:controls.loading?null:()=>controls.refresh(),
          ),
        ])),
      if(controls.notes.isNotEmpty)
        SizedBox(height:160,child:ListView.builder(
          itemCount:controls.notes.length,
          itemBuilder:(context,index){
            final note=controls.notes[index],mine=note.senderUserId==widget.currentUserId;
            final seconds=(note.durationMs/1000).round();
            return ListTile(
              dense:true,
              leading:Icon(mine?Icons.mic:Icons.record_voice_over_outlined),
              title:Text('${mine?"You":"Voice message"} · ${seconds}s'),
              subtitle:Text(note.createdAt.toLocal().toString().substring(0,16)),
              trailing:Row(mainAxisSize:MainAxisSize.min,children:[
                IconButton(
                  tooltip:controls.playingMessageId==note.messageId
                      ?'Stop private voice playback':'Play private voice note',
                  icon:Icon(controls.playingMessageId==note.messageId
                      ?Icons.stop_circle_outlined:Icons.play_arrow),
                  onPressed:controls.playingMessageId==note.messageId
                      ?controls.stopPlayback
                      :controls.playing?null:()=>controls.play(note),
                ),
                if(mine)IconButton(
                  tooltip:'Delete your voice note',icon:const Icon(Icons.delete_outline),
                  onPressed:()=>_confirmDelete(note.messageId,index),
                ),
              ]),
            );
          },
        )),
      if(controls.canLoadOlder&&!controls.loading)
        TextButton.icon(
          onPressed:controls.older,icon:const Icon(Icons.history),
          label:const Text('Load older voice notes'),
        ),
      if(controls.loading)
        const LinearProgressIndicator(minHeight:2),
      if(controls.recording)
        Row(children:[
          const Expanded(child:Text('Recording privately · maximum 90 seconds')),
          IconButton.filled(
            tooltip:'Stop and review recording',icon:const Icon(Icons.stop),
            onPressed:controls.stop,
          ),
        ])
      else if(controls.review)
        Row(children:[
          IconButton(
            tooltip:'Discard recording',icon:const Icon(Icons.close),
            onPressed:controls.sending?null:controls.discard,
          ),
          IconButton(
            tooltip:controls.playing
                ?'Stop recording preview':'Preview recording',
            icon:Icon(controls.playing
                ?Icons.stop_circle_outlined:Icons.play_circle_outline),
            onPressed:controls.sending?null:
                controls.playing?controls.stopPlayback:controls.preview,
          ),
          const Expanded(child:Text('Review before sending')),
          IconButton.filled(
            tooltip:'Send private voice note',icon:controls.sending
              ?const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2))
              :const Icon(Icons.send),
            onPressed:controls.canSend?controls.send:null,
          ),
        ])
      else
        Align(alignment:Alignment.centerRight,
          child:IconButton(
            tooltip:'Record private voice note',
            icon:const Icon(Icons.mic_none),
            onPressed:controls.loading?null:controls.begin,
          )),
    ]);
  }
  Future<void> _confirmDelete(String id,int index) async {
    final note=controller.notes.where((n)=>n.messageId==id).firstOrNull;
    if(note==null||!mounted)return;
    final approved=await showDialog<bool>(context:context,builder:(dialogContext)=>AlertDialog(
      title:const Text('Delete voice note?'),
      content:const Text('People in this conversation will no longer be able to play it.'),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(dialogContext,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialogContext,true),child:const Text('Delete')),
      ],
    ));
    if(approved==true&&!controller.closed)await controller.delete(note);
  }
}

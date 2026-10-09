import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'human_call_controller.dart';
import 'human_call_models.dart';
import 'human_call_room.dart';
import 'human_call_transport.dart';

/// Deliberately requires a human tap via Answer or explicit media Retry.
/// No camera/mic permission is requested merely by entering Chats.
Future<bool> requestHumanCallPermissions(HumanCallKind kind) async {
  final microphone=await Permission.microphone.request();
  if(!microphone.isGranted)return false;
  if(kind==HumanCallKind.video) {
    final camera=await Permission.camera.request();
    if(!camera.isGranted)return false;
  }
  return true;
}

/// Nested Chats route; never push as a sixth bottom destination.
/// Root router/C02 integrator owns the actual route mapping.
class HumanCallScreen extends StatelessWidget {
  const HumanCallScreen({
    super.key,required this.controller,required this.peerName,
  });
  final HumanCallController controller;
  final String peerName;

  Widget _control(BuildContext context,IconData icon,String label,VoidCallback? onTap) {
    return Column(mainAxisSize:MainAxisSize.min,children:[
      IconButton.filledTonal(
        onPressed:onTap,tooltip:label,
        icon:Icon(icon),iconSize:28,
        style:IconButton.styleFrom(minimumSize:const Size(56,56)),
      ),
      const SizedBox(height:4),
      Text(label,style:Theme.of(context).textTheme.labelMedium),
    ]);
  }

  Widget? _video(Room room,bool local) {
    final participants=local
        ? <Participant>[if(room.localParticipant!=null)room.localParticipant!]
        : room.remoteParticipants.values.toList();
    for(final person in participants) {
      for(final publication in person.videoTrackPublications) {
        final track=publication.track;
        if(track is VideoTrack && !publication.muted) {
          return VideoTrackRenderer(track,fit:VideoViewFit.cover);
        }
      }
    }
    return null;
  }

  Widget _visual(BuildContext context,HumanCall call) {
    final liveRoom=controller.room;
    final room=liveRoom is LiveKitHumanCallRoom?liveRoom.room:null;
    if(call.kind==HumanCallKind.video && room!=null && controller.connected) {
      return AnimatedBuilder(
        animation:room,
        builder:(context,_) {
          final remote=_video(room,false);
          final local=_video(room,true);
          return Stack(fit:StackFit.expand,children:[
            remote ?? _face(context,peerName,'Remote camera off'),
            if(local!=null)
              Positioned(
                right:16,top:16,width:112,height:158,
                child:ClipRRect(
                  borderRadius:BorderRadius.circular(12),child:local,
                ),
              ),
          ]);
        },
      );
    }
    return _face(context,peerName,
      call.state==HumanCallState.ringing
        ?(controller.isIncoming?'Incoming private call':'Calling…')
        :controller.connected?'Connected':'Connecting…');
  }

  Widget _face(BuildContext context,String name,String subtitle) {
    final size=MediaQuery.sizeOf(context);
    return Center(child:ConstrainedBox(
      constraints:BoxConstraints(maxWidth:size.width-32),
      child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[
        CircleAvatar(
          radius:52,child:Text(name.trim().isEmpty?'?':name.trim()[0].toUpperCase(),
            style:Theme.of(context).textTheme.displayMedium),
        ),
        const SizedBox(height:20),
        Text(name,textAlign:TextAlign.center,
          style:Theme.of(context).textTheme.headlineMedium,
          maxLines:2,overflow:TextOverflow.ellipsis),
        const SizedBox(height:10),
        Text(subtitle,textAlign:TextAlign.center),
      ]),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation:controller,
      builder:(context,_) {
        final call=controller.call;
        return WillPopScope(
          onWillPop:() async {
            if(call!=null && !call.terminal) {
              if(controller.isIncoming && call.state==HumanCallState.ringing) {
                await controller.decline();
              } else {
                await controller.end();
              }
            }
            return true;
          },
          child:Scaffold(
          appBar:AppBar(
            title:Text(call?.kind==HumanCallKind.video?'Private video call':'Private voice call'),
            leading:IconButton(
              tooltip:'Return to chat',
              onPressed:() async {
                if(call!=null && !call.terminal) {
                  if(controller.isIncoming && call.state==HumanCallState.ringing) {
                    await controller.decline();
                  } else {
                    await controller.end();
                  }
                }
                if(context.mounted) Navigator.of(context).maybePop();
              },
              icon:const Icon(Icons.arrow_back),
            ),
          ),
          body:SafeArea(child:Column(children:[
            Expanded(child:call==null
              ?Center(child:Text(controller.error??'Loading private call…'))
              :_visual(context,call)),
            if(controller.error!=null)
              Padding(padding:const EdgeInsets.all(12),
                child:Semantics(liveRegion:true,child:Text(controller.error!,
                  textAlign:TextAlign.center,
                  style:TextStyle(color:Theme.of(context).colorScheme.error)))),
            const SizedBox(height:8),
            if(call!=null && !call.terminal)
              Padding(
                padding:const EdgeInsets.symmetric(horizontal:12,vertical:16),
                child:Wrap(alignment:WrapAlignment.center,
                  spacing:22,runSpacing:14,children:[
                    if(call.state==HumanCallState.ringing &&
                       controller.isIncoming)...[
                      _control(context,Icons.call,'Answer',
                        controller.busy?null:()=>controller.accept()),
                      _control(context,Icons.call_end,'Decline',
                        controller.busy?null:()=>controller.decline()),
                    ]else if(call.state==HumanCallState.ringing)
                      _control(context,Icons.call_end,'Cancel',
                        controller.busy?null:()=>controller.end()),
                    if(call.state==HumanCallState.active)...[
                      _control(context,
                        controller.muted?Icons.mic_off:Icons.mic,
                        controller.muted?'Unmute':'Mute',
                        controller.connected?()=>controller.setMuted(!controller.muted):null),
                      if(call.kind==HumanCallKind.video)...[
                        _control(context,
                          controller.cameraEnabled?Icons.videocam:Icons.videocam_off,
                          controller.cameraEnabled?'Camera off':'Camera on',
                          controller.connected
                            ?()=>controller.setCamera(!controller.cameraEnabled):null),
                        _control(context,Icons.flip_camera_android,'Flip camera',
                          controller.cameraEnabled?()=>controller.flipCamera():null),
                      ],
                      _control(context,
                        controller.speakerEnabled?Icons.volume_up:Icons.hearing,
                        controller.speakerEnabled?'Earpiece':'Speaker',
                        controller.connected
                          ?()=>controller.setSpeaker(!controller.speakerEnabled):null),
                      if(!controller.connected && !controller.joining)
                        _control(context,Icons.refresh,'Retry media',
                          ()=>controller.retryMedia()),
                      _control(context,Icons.call_end,'End call',
                        controller.busy?null:()=>controller.end()),
                    ],
                  ],
                ),
              ),
            if(call?.terminal==true)
              Padding(padding:const EdgeInsets.all(16),
                child:Column(children:[
                  Text('Call ${call!.state.name}',style:Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height:12),
                  FilledButton.icon(
                    onPressed:()=>Navigator.of(context).maybePop(),
                    icon:const Icon(Icons.chat),label:const Text('Return to chat')),
                ])),
          ])),
        ));
      },
    );
  }
}

/// Minimal accurate server-backed history. Requires current account to fetch;
/// no on-device stale profile cache and no fictional "delivered" status.
class HumanCallsHistoryScreen extends StatefulWidget {
  const HumanCallsHistoryScreen({
    super.key,required this.transport,
    required this.isCurrentSession,
    required this.currentUserId,
    required this.onOpenCall,
  });
  final HumanCallTransport transport;
  final bool Function() isCurrentSession;
  final String currentUserId;
  final void Function(HumanCall call) onOpenCall;

  @override
  State<HumanCallsHistoryScreen> createState()=>_HumanCallsHistoryScreenState();
}
class _HumanCallsHistoryScreenState extends State<HumanCallsHistoryScreen> {
  List<HumanCall>? calls;
  String? error;
  int epoch=0;
  @override
  void initState(){super.initState();_load();}
  Future<void> _load() async {
    final my=++epoch;
    setState((){error=null;});
    try {
      final result=await widget.transport.recent();
      if(!mounted||my!=epoch||!widget.isCurrentSession())return;
      setState(()=>calls=result);
    } catch (_) {
      if(!mounted||my!=epoch)return;
      setState((){calls=null;error='Calls unavailable. Check connection or sign in.';});
    }
  }
  @override
  void dispose(){epoch++;super.dispose();}
  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Calls'),actions:[
      IconButton(tooltip:'Refresh calls',onPressed:_load,
        icon:const Icon(Icons.refresh)),
    ]),
    body:!widget.isCurrentSession()
      ?const Center(child:Text('Sign in to view your calls.'))
      :error!=null
        ?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          Text(error!),TextButton(onPressed:_load,child:const Text('Retry')),
        ]))
        :calls==null
          ?const Center(child:CircularProgressIndicator())
          :calls!.isEmpty
            ?const Center(child:Text('No private calls yet.'))
            :ListView.builder(
              itemCount:calls!.length,
              itemBuilder:(context,index){
                final call=calls![index],outgoing=call.callerUserId==widget.currentUserId;
                return ListTile(
                  leading:Icon(call.kind==HumanCallKind.video?Icons.videocam:Icons.call),
                  title:Text(outgoing?'Outgoing ${call.kind.name} call':'Incoming ${call.kind.name} call'),
                  subtitle:Text('${call.state.name} · ${call.createdAt.toLocal()}',
                    maxLines:1,overflow:TextOverflow.ellipsis),
                  trailing:const Icon(Icons.chevron_right),
                  onTap:()=>widget.onOpenCall(call),
                );
              },
            ),
  );

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'masana_call_api.dart';

abstract class MasanaCallMedia {
  Future<void> connect(String url,String token);
  Future<void> microphone(bool enabled);
  Future<void> speaker(bool enabled);
  Future<void> disconnect();
}
class LiveKitMasanaCallMedia implements MasanaCallMedia {
  final Room _room=Room();
  @override Future<void> connect(String url,String token) async {
    await _room.connect(url,token);
  }
  @override Future<void> microphone(bool enabled) async {
    await _room.localParticipant?.setMicrophoneEnabled(enabled);
  }
  @override Future<void> speaker(bool enabled) async {
    await _room.setSpeakerOn(enabled);
  }
  @override Future<void> disconnect() async {
    await _room.disconnect();
    await _room.dispose();
  }
}
enum MasanaCallPhase { permission, connecting, active, ending, ended, error }

/// AF00 wires this into the Masana profile and shared audio-focus authority.
class MasanaCallScreen extends StatefulWidget {
  const MasanaCallScreen({
    super.key, required this.api, required this.characterId,
    required this.displayName, this.mediaFactory, this.askMicrophone,
  });
  final MasanaCallApi api;
  final String characterId, displayName;
  final MasanaCallMedia Function()? mediaFactory;
  final Future<bool> Function()? askMicrophone;
  @override State<MasanaCallScreen> createState()=>_MasanaCallScreenState();
}
class _MasanaCallScreenState extends State<MasanaCallScreen> {
  MasanaCallPhase phase=MasanaCallPhase.permission;
  MasanaCallMedia? media;
  String? callId, error;
  bool muted=false, speakerOn=false, starting=false;
  DateTime? connectedAt, deadline;
  Timer? ticker;
  int seconds=0;
  @override void initState() {super.initState();_start();}
  Future<void> _start() async {
    if(starting || phase==MasanaCallPhase.active) return;
    starting=true;
    _set(next:MasanaCallPhase.permission);
    try {
      final granted=await (widget.askMicrophone?.call() ??
        Permission.microphone.request().then((s)=>s.isGranted));
      if (!granted) {
        _set(next:MasanaCallPhase.error,message:'Microphone permission denied. Allow access in Settings.');
        return;
      }
      if(!mounted) return;
      _set(next:MasanaCallPhase.connecting);
      final ticket=await widget.api.start(widget.characterId,MasanaCallApi.makeRequestId());
      callId=ticket.callId; deadline=ticket.expiresAt;
      if(!mounted) {await widget.api.end(ticket.callId);return;}
      if(!ticket.expiresAt.isAfter(DateTime.now())) throw StateError('Call expired');
      final connection=widget.mediaFactory?.call() ?? LiveKitMasanaCallMedia();
      media=connection;
      await connection.connect(ticket.url,ticket.token);
      await connection.microphone(true);
      await widget.api.connected(ticket.callId);
      if(!mounted) {await _disconnect();return;}
      connectedAt=DateTime.now();
      _set(next:MasanaCallPhase.active);
      ticker?.cancel();
      ticker=Timer.periodic(const Duration(seconds:1),(_){
        if(!mounted || phase!=MasanaCallPhase.active) return;
        final until=deadline;
        if(until!=null && !until.isAfter(DateTime.now())) { _end();return; }
        setState(()=>seconds=DateTime.now().difference(connectedAt!).inSeconds);
      });
    } catch (_) {
      await _disconnect();
      _set(next:MasanaCallPhase.error,message:'Call unavailable. Check connection and try again.');
    } finally {starting=false;}
  }
  void _set({required MasanaCallPhase next,String? message}) {
    if(!mounted) return;
    setState((){phase=next;error=message;});
  }
  Future<void> _disconnect() async {
    ticker?.cancel();ticker=null;
    final connection=media;media=null;
    try {await connection?.disconnect();} catch (_) {}
    final id=callId;callId=null;
    if(id!=null) {try {await widget.api.end(id);} catch (_) {/* expiry worker */}}
  }
  Future<void> _end() async {
    if(phase==MasanaCallPhase.ending || phase==MasanaCallPhase.ended) return;
    _set(next:MasanaCallPhase.ending);
    await _disconnect();
    _set(next:MasanaCallPhase.ended);
  }
  Future<void> _mute() async {
    if(phase!=MasanaCallPhase.active) return;
    try {
      await media?.microphone(muted);
      if(mounted) setState(()=>muted=!muted);
    } catch (_) {_set(next:MasanaCallPhase.error,message:'Microphone unavailable. End or retry.');}
  }
  Future<void> _speaker() async {
    if(phase!=MasanaCallPhase.active) return;
    try {
      await media?.speaker(!speakerOn);
      if(mounted) setState(()=>speakerOn=!speakerOn);
    } catch (_) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content:Text('Speaker selection unavailable')));
    }
  }
  @override void dispose() {
    ticker?.cancel();
    unawaited(_disconnect());
    super.dispose();
  }
  @override Widget build(BuildContext context) {
    final active=phase==MasanaCallPhase.active;
    final countdown=deadline==null?null:deadline!.difference(DateTime.now()).inSeconds;
    final status=switch(phase) {
      MasanaCallPhase.permission=>'Checking microphone permission…',
      MasanaCallPhase.connecting=>'Connecting securely…',
      MasanaCallPhase.active=>'Connected · ' + Duration(seconds:seconds).toString().substring(2,7),
      MasanaCallPhase.ending=>'Ending call…',
      MasanaCallPhase.ended=>'Call ended',
      MasanaCallPhase.error=>error??'Call unavailable',
    };
    return Scaffold(
      appBar:AppBar(title:Text(widget.displayName)),
      body:SafeArea(child:Padding(
        padding:const EdgeInsets.all(24),
        child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[
          const Icon(Icons.support_agent,size:86),
          const SizedBox(height:16),
          Text(widget.displayName,style:Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height:12),
          Text(status,textAlign:TextAlign.center),
          if(active && countdown!=null && countdown<=60)
            const Padding(padding:EdgeInsets.all(12),
              child:Text('Call budget almost finished')),
          const SizedBox(height:36),
          if(active) Row(mainAxisAlignment:MainAxisAlignment.center,children:[
            IconButton.filledTonal(
              tooltip:muted?'Unmute microphone':'Mute microphone',
              onPressed:_mute,icon:Icon(muted?Icons.mic_off:Icons.mic)),
            const SizedBox(width:24),
            IconButton.filledTonal(tooltip:'Toggle speaker',onPressed:_speaker,
              icon:Icon(speakerOn?Icons.volume_up:Icons.hearing)),
          ]),
          const SizedBox(height:24),
          if(phase==MasanaCallPhase.error)
            FilledButton(onPressed:_start,child:const Text('Try again')),
          FilledButton.icon(
            onPressed:phase==MasanaCallPhase.ending || phase==MasanaCallPhase.ended
              ?null:_end,
            icon:const Icon(Icons.call_end),label:const Text('End call')),
          const SizedBox(height:12),
          const Text('You are speaking to a Masanawa AI professional.',
            textAlign:TextAlign.center),
        ]),
      )),
    );
  }
}

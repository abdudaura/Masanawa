import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'human_call_models.dart';
import 'human_call_transport.dart';

/// Embed only in canonical C02 human chat header after C01 accepted contact
/// state; F12/C08 owns mounting. There is no sixth Calls tab.
class HumanCallChatActions extends StatelessWidget {
  const HumanCallChatActions({
    super.key,required this.canCall,required this.onVoice,required this.onVideo,
  });
  final bool canCall;
  final VoidCallback onVoice;
  final VoidCallback onVideo;

  @override
  Widget build(BuildContext context)=>Row(mainAxisSize:MainAxisSize.min,children:[
    IconButton(
      tooltip:canCall?'Voice call':'Voice call unavailable',
      onPressed:canCall?onVoice:null,
      icon:const Icon(Icons.call),
    ),
    IconButton(
      tooltip:canCall?'Video call':'Video call unavailable',
      onPressed:canCall?onVideo:null,
      icon:const Icon(Icons.videocam),
    ),
  ]);
}

/// Foreground Chats polling fallback. R14 FCM is only an opaque wakeup hint;
/// this authenticated readback decides if an incoming invitation still exists.
/// NEVER run in an app-killed isolate or continue after account switch.
class HumanIncomingCallWatcher extends ChangeNotifier {
  HumanIncomingCallWatcher({
    required this.transport,required this.currentUserId,
    required this.isCurrentSession,
    this.interval=const Duration(seconds:5),
  });
  final HumanCallTransport transport;
  final String currentUserId;
  final bool Function() isCurrentSession;
  final Duration interval;
  HumanCall? incoming;
  bool _stopped=true;
  bool _disposed=false;
  Timer? _timer;
  Future<void>? _inflight;
  int _epoch=0;

  bool get active=>!_disposed&&!_stopped&&isCurrentSession();
  void start() {
    if(_disposed||!isCurrentSession())return;
    if(!_stopped)return;
    _stopped=false;
    unawaited(refresh());
    _timer=Timer.periodic(interval,(_)=>unawaited(refresh()));
  }
  void stop() {
    _stopped=true;_epoch++;
    _timer?.cancel();_timer=null;
    incoming=null;
    if(!_disposed)notifyListeners();
  }
  Future<void> refresh() {
    if(!active)return Future<void>.value();
    if(_inflight!=null)return _inflight!;
    late final Future<void> next;
    next=_load().whenComplete((){
      if(identical(_inflight,next))_inflight=null;
    });
    _inflight=next;
    return next;
  }
  Future<void> _load() async {
    final epoch=_epoch;
    try {
      final calls=await transport.recent();
      if(!active||epoch!=_epoch)return;
      final candidates=calls.where((call)=>
        call.calleeUserId==currentUserId &&
        call.state==HumanCallState.ringing,
      ).toList()..sort((a,b)=>b.createdAt.compareTo(a.createdAt));
      incoming=candidates.isEmpty?null:candidates.first;
      notifyListeners();
    } catch (_) {
      // Network uncertainty is not a valid invitation. A stale invitation
      // must disappear, never produce a phantom ringtone or auto-answer.
      if(active&&epoch==_epoch) {
        incoming=null;
        notifyListeners();
      }
    }
  }
  @override
  void dispose() {
    _disposed=true;_stopped=true;_epoch++;
    _timer?.cancel();_timer=null;incoming=null;
    super.dispose();
  }
}

class HumanIncomingCallBanner extends StatelessWidget {
  const HumanIncomingCallBanner({
    super.key,required this.watcher,required this.peerName,
    required this.onViewCall,
  });
  final HumanIncomingCallWatcher watcher;
  final String peerName;
  final void Function(String callId) onViewCall;
  @override
  Widget build(BuildContext context)=>AnimatedBuilder(
    animation:watcher,builder:(context,_) {
      final incoming=watcher.incoming;
      if(incoming==null)return const SizedBox.shrink();
      return Semantics(
        liveRegion:true,
        child:Card(
          child:ListTile(
            leading:Icon(incoming.kind==HumanCallKind.video?Icons.videocam:Icons.call),
            title:Text('Incoming ${incoming.kind.name} call'),
            subtitle:Text(peerName),
            trailing:FilledButton(
              onPressed:()=>onViewCall(incoming.callId),
              child:const Text('View call'),
            ),
          ),
        ),
      );
    },
  );
}

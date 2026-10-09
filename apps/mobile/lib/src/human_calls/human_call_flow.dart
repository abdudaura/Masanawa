import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'human_call_controller.dart';
import 'human_call_entries.dart';
import 'human_call_models.dart';
import 'human_call_room.dart';
import 'human_call_screens.dart';
import 'human_call_transport.dart';

final humanCallTransportProvider=Provider<HumanCallTransport>(
  (ref)=>GatewayHumanCallTransport(ref.watch(apiClientProvider)),
);

/// Root-router entry, not another nav tab. No media is created on page build:
/// a deliberate outgoing dial / incoming Answer precedes every mic/camera use.
class HumanCallFlowScreen extends ConsumerStatefulWidget {
  const HumanCallFlowScreen({
    super.key,this.callId,this.conversationId,this.kind,this.peerName='Private contact',
  });
  final String? callId;
  final String? conversationId;
  final HumanCallKind? kind;
  final String peerName;
  @override
  ConsumerState<HumanCallFlowScreen> createState()=>_HumanCallFlowScreenState();
}
class _HumanCallFlowScreenState extends ConsumerState<HumanCallFlowScreen> {
  HumanCallController? _call;
  @override
  void initState(){
    super.initState();
    final principal=ref.read(sessionProvider);
    if(principal is! SessionSignedIn)return;
    final userId=principal.user.id;
    final call=HumanCallController(
      currentUserId:userId,
      transport:ref.read(humanCallTransportProvider),
      room:LiveKitHumanCallRoom(),
      isCurrentSession:(){
        final state=ref.read(sessionProvider);
        return state is SessionSignedIn && state.user.id==userId;
      },
      requestPermissions:requestHumanCallPermissions,
    );
    _call=call;
    // Only an explicitly submitted dial opens a server call. Incoming route
    // always performs fresh authenticated readback, never trusts FCM content.
    WidgetsBinding.instance.addPostFrameCallback((_){
      if(!mounted)return;
      if(widget.callId!=null) {
        unawaited(call.load(widget.callId!));
      }else if(widget.conversationId!=null && widget.kind!=null) {
        unawaited(call.start(widget.conversationId!,widget.kind!));
      }
    });
  }
  @override
  void dispose(){_call?.dispose();super.dispose();}
  @override
  Widget build(BuildContext context){
    final user=ref.watch(sessionProvider);
    final call=_call;
    if(user is! SessionSignedIn || call==null || call.currentUserId!=user.user.id){
      return const Scaffold(body:Center(child:Text('Sign in to open private calls.')));
    }
    return HumanCallScreen(controller:call,peerName:widget.peerName);
  }
}

/// A call tap checks real Gateway capability first; do not issue a network
/// request merely because a historical human thread was opened. This also
/// keeps existing human chat widget tests offline and unaffected by C09.
class HumanDmCallButtons extends ConsumerWidget {
  const HumanDmCallButtons({super.key,required this.conversationId});
  final String conversationId;

  Future<void> _dial(BuildContext context,WidgetRef ref,HumanCallKind kind) async {
    try{
      await ref.read(humanCallTransportProvider).recent();
    } catch (_) {
      if(context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content:Text('Private calling is currently unavailable. Try again later.')));
      }
      return;
    }
    if(!context.mounted || ref.read(sessionProvider) is! SessionSignedIn)return;
    context.push('/messages/calls/new?conversationId=${Uri.encodeComponent(conversationId)}&kind=${kind.name}');
  }

  @override
  Widget build(BuildContext context,WidgetRef ref){
    final enabled=ref.watch(sessionProvider) is SessionSignedIn;
    return HumanCallChatActions(
      canCall:enabled,
      onVoice:()=>_dial(context,ref,HumanCallKind.audio),
      onVideo:()=>_dial(context,ref,HumanCallKind.video),
    );
  }
}

/// Single authenticated foreground Chats poller. It is stopped on dispose,
/// account switch, logout or moving away from this root. Background ringing
/// remains FCM-only and must be qualified on real devices.
class HumanCallIncomingStrip extends ConsumerStatefulWidget {
  const HumanCallIncomingStrip({super.key});
  @override
  ConsumerState<HumanCallIncomingStrip> createState()=>_HumanCallIncomingStripState();
}
class _HumanCallIncomingStripState extends ConsumerState<HumanCallIncomingStrip> {
  HumanIncomingCallWatcher? watcher;
  @override
  void initState(){
    super.initState();
    final state=ref.read(sessionProvider);
    if(state is! SessionSignedIn)return;
    final userId=state.user.id;
    watcher=HumanIncomingCallWatcher(
      transport:ref.read(humanCallTransportProvider),
      currentUserId:userId,
      isCurrentSession:(){
        final session=ref.read(sessionProvider);
        return session is SessionSignedIn&&session.user.id==userId;
      },
    )..start();
  }
  @override
  void dispose(){watcher?.dispose();super.dispose();}
  @override
  Widget build(BuildContext context){
    final current=ref.watch(sessionProvider);
    final active=watcher;
    if(active==null || current is! SessionSignedIn ||
       current.user.id!=active.currentUserId)return const SizedBox.shrink();
    return HumanIncomingCallBanner(
      watcher:active,peerName:'Private contact',
      onViewCall:(id)=>context.push('/messages/calls/${Uri.encodeComponent(id)}'),
    );
  }
}

class HumanCallsHistoryRoute extends ConsumerWidget {
  const HumanCallsHistoryRoute({super.key});
  @override
  Widget build(BuildContext context,WidgetRef ref) {
    final principal=ref.watch(sessionProvider);
    if(principal is! SessionSignedIn){
      return const Scaffold(body:Center(child:Text('Sign in to see call history.')));
    }
    final userId=principal.user.id;
    return HumanCallsHistoryScreen(
      transport:ref.watch(humanCallTransportProvider),
      currentUserId:userId,
      isCurrentSession:(){
        final state=ref.read(sessionProvider);
        return state is SessionSignedIn && state.user.id==userId;
      },
      onOpenCall:(call)=>context.push('/messages/calls/${Uri.encodeComponent(call.callId)}'),
    );
  }
}

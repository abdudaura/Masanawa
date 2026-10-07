import 'package:flutter/material.dart';
import '../../talks/talk_safety.dart';
import '../talks/talk_safety_sheet.dart';

Future<void> showProfileSafetySheet(
  BuildContext context, {
  required TalkSafetyTransport transport,
  required String targetKind,
  required String targetId,
  String? preferenceHandle,
}) async {
  TalkSafetyPreference? preference;
  if (preferenceHandle != null && preferenceHandle.trim().isNotEmpty) {
    try { preference = await transport.loadPreference(preferenceHandle); } catch (_) {}
  }
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => _ProfileSafetySheet(
      transport: transport, targetKind: targetKind, targetId: targetId,
      preferenceHandle: preferenceHandle, initial: preference,
    ),
  );
}

class _ProfileSafetySheet extends StatefulWidget {
  const _ProfileSafetySheet({required this.transport,required this.targetKind,required this.targetId,this.preferenceHandle,this.initial});
  final TalkSafetyTransport transport; final String targetKind; final String targetId; final String? preferenceHandle; final TalkSafetyPreference? initial;
  @override State<_ProfileSafetySheet> createState()=>_ProfileSafetySheetState();
}
class _ProfileSafetySheetState extends State<_ProfileSafetySheet>{
  late bool _blocked=widget.initial?.blocked??false;
  late bool _muted=widget.initial?.muted??false;
  bool _busy=false;
  Future<void> _set({bool? blocked,bool? muted}) async {
    final handle=widget.preferenceHandle; if(handle==null||_busy)return;
    setState(()=>_busy=true);
    try {
      final value=await widget.transport.setPreference(handle:handle,blocked:blocked??_blocked,muted:muted??_muted);
      if(mounted)setState((){_blocked=value.blocked;_muted=value.muted;});
    } catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Couldn’t update this preference.')));}
    finally{if(mounted)setState(()=>_busy=false);}
  }
  @override Widget build(BuildContext context){
    final canPreference=widget.preferenceHandle?.trim().isNotEmpty==true;
    return Padding(padding:const EdgeInsets.fromLTRB(12,12,12,20),child:Column(mainAxisSize:MainAxisSize.min,children:[
      if(canPreference) ListTile(
        leading:Icon(_blocked?Icons.person_add_alt_1_rounded:Icons.block_rounded),
        title:Text(_blocked?'Unblock':'Block'),
        subtitle:Text(_blocked?'Allow this person again':'Hide this person and their public activity'),
        enabled:!_busy,onTap:()=>_set(blocked:!_blocked),
      ),
      if(canPreference) ListTile(
        leading:Icon(_muted?Icons.volume_up_outlined:Icons.volume_off_outlined),
        title:Text(_muted?'Unmute':'Mute'),
        subtitle:Text(_muted?'Show their activity again':'Reduce this person in your experience'),
        enabled:!_busy,onTap:()=>_set(muted:!_muted),
      ),
      ListTile(
        leading:const Icon(Icons.flag_outlined),title:const Text('Report'),
        subtitle:const Text('Send this profile to Masanawa safety review'),
        onTap:() async {
          Navigator.of(context).pop();
          await showTalkReportSheet(context,transport:widget.transport,targetKind:widget.targetKind,targetId:widget.targetId);
        },
      ),
    ]));
  }
}

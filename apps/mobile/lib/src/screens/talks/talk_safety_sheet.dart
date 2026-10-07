import 'package:flutter/material.dart';
import '../../talks/talk_safety.dart';

Future<bool> showTalkReportSheet(
  BuildContext context, {
  required TalkSafetyTransport transport,
  required String targetKind,
  required String targetId,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _TalkReportSheet(
      transport: transport,
      targetKind: targetKind,
      targetId: targetId,
    ),
  );
  return result == true;
}

class _TalkReportSheet extends StatefulWidget {
  const _TalkReportSheet({required this.transport,required this.targetKind,required this.targetId});
  final TalkSafetyTransport transport;
  final String targetKind;
  final String targetId;
  @override State<_TalkReportSheet> createState()=>_TalkReportSheetState();
}

class _TalkReportSheetState extends State<_TalkReportSheet> {
  TalkSafetyReason _reason=TalkSafetyReason.spam;
  final _detail=TextEditingController();
  bool _busy=false;
  @override void dispose(){_detail.dispose();super.dispose();}
  Future<void> _submit() async {
    if(_busy)return; setState(()=>_busy=true);
    try {
      await widget.transport.report(targetKind: widget.targetKind,targetId: widget.targetId,reason:_reason,detail:_detail.text);
      if(mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Couldn’t send this report right now.')));
    } finally { if(mounted) setState(()=>_busy=false); }
  }
  @override Widget build(BuildContext context){
    return Padding(
      padding: EdgeInsets.fromLTRB(20,18,20,20+MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        const Text('Report',style:TextStyle(fontSize:19,fontWeight:FontWeight.w800)),
        const SizedBox(height:12),
        DropdownButtonFormField<TalkSafetyReason>(
          value:_reason,
          items:[for(final reason in TalkSafetyReason.values) DropdownMenuItem(value:reason,child:Text(reason.label))],
          onChanged:_busy?null:(value){if(value!=null)setState(()=>_reason=value);},
          decoration:const InputDecoration(labelText:'Reason'),
        ),
        const SizedBox(height:12),
        TextField(controller:_detail,maxLength:2000,maxLines:4,decoration:const InputDecoration(hintText:'Add details (optional)')),
        const SizedBox(height:10),
        FilledButton(onPressed:_busy?null:_submit,child:Text(_busy?'Sending…':'Send report')),
      ])),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'operations_api.dart';

/// A18 -- feature-local screen; AF00 owns drawer/shell composition.
/// All unknown/offline states are UNKNOWN, never falsely reported as healthy.
class OperationsPage extends StatefulWidget {
  const OperationsPage({super.key,required this.api});
  final OperationsApi api;
  @override State<OperationsPage> createState()=>_OperationsPageState();
}
class _OperationsPageState extends State<OperationsPage> {
  late Future<List<OperationFlag>> _loading = widget.api.flags();
  bool _busy=false;
  void _refresh()=>setState(()=>_loading=widget.api.flags());
  Future<void> _setDisabled(OperationFlag flag) async {
    final text=TextEditingController();
    try {
      final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
        title:Text('Disable ${flag.name}?'),
        content:Column(mainAxisSize:MainAxisSize.min,children:[
          const Text('A disabled service stays disabled until a separately approved release. Include an incident or change reason.'),
          TextField(controller:text,minLines:2,maxLines:4,maxLength:500,decoration:const InputDecoration(labelText:'Reason (12+ characters)')),
        ]),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Review change'))],
      ));
      if(ok!=true||!mounted)return;
      if(text.text.trim().length<12) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Explain the change in at least 12 characters.')));
        return;
      }
      setState(()=>_busy=true);
      final preview=await widget.api.preview(flag,false);
      if(!mounted)return;
      final approved=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
        title:const Text('Confirm kill switch'),
        content:Text('${preview.current.name}: ${preview.current.enabled ? "Enabled" : "Disabled"} → Disabled. This action is audited.'),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Back')),
          FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))],
      ));
      if(approved==true){
        final key='ops-${DateTime.now().microsecondsSinceEpoch}';
        await widget.api.update(preview.current,false,text.text.trim(),key);
        if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Change saved and audited.')));
        _refresh();
      }
    } on DioException catch(e) {
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        e.response?.statusCode==403?'Permission or MFA required':e.response?.statusCode==409?'Changed by another operator. Refresh and retry.':'Unable to save. Check connection and retry.',
      )));
    } catch (_) {
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Change could not be confirmed. Refresh before retrying.')));
    } finally {
      text.dispose();
      if(mounted)setState(()=>_busy=false);
    }
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Operations'),actions:[IconButton(
      tooltip:'Refresh operational state',onPressed:_busy?null:_refresh,icon:const Icon(Icons.refresh))]),
    body:FutureBuilder<List<OperationFlag>>(future:_loading,builder:(context,snap){
      if(snap.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
      if(snap.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
        const Icon(Icons.cloud_off_outlined,size:40),
        const Text('Operational state unavailable. Changes are disabled.'),
        TextButton(onPressed:_refresh,child:const Text('Retry'))]));
      final flags=snap.data??[];
      if(flags.isEmpty)return const Center(child:Text('No switches configured. No automatic activation is allowed.'));
      return ListView(padding:const EdgeInsets.all(16),children:[
        const Text('Production controls',style:TextStyle(fontSize:19,fontWeight:FontWeight.w600)),
        const SizedBox(height:8),
        const Text('Switches default off. Enabling requires separate audited release approval.'),
        const SizedBox(height:16),
        ...flags.map((flag)=>Card(child:ListTile(
          title:Text(flag.name.replaceAll('_',' ')),
          subtitle:Text('Revision ${flag.revision} · ${flag.updatedAt==null?"Never enabled/changed":flag.updatedAt!.toLocal()}'),
          leading:Icon(flag.enabled?Icons.warning_amber:Icons.lock_outline),
          trailing:flag.enabled?TextButton(
            onPressed:_busy?null:()=>_setDisabled(flag),
            child:const Text('Disable')):const Text('Disabled'),
        ))),
        const SizedBox(height:18),
        const Text('Queue health, restore status and provider readiness must come from verified metrics. They are unavailable until AF00 wires those sources.'),
      ]);
    }),
  );
}

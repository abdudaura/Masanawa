import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'operations_api.dart';

// A failed private telemetry request must not be an unhandled Future error or
// display a healthy-looking zero in another staff account.
class _OperationsHealth {
  const _OperationsHealth.available(this.value) : denied=false;
  const _OperationsHealth.unavailable() : value=null, denied=true;
  final OperationsOverview? value;
  final bool denied;
}

/// A18 -- feature-local screen; AF00 owns drawer/shell composition.
/// All unknown/offline states are UNKNOWN, never falsely reported as healthy.
class OperationsPage extends StatefulWidget {
  const OperationsPage({super.key,required this.api});
  final OperationsApi api;
  @override State<OperationsPage> createState()=>_OperationsPageState();
}
class _OperationsPageState extends State<OperationsPage> {
  late Future<List<OperationFlag>> _loading = widget.api.flags();
  late Future<_OperationsHealth> _health = _readHealth(widget.api);
  Future<_OperationsHealth> _readHealth(OperationsApi api) async {
    try {
      return _OperationsHealth.available(await api.overview());
    } catch (_) {
      return const _OperationsHealth.unavailable();
    }
  }
  bool _busy=false;
  // The host replaces the feature API when the signed-in staff account changes.
  // Do not retain flags, actions or loading results from the previous principal.
  @override
  void didUpdateWidget(covariant OperationsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.api, widget.api)) {
      _busy=false;
      _loading=widget.api.flags();
      _health=_readHealth(widget.api);
    }
  }
  void _refresh()=>setState((){
    _loading=widget.api.flags();
    _health=_readHealth(widget.api);
  });
  Future<void> _setDisabled(OperationFlag flag) async {
    final sourceApi=widget.api;
    bool sameAccount() => mounted && identical(widget.api,sourceApi);
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
      if(ok!=true || !sameAccount())return;
      if(text.text.trim().length<12) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Explain the change in at least 12 characters.')));
        return;
      }
      setState(()=>_busy=true);
      final preview=await sourceApi.preview(flag,false);
      if(!sameAccount())return;
      final approved=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
        title:const Text('Confirm kill switch'),
        content:Text('${preview.current.name}: ${preview.current.enabled ? "Enabled" : "Disabled"} → Disabled. This action is audited.'),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Back')),
          FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))],
      ));
      if(approved==true && sameAccount()){
        final key='ops-${DateTime.now().microsecondsSinceEpoch}';
        await sourceApi.update(preview.current,false,text.text.trim(),key);
        if(sameAccount())ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Change saved and audited.')));
        if(sameAccount())_refresh();
      }
    } on DioException catch(e) {
      if(sameAccount())ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        e.response?.statusCode==403?'Permission or MFA required':e.response?.statusCode==409?'Changed by another operator. Refresh and retry.':'Unable to save. Check connection and retry.',
      )));
    } catch (_) {
      if(sameAccount())ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Change could not be confirmed. Refresh before retrying.')));
    } finally {
      text.dispose();
      if(sameAccount())setState(()=>_busy=false);
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
        const Text('Queues and safety',style:TextStyle(fontSize:19,fontWeight:FontWeight.w600)),
        FutureBuilder<_OperationsHealth>(future:_health,builder:(context,health){
          // FutureBuilder retains an old snapshot while it attaches a new future:
          // never show that snapshot during an authenticated account switch.
          if(health.connectionState!=ConnectionState.done){
            return const ListTile(title:Text('Loading operational counters…'));
          }
          if(health.hasError || health.data?.denied!=false || health.data?.value==null){
            return const ListTile(
              leading:Icon(Icons.cloud_off_outlined),
              title:Text('Queue metrics unavailable'),
              subtitle:Text('Health is unknown. Refresh after restoring connectivity.'),
            );
          }
          final value=health.data!.value!;
          return Column(children:[
            ListTile(title:const Text('Pending jobs'),trailing:Text('${value.pendingJobs}')),
            ListTile(title:const Text('Active leases'),trailing:Text('${value.activeJobLeases}')),
            ListTile(title:const Text('Dead letters'),trailing:Text('${value.deadLetters}')),
            ListTile(title:const Text('Oldest pending job'),
              trailing:Text(value.oldestPendingSeconds==null?'Unknown':'${value.oldestPendingSeconds}s')),
            ListTile(title:const Text('Financial reconciliation alerts'),
              trailing:Text('${value.openFinancialReconciliation}')),
            ListTile(title:const Text('Budget warnings'),
              trailing:Text(value.budgetWarnings?.toString()??'Unknown')),
          ]);
        }),
        const Text('Deployment version, backup restore status and provider readiness remain unknown until verified by operations.'),
      ]);
    }),
  );
}

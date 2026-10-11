import 'package:flutter/material.dart';
import 'operations_api.dart';

/// A01. Real tenant-scoped event journal metrics; unknown signals are visibly UNKNOWN.
class OperationsOverviewPage extends StatefulWidget {
 const OperationsOverviewPage({super.key,required this.api});
 final OperationsApi api;
 @override State<OperationsOverviewPage> createState()=>_OperationsOverviewPageState();
}
class _OperationsOverviewPageState extends State<OperationsOverviewPage> {
 late Future<OperationsOverview> _future=widget.api.overview();
 @override
 void didUpdateWidget(covariant OperationsOverviewPage oldWidget) {
   super.didUpdateWidget(oldWidget);
   // FutureBuilder may retain old data while a new future is loading; its
   // pending state below deliberately hides those old tenant aggregates.
   if (!identical(oldWidget.api,widget.api)) _future=widget.api.overview();
 }
 void _retry()=>setState(()=>_future=widget.api.overview());
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Platform overview'),actions:[
    IconButton(onPressed:_retry,tooltip:'Refresh metrics',icon:const Icon(Icons.refresh))]),
  body:FutureBuilder<OperationsOverview>(future:_future,builder:(ctx,snapshot){
    if(snapshot.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
    if(snapshot.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
      const Icon(Icons.cloud_off_outlined),const Text('Metrics are unavailable or permission is missing.'),
      TextButton(onPressed:_retry,child:const Text('Retry'))]));
    final v=snapshot.data;
    if(v==null)return const Center(child:Text('No telemetry available.'));
    return ListView(padding:const EdgeInsets.all(16),children:[
      const Text('Operations',style:TextStyle(fontSize:20,fontWeight:FontWeight.w600)),
      _metric('Pending jobs','${v.pendingJobs}'),
      _metric('Active leases','${v.activeJobLeases}'),
      _metric('Dead letters','${v.deadLetters}'),
      _metric('Oldest pending job',v.oldestPendingSeconds==null?'Unknown':'${v.oldestPendingSeconds}s'),
      _metric('Financial reconciliation alerts','${v.openFinancialReconciliation}'),
      _metric('Room answer age',v.roomAnswerAgeSeconds==null?'Unknown':'${v.roomAnswerAgeSeconds}s'),
      _metric('External-video sync lag',v.externalSyncLagSeconds==null?'Unknown':'${v.externalSyncLagSeconds}s'),
      _metric('Entitlement errors',v.entitlementErrors?.toString()??'Unknown'),
      _metric('Budget warnings',v.budgetWarnings?.toString()??'Unknown'),
      const SizedBox(height:16),
      const Text('Reported counters come from the event journal. Unknown does not mean zero.'),
    ]);
  }),
 );
 Widget _metric(String label,String value)=>Card(child:ListTile(title:Text(label),
   trailing:Text(value,style:const TextStyle(fontWeight:FontWeight.w600))));
}

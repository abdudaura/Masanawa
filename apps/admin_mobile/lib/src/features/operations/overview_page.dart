import 'package:flutter/material.dart';
import 'operations_api.dart';

/// A01 minimal truthful overview, pending AF00 canonical worker/queue metrics.
class OperationsOverviewPage extends StatefulWidget {
  const OperationsOverviewPage({super.key,required this.api});
  final OperationsApi api;
  @override State<OperationsOverviewPage> createState()=>_OperationsOverviewPageState();
}
class _OperationsOverviewPageState extends State<OperationsOverviewPage> {
 late Future<List<OperationFlag>> _future=widget.api.flags();
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Platform overview'),actions:[
   IconButton(onPressed:()=>setState(()=>_future=widget.api.flags()),tooltip:'Refresh',icon:const Icon(Icons.refresh))]),
  body:FutureBuilder<List<OperationFlag>>(future:_future,builder:(ctx,snapshot){
   if(snapshot.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
   if(snapshot.hasError)return const Center(child:Text('Health unavailable; no status can be confirmed. Retry when online.'));
   final flags=snapshot.data??[];
   return ListView(padding:const EdgeInsets.all(16),children:[
    const Text('Operational controls',style:TextStyle(fontWeight:FontWeight.bold,fontSize:20)),
    ...flags.map((e)=>ListTile(title:Text(e.name),trailing:Text(e.enabled?'Enabled':'Off'))),
    const Divider(),
    const Text('Workers, queues, subscription errors, financial alerts and backups: awaiting verified telemetry. No healthy status inferred.'),
   ]);
  }),
 );
}

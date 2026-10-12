import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// A16: aggregates only by default. The server, not this UI, enforces the data-officer role.
class FanMemoryAdminScreen extends StatefulWidget {
  final Dio authenticatedClient;
  final String accountFence;
  const FanMemoryAdminScreen({super.key,required this.authenticatedClient,required this.accountFence});
  @override State<FanMemoryAdminScreen> createState()=>_FanMemoryAdminScreenState();
}
class _FanMemoryAdminScreenState extends State<FanMemoryAdminScreen>{
  List<dynamic> totals=[];bool loading=false;String? error;int epoch=0;
  @override void initState(){super.initState();refresh();}
  @override void didUpdateWidget(covariant FanMemoryAdminScreen old){
    super.didUpdateWidget(old);
    if(old.accountFence!=widget.accountFence){++epoch;totals=[];refresh();}
  }
  @override void dispose(){++epoch;super.dispose();}
  Future<void> refresh()async{
    final run=++epoch;setState((){loading=true;error=null;});
    try{
      final r=await widget.authenticatedClient.get<Map<String,dynamic>>('/v1/admin/fan-memory/aggregate');
      if(!mounted||run!=epoch)return;
      setState((){loading=false;totals=(r.data?['items'] as List<dynamic>?)??[];});
    }catch(_){
      if(!mounted||run!=epoch)return;
      setState((){loading=false;totals=[];error='Unable to load memory statistics. Check staff access.';});
    }
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Fans & Memory')),
    body:RefreshIndicator(onRefresh:refresh,child:ListView(children:[
      const ListTile(title:Text('Privacy-protected overview'),
        subtitle:Text('Only aggregated memory counts are shown. Personal data requires a separate authorized purpose and audit.')),
      if(loading)const LinearProgressIndicator(),
      if(error!=null)ListTile(title:Text(error!),trailing:IconButton(icon:const Icon(Icons.refresh),onPressed:refresh)),
      if(!loading&&error==null&&totals.isEmpty)const ListTile(title:Text('No statistics available')),
      for(final row in totals)ListTile(
        title:Text((row as Map)['characterId']?.toString()??'Masana'),
        subtitle:Text('Opted-in fans: ${row['enabledFans']??0}')),
    ]))));
}

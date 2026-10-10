import 'package:flutter/material.dart';
import 'fan_memory_repository.dart';

/// C19: fan memory is per-Masana and hidden until explicitly opted in.
class FanMemoryScreen extends StatefulWidget {
  final FanMemoryRepository repository;
  final String characterId;
  final String characterName;
  final String accountFence;
  const FanMemoryScreen({super.key, required this.repository,
    required this.characterId, required this.characterName, required this.accountFence});
  @override State<FanMemoryScreen> createState() => _FanMemoryScreenState();
}
class _FanMemoryScreenState extends State<FanMemoryScreen> {
  Map<String,dynamic>? data;
  bool busy = false;
  String? error;
  int generation = 0;
  final Map<String,String> _retryKeys = {};
  @override void initState(){super.initState();_load();}
  @override void didUpdateWidget(covariant FanMemoryScreen old){
    super.didUpdateWidget(old);
    if(old.accountFence!=widget.accountFence || old.characterId!=widget.characterId){
      ++generation; _retryKeys.clear();data=null;error=null;busy=false;_load();
    }
  }
  @override void dispose(){++generation;super.dispose();}
  Future<void> _load() async{
    final current=++generation;
    setState((){busy=true;error=null;});
    try{
      final v=await widget.repository.load(widget.characterId);
      if(!mounted||current!=generation)return;
      setState((){data=v;busy=false;});
    }catch(_){
      if(!mounted||current!=generation)return;
      setState((){busy=false;data=null;error='Could not load memory. Check connection and retry.';});
    }
  }
  Future<void> _toggle(bool enabled)async{
    if(busy||data==null)return;
    final current=++generation;
    setState((){busy=true;error=null;});
    try{
      final v=await widget.repository.consent(widget.characterId,enabled,(data!['revision'] as num?)?.toInt()??0);
      if(!mounted||current!=generation)return;
      setState((){data=v;busy=false;});
      if(enabled)_load();
    }catch(_){
      if(!mounted||current!=generation)return;
      setState((){busy=false;error='Setting changed or network unavailable. Refresh to retry.';});
    }
  }
  Future<void> _erase(String? id)async{
    if(busy)return;
    final yes=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(id==null?'Erase all memory?':'Erase this memory?'),
      content:const Text('This creates a deletion request. Memory is removed after authorized processing.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
       FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Request erasure'))]));
    if(yes!=true||!mounted)return;
    final current=++generation;
    setState((){busy=true;error=null;});
    // Reuse this exact server idempotency key after an uncertain network outcome.
    final target='${widget.characterId}:${id??'all'}';
    final key=_retryKeys.putIfAbsent(target,()=>
       'fan-erase-${DateTime.now().microsecondsSinceEpoch}-${id??'all'}');
    try{
      final result=await widget.repository.erase(widget.characterId,id,key);
      if(!mounted||current!=generation)return;
      _retryKeys.remove(target);
      setState((){busy=false;});
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(
        result['state']=='completed'?'Memory erased':'Deletion requested; awaiting processing')));
      _load();
    }catch(_){
      if(!mounted||current!=generation)return;
      setState((){busy=false;error='Deletion request not confirmed. Refresh before trying again.';});
    }
  }
  @override Widget build(BuildContext context){
    final enabled=data?['enabled']==true;
    final records=(data?['items'] as List<dynamic>?)??const [];
    return Scaffold(appBar:AppBar(title:Text('${widget.characterName} memory')),
      body:RefreshIndicator(onRefresh:_load,child:ListView(
        padding:const EdgeInsets.all(16),children:[
          const Text('Choose what this Masana may remember about you.'),
          const SizedBox(height:12),
          if(error!=null)Semantics(liveRegion:true,child:Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error))),
          if(data==null && busy)const Center(child:CircularProgressIndicator()),
          if(data!=null)SwitchListTile.adaptive(
            title:const Text('Remember my preferences'),
            subtitle:const Text('Off by default. You can review and erase saved memories.'),
            value:enabled,onChanged:busy?null:_toggle),
          if(data!=null && !enabled)const ListTile(title:Text('Memory is off'),
            subtitle:Text('No remembered information is shown or used while disabled.')),
          if(data!=null && enabled && records.isEmpty)const ListTile(title:Text('Nothing remembered yet')),
          if(data!=null && enabled)
            for(final item in records)
              ListTile(title:Text((item as Map)['content']?.toString()??''),
                subtitle:Text(item['updatedAt']?.toString()??''),
                trailing:IconButton(
                  tooltip:'Delete this memory',icon:const Icon(Icons.delete_outline),
                  onPressed:busy?null:()=>_erase(item['id']?.toString()))),
          if(data!=null)OutlinedButton.icon(
            onPressed:busy?null:()=>_erase(null),
            icon:const Icon(Icons.delete_sweep_outlined),label:const Text('Erase all memories')),
          if(busy && data!=null)const LinearProgressIndicator(),
          TextButton(onPressed:busy?null:_load,child:const Text('Refresh')),
        ])));
  }
}

import 'package:flutter/material.dart';
import 'rehearsal_api.dart';
/// A04 staff rehearsal; never a live call, published post or fan message.
class MasanaRehearsalScreen extends StatefulWidget {
 const MasanaRehearsalScreen({super.key,required this.repository,required this.characterId,required this.revision,required this.accountKey});
 final MasanaRehearsalRepository repository;
 final String characterId,accountKey;final int revision;
 @override State<MasanaRehearsalScreen> createState()=>_MasanaRehearsalScreenState();
}
class _MasanaRehearsalScreenState extends State<MasanaRehearsalScreen> {
 final prompt=TextEditingController();
 String mode='chat';String? requestKey,error;MasanaRehearsal? run;bool busy=false;int epoch=0;
 @override void dispose(){prompt.dispose();super.dispose();}
 @override void didUpdateWidget(covariant MasanaRehearsalScreen old){
  super.didUpdateWidget(old);
  if(old.accountKey!=widget.accountKey||old.characterId!=widget.characterId||old.revision!=widget.revision||old.repository!=widget.repository){
   epoch++;requestKey=null;run=null;error=null;busy=false;prompt.clear();
  }
 }
 Future<void> start()async{
  if(busy||prompt.text.trim().isEmpty)return;
  final e=epoch,key=requestKey??'rehearsal_'+DateTime.now().microsecondsSinceEpoch.toString();
  setState((){busy=true;error=null;requestKey=key;});
  try{final value=await widget.repository.start(widget.characterId,widget.revision,mode,prompt.text.trim(),key);
   if(mounted&&e==epoch)setState((){run=value;requestKey=null;});
  }catch(_){if(mounted&&e==epoch)setState(()=>error='Unconfirmed request; retry preserves the request ID.');}
  finally{if(mounted&&e==epoch)setState(()=>busy=false);}
 }
 Future<void> refresh()async{
  if(busy||run==null)return;
  final e=epoch,id=run!.runId;setState((){busy=true;error=null;});
  try{final value=await widget.repository.read(widget.characterId,id);
   if(mounted&&e==epoch)setState(()=>run=value);
  }catch(_){if(mounted&&e==epoch)setState(()=>error='Status unavailable. Retry when online.');}
  finally{if(mounted&&e==epoch)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Draft rehearsal')),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   Text(widget.characterId+' · draft revision '+widget.revision.toString()),
   const SizedBox(height:8),const Text('Staff-only. Does not message fans, publish or place a real call.'),
   DropdownButtonFormField<String>(value:mode,decoration:const InputDecoration(labelText:'Mode'),
    items:const [DropdownMenuItem(value:'chat',child:Text('Chat')),DropdownMenuItem(value:'post',child:Text('Post')),
      DropdownMenuItem(value:'call',child:Text('Qualified call sample'))],
    onChanged:busy?null:(v)=>setState((){mode=v??'chat';run=null;requestKey=null;})),
   TextField(controller:prompt,enabled:!busy,maxLines:3,maxLength:2000,decoration:const InputDecoration(labelText:'Scenario')),
   FilledButton(onPressed:busy?null:start,child:Text(requestKey==null?'Start rehearsal':'Retry same request')),
   if(busy)const LinearProgressIndicator(),
   if(error!=null)Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
   if(run!=null)...[
    Text('Run '+run!.runId+' · '+run!.state),
    if(run!.errorCode!=null)Text('No external action: '+run!.errorCode!),
    if(run!.state=='queued'||run!.state=='running')...[
     const Text('Not completed; refresh for verified preview.'),
     OutlinedButton(onPressed:busy?null:refresh,child:const Text('Refresh status'))],
    if(run!.state=='succeeded')...[
     Text(run!.preview?['summary']?.toString()??''),
     SelectableText(run!.preview?['previewText']?.toString()??'')],
   ]
  ])
 );
}
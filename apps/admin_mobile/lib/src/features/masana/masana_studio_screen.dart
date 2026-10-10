import 'package:flutter/material.dart';
import 'masana_studio_api.dart';

/// A02/A03. Root Admin drawer and staff JWT/RBAC composition belong to AF00.
/// A04 live rehearsal is disabled until the canonical sandbox is connected.
class MasanaStudioScreen extends StatefulWidget {
 const MasanaStudioScreen({super.key,required this.repository,required this.accountKey});
 final MasanaStudioRepository repository;
 final String accountKey;
 @override State<MasanaStudioScreen> createState()=>_MasanaStudioScreenState();
}
class _MasanaStudioScreenState extends State<MasanaStudioScreen> {
 late Future<List<MasanaRevision>> future=widget.repository.list();
 bool saving=false;
 String? error;
 int generation=0;
 void reload()=>setState(()=>future=widget.repository.list());
 @override void didUpdateWidget(covariant MasanaStudioScreen old){
  super.didUpdateWidget(old);
  if(old.accountKey!=widget.accountKey || old.repository!=widget.repository){
   generation++;saving=false;error=null;future=widget.repository.list();
  }
 }
 Future<void> edit(MasanaRevision revision) async {
  final before=revision.profile;
  final name=TextEditingController(text:before['displayName']?.toString()??'');
  final role=TextEditingController(text:before['profession']?.toString()??'');
  final bio=TextEditingController(text:before['biography']?.toString()??'');
  final story=TextEditingController(text:before['lifeStory']?.toString()??'');
  final next=await showDialog<Map<String,dynamic>>(context:context,builder:(ctx)=>AlertDialog(
   title:const Text('Create a draft revision'),
   content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
    TextField(controller:name,maxLength:100,decoration:const InputDecoration(labelText:'Name')),
    TextField(controller:role,maxLength:100,decoration:const InputDecoration(labelText:'Profession')),
    TextField(controller:bio,maxLength:800,maxLines:3,decoration:const InputDecoration(labelText:'Biography')),
    TextField(controller:story,maxLength:8000,maxLines:5,decoration:const InputDecoration(labelText:'Fictional life story')),
    const Text('Portrait, banner and voice assets require rights approval separately.'),
   ])),
   actions:[
    TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(ctx,{...before,
     'displayName':name.text.trim(),'profession':role.text.trim(),
     'biography':bio.text.trim(),'lifeStory':story.text.trim(),
    }),child:const Text('Save draft')),
   ]));
  name.dispose();role.dispose();bio.dispose();story.dispose();
  if(next==null || !mounted)return;
  final current=generation;
  setState(()=>saving=true);
  try{await widget.repository.draft(revision.characterId,next);
   if(mounted&&current==generation)reload();}
  catch(_){if(mounted&&current==generation)setState(()=>error='Draft not saved. Check role and network.');}
  finally{if(mounted&&current==generation)setState(()=>saving=false);}
 }
 Future<void> attachMedia(MasanaRevision revision) async {
  final mediaId=TextEditingController();
  final rights=TextEditingController();
  String kind='portrait';
  final data=await showDialog<List<String>>(context:context,builder:(ctx)=>StatefulBuilder(
   builder:(ctx,update)=>AlertDialog(
    title:const Text('Register verified media'),
    content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
     DropdownButton<String>(value:kind,items:const [
      DropdownMenuItem(value:'portrait',child:Text('Portrait')),
      DropdownMenuItem(value:'banner',child:Text('Banner'))],
      onChanged:(v)=>update(()=>kind=v??'portrait')),
     TextField(controller:mediaId,decoration:const InputDecoration(labelText:'Existing approved media ID')),
     TextField(controller:rights,maxLength:1024,maxLines:2,
      decoration:const InputDecoration(labelText:'Rights/licensing provenance')),
     const Text('A server-side media verification is required. This screen does not upload new bytes.'),
    ])),
    actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Cancel')),
     FilledButton(onPressed:()=>Navigator.pop(ctx,[mediaId.text.trim(),kind,rights.text.trim()]),child:const Text('Verify and attach'))],
   )));
  mediaId.dispose();rights.dispose();
  if(data==null||!mounted)return;
  final current=generation;setState(()=>saving=true);
  try{await widget.repository.attachVerifiedMedia(revision.characterId,revision.revision,data[0],data[1],data[2]);
   if(mounted&&generation==current)reload();}
  catch(_){if(mounted&&generation==current)setState(()=>error='Media attachment was not saved; revision remains unchanged.');}
  finally{if(mounted&&generation==current)setState(()=>saving=false);}
 }
 Future<void> approve(MasanaRevision revision) async {
  final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
   title:const Text('Publish approved revision?'),
   content:const Text('Confirm licensed portrait/banner, character rights and review. Drafts are never public.'),
   actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Approve'))]));
  if(ok!=true || !mounted)return;
  final current=generation;
  setState(()=>saving=true);
  try{await widget.repository.approve(revision.characterId,revision.revision);
   if(mounted&&current==generation)reload();}
  catch(_){if(mounted&&current==generation)setState(()=>error='Approval denied or media is unverified.');}
  finally{if(mounted&&current==generation)setState(()=>saving=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Masana Studio')),
  body:FutureBuilder<List<MasanaRevision>>(future:future,builder:(context,s){
   if(s.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
   if(s.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    const Text('Cannot load Studio. Permission or network unavailable.'),
    TextButton(onPressed:reload,child:const Text('Retry'))]));
   final items=s.data??[];
   if(items.isEmpty)return const Center(child:Text('No Masana yet. Staging setup must be completed.'));
   return ListView(children:[
    if(error!=null)Padding(padding:const EdgeInsets.all(12),child:Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error))),
    for(final r in items)Card(child:ListTile(
     leading:const Icon(Icons.person_outline),
     title:Text(r.profile['displayName']?.toString()??r.characterId),
     subtitle:Text('${r.characterId} · revision ${r.revision} · ${r.state}'),
     onTap:saving?null:()=>edit(r),
     trailing:r.state=='draft'?Row(mainAxisSize:MainAxisSize.min,children:[
      IconButton(tooltip:'Attach verified media',icon:const Icon(Icons.image_outlined),
       onPressed:saving?null:()=>attachMedia(r)),
      IconButton(tooltip:'Approve revision',icon:const Icon(Icons.verified_outlined),
       onPressed:saving?null:()=>approve(r)),
     ]):null,
    )),
   ]);
  }),
  floatingActionButton:FloatingActionButton(
   tooltip:'Reload',onPressed:saving?null:reload,child:const Icon(Icons.refresh)),
 );
}

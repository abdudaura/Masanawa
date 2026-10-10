import 'package:flutter/material.dart';
import 'masana_repository.dart';

/// C24: no client can reveal draft/non-platform characters. Fan actions
/// must be wired by the shell to the existing Masana-only chat/call/Room paths.
class MasanaProfileScreen extends StatefulWidget {
 const MasanaProfileScreen({super.key,required this.characterId,required this.accountKey,
  required this.repository,this.onChat,this.onCall,this.onRoom,this.onSignIn,
  this.voiceQualified=false});
 final String characterId,accountKey;
 final MasanaRepository repository;
 final VoidCallback? onChat,onCall,onRoom,onSignIn;
 final bool voiceQualified;
 @override State<MasanaProfileScreen> createState()=>_MasanaProfileScreenState();
}
class _MasanaProfileScreenState extends State<MasanaProfileScreen> {
 late Future<MasanaProfile?> future=widget.repository.read(widget.characterId);
 bool working=false;
 String? error;
 int generation=0;
 @override void didUpdateWidget(covariant MasanaProfileScreen old){
  super.didUpdateWidget(old);
  if(old.accountKey!=widget.accountKey||old.characterId!=widget.characterId||old.repository!=widget.repository){
   generation++;working=false;error=null;future=widget.repository.read(widget.characterId);
  }
 }
 void retry()=>setState(()=>future=widget.repository.read(widget.characterId));
 Future<void> follow(MasanaProfile profile) async {
  if(working)return;
  if(widget.accountKey.isEmpty){widget.onSignIn?.call();return;}
  final version=generation;
  setState((){working=true;error=null;});
  try{
   final result=await widget.repository.setFollow(profile.characterId,!profile.following);
   if(mounted&&generation==version)setState(()=>future=Future.value(profile.followState(result)));
  }catch(_){
   if(mounted&&generation==version)setState(()=>error='Could not save Follow. Retry when connected.');
  }finally{if(mounted&&generation==version)setState(()=>working=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Masana profile')),
  body:FutureBuilder<MasanaProfile?>(future:future,builder:(context,s){
   if(s.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
   if(s.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    const Text('Profile unavailable. Check your connection.'),TextButton(onPressed:retry,child:const Text('Retry'))]));
   final p=s.data;
   if(p==null)return const Center(child:Text('This Masana is unavailable.'));
   final theme=Theme.of(context);
   return ListView(padding:const EdgeInsets.all(16),children:[
    Container(height:120,alignment:Alignment.center,clipBehavior:Clip.antiAlias,
     decoration:BoxDecoration(color:theme.colorScheme.primaryContainer,borderRadius:BorderRadius.circular(16)),
     child:p.bannerUrl!=null?Image.network(p.bannerUrl!,fit:BoxFit.cover,width:double.infinity,
      errorBuilder:(_,__,___)=>const Icon(Icons.image_not_supported_outlined)):
      CircleAvatar(radius:36,child:Text(p.displayName.isNotEmpty?p.displayName.substring(0,1):'?'))),
    const SizedBox(height:12),Text(p.displayName,style:theme.textTheme.headlineSmall),
    Text(p.profession),Text('${p.followers} followers'),
    const SizedBox(height:12),
    Wrap(spacing:8,runSpacing:8,children:[
      OutlinedButton.icon(onPressed:working?null:()=>follow(p),icon:Icon(p.following?Icons.check:Icons.person_add),
       label:Text(p.following?'Following':'Follow')),
      OutlinedButton.icon(onPressed:widget.onChat,icon:const Icon(Icons.chat_outlined),label:const Text('Chat')),
      OutlinedButton.icon(onPressed:widget.voiceQualified?widget.onCall:null,
       icon:const Icon(Icons.call_outlined),label:const Text('Call')),
      OutlinedButton.icon(onPressed:p.roomId==null?null:widget.onRoom,
       icon:const Icon(Icons.school_outlined),label:const Text('Room')),
    ]),
    if(error!=null)Text(error!,style:TextStyle(color:theme.colorScheme.error)),
    const SizedBox(height:14),Text(p.biography),
    ExpansionTile(title:const Text('Life story'),children:[
      Padding(padding:const EdgeInsets.all(12),child:Text(p.story))]),
    for(final label in ['talents','languages','goals'])
      if(p.profile[label] is List && (p.profile[label] as List).isNotEmpty)
       ListTile(title:Text(label),subtitle:Text((p.profile[label] as List).join(' · '))),
    const ListTile(title:Text('Posts'),subtitle:Text('Posts are displayed when Feed is connected.')),
   ]);
  }),
 );
}

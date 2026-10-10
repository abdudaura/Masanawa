import 'package:flutter/material.dart';
import 'masana_repository.dart';

/// C11/C46: published Masana only, with account-fenced search and recovery.
class MasanaDirectoryScreen extends StatefulWidget {
 const MasanaDirectoryScreen({super.key,required this.repository,required this.accountKey,required this.openProfile});
 final MasanaRepository repository;
 final String accountKey;
 final ValueChanged<String> openProfile;
 @override State<MasanaDirectoryScreen> createState()=>_MasanaDirectoryScreenState();
}
class _MasanaDirectoryScreenState extends State<MasanaDirectoryScreen> {
 final query=TextEditingController();
 late Future<List<MasanaProfile>> results=widget.repository.search('');
 int generation=0;
 @override void didUpdateWidget(covariant MasanaDirectoryScreen old) {
  super.didUpdateWidget(old);
  if(old.accountKey!=widget.accountKey || old.repository!=widget.repository){
   generation++;query.clear();results=widget.repository.search('');
  }
 }
 @override void dispose(){query.dispose();super.dispose();}
 void reload() {
  final current=++generation;
  setState(()=>results=widget.repository.search(query.text.trim()).then((people)=>
    current==generation?people:<MasanaProfile>[]));
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Find Masana')),
  body:Column(children:[
   Padding(padding:const EdgeInsets.all(12),child:TextField(
    controller:query,onSubmitted:(_)=>reload(),
    decoration:InputDecoration(border:const OutlineInputBorder(),
     labelText:'Name or profession',prefixIcon:const Icon(Icons.search),
     suffixIcon:IconButton(icon:const Icon(Icons.arrow_forward),tooltip:'Search',onPressed:reload)))),
   Expanded(child:FutureBuilder<List<MasanaProfile>>(future:results,builder:(context,snapshot){
    if(snapshot.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
    if(snapshot.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
     const Text('Unable to load Masana. Check your connection.'),
     TextButton(onPressed:reload,child:const Text('Retry'))]));
    final people=snapshot.data??[];
    if(people.isEmpty)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
     const Text('No matching Masana.'),TextButton(onPressed:(){query.clear();reload();},child:const Text('Show all'))]));
    return RefreshIndicator(onRefresh:() async{reload();await results;},
     child:ListView.builder(itemCount:people.length,itemBuilder:(context,index){
      final p=people[index];
      return ListTile(
       leading:CircleAvatar(child:Text(p.displayName.isEmpty?'?':p.displayName.substring(0,1))),
       title:Text(p.displayName),
       subtitle:Text(p.profession,maxLines:1,overflow:TextOverflow.ellipsis),
       trailing:const Icon(Icons.chevron_right),
       onTap:()=>widget.openProfile(p.characterId),
      );
     }));
   })),
  ]),
 );
}

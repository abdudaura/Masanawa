import 'package:flutter/material.dart';
import 'youtube_sources_api.dart';

typedef YouTubeSourceLoader=Future<List<YouTubeSourceRecord>> Function();
typedef YouTubeSourceCreator=Future<void> Function(String,String,String);
typedef YouTubeSourcePauser=Future<void> Function(String);

/// A13: staff can create a verified-format YouTube channel record (always
/// PAUSED + manual) and pause existing sources. No button or client flag can
/// grant automatic synchronization or activate missing provider credentials.
class YouTubeSourcesScreen extends StatefulWidget {
  const YouTubeSourcesScreen({required this.load,required this.create,required this.pause,super.key});
  YouTubeSourcesScreen.fromApi({required YouTubeSourcesApi api,super.key})
    : load=api.list,create=api.create,pause=api.pause;
  final YouTubeSourceLoader load;
  final YouTubeSourceCreator create;
  final YouTubeSourcePauser pause;
  @override State<YouTubeSourcesScreen> createState()=>_YouTubeSourcesScreenState();
}
class _YouTubeSourcesScreenState extends State<YouTubeSourcesScreen> {
  final id=TextEditingController(),channel=TextEditingController(),region=TextEditingController(text:'NG');
  late Future<List<YouTubeSourceRecord>> data;
  bool busy=false;
  String? error;
  @override void initState(){super.initState();data=widget.load();}
  @override void dispose(){id.dispose();channel.dispose();region.dispose();super.dispose();}
  void reload()=>setState(()=>data=widget.load());
  Future<void> submit() async {
    if(busy)return;
    final channelId=id.text.trim();
    final name=channel.text.trim();
    final country=region.text.trim().toUpperCase();
    if(!RegExp(r'^UC[A-Za-z0-9_-]{22}$').hasMatch(channelId) ||
      name.isEmpty || country.length!=2) {
      setState(()=>error='Enter a valid YouTube channel ID, name and two-letter country.');
      return;
    }
    setState((){busy=true;error=null;});
    try {
      await widget.create(channelId,name,country);
      if(!mounted)return;
      id.clear();channel.clear();reload();
    } catch(_) {if(mounted)setState(()=>error='Could not register channel. Check your permission and connection.');}
    finally {if(mounted)setState(()=>busy=false);}
  }
  Future<void> stop(YouTubeSourceRecord source) async {
    if(busy)return;
    final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
      title:const Text('Pause YouTube source?'),
      content:Text('Stop new synchronization for ${source.channelName}. Existing approved videos remain under staff review.'),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Pause')),
      ],
    ));
    if(ok!=true||!mounted)return;
    setState((){busy=true;error=null;});
    try {await widget.pause(source.id);if(mounted)reload();}
    catch(_){if(mounted)setState(()=>error='Could not pause source. Refresh or retry.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('YouTube channels'),actions:[
      IconButton(tooltip:'Refresh channels',onPressed:reload,icon:const Icon(Icons.refresh)),
    ]),
    body:ListView(padding:const EdgeInsets.all(14),children:[
      const Text('Register a YouTube channel for staff review. New channels stay paused. Automatic synchronization requires separately verified provider access.'),
      const SizedBox(height:12),
      TextField(controller:id,maxLength:24,decoration:const InputDecoration(
        labelText:'Channel ID',hintText:'UC…',helperText:'Official YouTube channel ID')),
      TextField(controller:channel,maxLength:100,decoration:const InputDecoration(labelText:'Channel name')),
      TextField(controller:region,maxLength:2,textCapitalization:TextCapitalization.characters,
        decoration:const InputDecoration(labelText:'Country',hintText:'NG')),
      FilledButton.icon(onPressed:busy?null:submit,icon:const Icon(Icons.add),
        label:const Text('Register paused source')),
      if(error!=null)Padding(padding:const EdgeInsets.all(8),
        child:Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error))),
      const Divider(),
      FutureBuilder<List<YouTubeSourceRecord>>(future:data,builder:(context,s){
        if(s.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
        if(s.hasError)return ListTile(title:const Text('Sources unavailable or offline'),
          trailing:TextButton(onPressed:reload,child:const Text('Retry')));
        final sources=s.data??[];
        if(sources.isEmpty)return const ListTile(title:Text('No YouTube sources yet'));
        return Column(children:[
          for(final source in sources)Card(child:ListTile(
            title:Text(source.channelName),subtitle:Text('${source.channelId} · ${source.targetRegion} · ${source.syncMode}'),
            leading:Icon(source.enabled?Icons.sync:Icons.pause_circle_outline),
            trailing:source.enabled
              ?IconButton(tooltip:'Pause ${source.channelName}',onPressed:busy?null:()=>stop(source),
                icon:const Icon(Icons.pause_circle_outline))
              :const Text('Paused'),
          )),
        ]);
      }),
    ]),
  );
}

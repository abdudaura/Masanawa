import 'package:flutter/material.dart';
import 'youtube_sources_api.dart';

typedef YouTubeSourceLoader=Future<List<YouTubeSourceRecord>> Function();
typedef YouTubeSourceCreator=Future<void> Function(String,String,String);
typedef YouTubeSourcePauser=Future<void> Function(String);

/// A13: staff can create a verified-format YouTube channel record (always
/// PAUSED + manual) and pause existing sources. No button or client flag can
/// grant automatic synchronization or activate missing provider credentials.
class YouTubeSourcesScreen extends StatefulWidget {
  const YouTubeSourcesScreen({required this.load,required this.create,required this.pause,
    this.accountKey='',this.enabled=true,super.key});
  YouTubeSourcesScreen.fromApi({required YouTubeSourcesApi api,
    this.accountKey='',this.enabled=true,super.key})
    : load=api.list,create=api.create,pause=api.pause;
  final YouTubeSourceLoader load;
  final YouTubeSourceCreator create;
  final YouTubeSourcePauser pause;
  /// Injected by the authenticated Admin shell; never derived from an editable field.
  final String accountKey;
  final bool enabled;
  @override State<YouTubeSourcesScreen> createState()=>_YouTubeSourcesScreenState();
}
class _YouTubeSourcesScreenState extends State<YouTubeSourcesScreen> {
  final id=TextEditingController(),channel=TextEditingController(),region=TextEditingController(text:'NG');
  late Future<List<YouTubeSourceRecord>> data;
  bool busy=false;
  String? error;
  int generation=0;
  bool current(int g,String account) =>
    mounted && generation==g && widget.accountKey==account && widget.enabled;
  @override void initState(){
    super.initState();
    data=widget.enabled?widget.load():Future.value(<YouTubeSourceRecord>[]);
  }
  @override void didUpdateWidget(covariant YouTubeSourcesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if(oldWidget.accountKey!=widget.accountKey ||
       oldWidget.enabled!=widget.enabled ||
       oldWidget.load!=widget.load ||
       oldWidget.create!=widget.create ||
       oldWidget.pause!=widget.pause) {
      // A pending request or confirmation belongs to the previous principal.
      // Discard its view, draft and completion callbacks before rendering.
      generation++;
      id.clear();channel.clear();region.text='NG';
      busy=false;error=null;
      data=widget.enabled?widget.load():Future.value(<YouTubeSourceRecord>[]);
    }
  }
  @override void dispose(){id.dispose();channel.dispose();region.dispose();super.dispose();}
  void reload()=>setState((){
    generation++;busy=false;error=null;
    data=widget.enabled?widget.load():Future.value(<YouTubeSourceRecord>[]);
  });
  Future<void> submit() async {
    if(busy||!widget.enabled)return;
    final currentGeneration=generation, account=widget.accountKey;
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
      if(!current(currentGeneration,account))return;
      id.clear();channel.clear();reload();
    } catch(_) {
      if(current(currentGeneration,account))setState(
        ()=>error='Could not register channel. Check your permission and connection.');
    } finally {
      if(current(currentGeneration,account))setState(()=>busy=false);
    }
  }
  Future<void> stop(YouTubeSourceRecord source) async {
    if(busy||!widget.enabled)return;
    final currentGeneration=generation, account=widget.accountKey;
    final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
      title:const Text('Pause YouTube source?'),
      content:Text('Stop new synchronization for ${source.channelName}. Existing approved videos remain under staff review.'),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Pause')),
      ],
    ));
    if(ok!=true||!current(currentGeneration,account))return;
    setState((){busy=true;error=null;});
    try {
      await widget.pause(source.id);
      if(current(currentGeneration,account))reload();
    } catch(_) {
      if(current(currentGeneration,account))setState(
        ()=>error='Could not pause source. Refresh or retry.');
    } finally {
      if(current(currentGeneration,account))setState(()=>busy=false);
    }
  }
  @override Widget build(BuildContext context) {
    if(!widget.enabled)return Scaffold(
      appBar:AppBar(title:const Text('YouTube channels')),
      body:const Center(child:Text('Video source administration is unavailable')),
    );
    return Scaffold(
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
}

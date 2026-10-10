import 'package:flutter/material.dart';
import 'video_admin_api.dart';

class VideoCurationScreen extends StatefulWidget {
  const VideoCurationScreen({required this.api, super.key});
  final VideoAdminApi api;
  @override State<VideoCurationScreen> createState() => _VideoCurationScreenState();
}
class _VideoCurationScreenState extends State<VideoCurationScreen> {
  final url = TextEditingController(), title = TextEditingController(), channel = TextEditingController();
  late Future<List<CuratedVideo>> future = widget.api.list();
  bool working = false;
  String? error;
  @override void dispose(){url.dispose();title.dispose();channel.dispose();super.dispose();}
  void refresh() => setState(() => future = widget.api.list());
  Future<void> submit() async {
    if (working) return;
    setState(() {working = true; error = null;});
    try {await widget.api.submit(url.text,title.text,channel.text);
      if (mounted) {url.clear();title.clear();channel.clear();refresh();}
    } catch (_) {if (mounted) setState(() => error = 'Submission failed: check URL, permission and connection');}
    finally {if (mounted) setState(() => working = false);}
  }
  Future<void> review(CuratedVideo v,String state) async {
    if (working) return;
    String? evidence;
    if (state == 'approved') {
      final field = TextEditingController();
      evidence = await showDialog<String>(context: context, builder: (c) => AlertDialog(
        title: const Text('Verify official player and rights'),
        content: TextField(controller: field, maxLength:250,
          decoration: const InputDecoration(labelText:'Evidence reference',helperText:'Confirm region and official embed availability')),
        actions: [
          TextButton(onPressed:()=>Navigator.pop(c), child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(c,field.text.trim()), child:const Text('Approve')),
        ],
      ));
      field.dispose();
      if (evidence == null || evidence.length < 12) return;
    }
    if (!mounted) return;
    setState(() {working = true;error = null;});
    try {await widget.api.review(v.id,state,evidence);if (mounted) refresh();}
    catch (_) {if (mounted) setState(() => error = 'Review failed or item changed. Refresh and retry.');}
    finally {if (mounted) setState(() => working = false);}
  }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('External videos')),
    body: ListView(padding:const EdgeInsets.all(12),children:[
      const Text('Add official video links for staff review; videos are never downloaded or automatically published.'),
      TextField(controller:url,decoration:const InputDecoration(labelText:'Official video URL')),
      TextField(controller:title,maxLength:180,decoration:const InputDecoration(labelText:'Video title')),
      TextField(controller:channel,maxLength:100,decoration:const InputDecoration(labelText:'Original channel')),
      FilledButton(onPressed:working?null:submit,child:const Text('Submit for review')),
      if(error != null) Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
      const Divider(),
      FutureBuilder<List<CuratedVideo>>(future:future,builder:(context,s){
        if(s.connectionState != ConnectionState.done)return const Center(child:CircularProgressIndicator());
        if(s.hasError)return ListTile(title:const Text('Reviews unavailable'),trailing:TextButton(onPressed:refresh,child:const Text('Retry')));
        final items=s.data ?? [];
        if(items.isEmpty)return const ListTile(title:Text('No submitted videos'));
        return Column(children:[
          for(final v in items) Card(child:ListTile(title:Text(v.title),
            subtitle:Text(v.channelName + ' · ' + v.provider + ' · ' + v.state),
            trailing:Wrap(mainAxisSize:MainAxisSize.min,children:[
              if(v.state == 'pending') IconButton(tooltip:'Verify and approve',onPressed:working?null:()=>review(v,'approved'),icon:const Icon(Icons.check_circle_outline)),
              if(v.state == 'approved') IconButton(tooltip:'Hide',onPressed:working?null:()=>review(v,'hidden'),icon:const Icon(Icons.visibility_off_outlined)),
              if(v.state == 'approved') IconButton(tooltip:'Unavailable',onPressed:working?null:()=>review(v,'unavailable'),icon:const Icon(Icons.block)),
            ]),
          )),
        ]);
      }),
    ]),
  );
}

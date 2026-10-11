import 'package:flutter/material.dart';
import 'video_admin_api.dart';

class VideoCurationScreen extends StatefulWidget {
  const VideoCurationScreen({required this.api, this.accountKey = '', super.key});
  final VideoAdminApi api;
  final String accountKey;
  @override State<VideoCurationScreen> createState() => _VideoCurationScreenState();
}
class _VideoCurationScreenState extends State<VideoCurationScreen> {
  final url = TextEditingController(), title = TextEditingController(), channel = TextEditingController();
  late Future<CuratedVideoPage> future;
  int generation = 0;
  String? cursor;
  List<CuratedVideo> additional = [];
  bool loadingMore = false, pagingFailed = false;
  Future<CuratedVideoPage> firstPage() {
    final current = generation;
    return widget.api.page().then((page) {
      if (mounted && current == generation) cursor = page.nextCursor;
      return page;
    });
  }
  @override void initState() { super.initState(); future = firstPage(); }
  @override void didUpdateWidget(covariant VideoCurationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.api != widget.api || oldWidget.accountKey != widget.accountKey) {
      url.clear(); title.clear(); channel.clear();
      setState(() {
        generation++; cursor = null; additional = [];
        loadingMore = false; pagingFailed = false; working = false; error = null;
        future = firstPage();
      });
    }
  }
  bool working = false;
  String? error;
  @override void dispose(){url.dispose();title.dispose();channel.dispose();super.dispose();}
  void refresh() => setState(() {
    generation++; cursor = null; additional = []; loadingMore = false; pagingFailed = false;
    future = firstPage();
  });
  Future<void> loadMore() async {
    final before = cursor;
    if (before == null || loadingMore || working) return;
    final current = generation;
    setState(() { loadingMore = true; pagingFailed = false; });
    try {
      final page = await widget.api.page(before: before);
      if (!mounted || current != generation) return;
      setState(() {
        cursor = page.nextCursor == before ? null : page.nextCursor;
        additional = [...additional, ...page.items];
        loadingMore = false;
      });
    } catch (_) {
      if (mounted && current == generation) {
        setState(() { loadingMore = false; pagingFailed = true; });
      }
    }
  }
  Future<void> submit() async {
    if (working) return;
    final account = widget.accountKey;
    setState(() {working = true; error = null;});
    try {await widget.api.submit(url.text,title.text,channel.text);
      if (mounted && account == widget.accountKey) {url.clear();title.clear();channel.clear();refresh();}
    } catch (_) {if (mounted && account == widget.accountKey) setState(() => error = 'Submission failed: check URL, permission and connection');}
    finally {if (mounted && account == widget.accountKey) setState(() => working = false);}
  }
  Future<void> review(CuratedVideo v,String state) async {
    if (working) return;
    final account = widget.accountKey;
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
    if (state == 'pending') {
      final confirmed = await showDialog<bool>(context: context,builder:(c)=>AlertDialog(
        title:const Text('Return video to review?'),
        content:const Text('This will not publish it. Verify the official embed and provider rights again before approval.'),
        actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Reopen'))],
      ));
      if (confirmed != true) return;
    }
    if (!mounted || account != widget.accountKey) return;
    setState(() {working = true;error = null;});
    try {await widget.api.review(v.id,state,evidence,
      expectedState:state == 'pending' ? v.state : null);if (mounted && account == widget.accountKey) refresh();}
    catch (_) {if (mounted && account == widget.accountKey) setState(() => error = 'Review failed or item changed. Refresh and retry.');}
    finally {if (mounted && account == widget.accountKey) setState(() => working = false);}
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
      FutureBuilder<CuratedVideoPage>(future:future,builder:(context,s){
        if(s.connectionState != ConnectionState.done)return const Center(child:CircularProgressIndicator());
        if(s.hasError)return ListTile(title:const Text('Reviews unavailable'),trailing:TextButton(onPressed:refresh,child:const Text('Retry')));
        final seen = <String>{};
        final items = <CuratedVideo>[
          for (final v in [...?s.data?.items, ...additional])
            if (seen.add(v.id)) v,
        ];
        if(items.isEmpty)return const ListTile(title:Text('No submitted videos'));
        return Column(children:[
          for(final v in items) Card(child:ListTile(title:Text(v.title),
            subtitle:Text('${v.channelName} · ${v.provider} · ${v.state}'),
            trailing:Wrap(spacing:4,children:[
              if(v.state == 'pending') IconButton(tooltip:'Verify and approve',onPressed:working?null:()=>review(v,'approved'),icon:const Icon(Icons.check_circle_outline)),
              if(v.state == 'approved') IconButton(tooltip:'Hide',onPressed:working?null:()=>review(v,'hidden'),icon:const Icon(Icons.visibility_off_outlined)),
              if(v.state == 'approved') IconButton(tooltip:'Unavailable',onPressed:working?null:()=>review(v,'unavailable'),icon:const Icon(Icons.block)),
              if(v.state == 'hidden' || v.state == 'unavailable') IconButton(tooltip:'Return to review',onPressed:working?null:()=>review(v,'pending'),icon:const Icon(Icons.restart_alt)),
            ]),
          )),
          if (cursor != null) Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: loadingMore ? const CircularProgressIndicator() :
              TextButton(onPressed: working ? null : loadMore,
                child: Text(pagingFailed ? 'Retry more videos' : 'Load more')),
          ),
        ]);
      }),
    ]),
  );
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// A06 private editorial workflow, intentionally separate from public fan Feed.
/// AF00 owns adding this feature-local destination to the Admin drawer.
class ReviewQueuePage extends StatefulWidget {
  const ReviewQueuePage({super.key,required this.dio,required this.accessToken,
    required this.canEdit,required this.staffId});
  final Dio dio;
  final Future<String?> Function() accessToken;
  final bool canEdit;
  final String staffId;
  @override State<ReviewQueuePage> createState()=>_ReviewQueuePageState();
}
class _ReviewQueuePageState extends State<ReviewQueuePage> {
  List<Map<String,dynamic>> posts=[];
  String filter='in_review',error='';
  bool loading=true,busy=false;
  int generation=0;
  final filters=const ['draft','in_review','scheduled','published','hidden'];
  @override void initState(){super.initState();load();}
  @override void didUpdateWidget(covariant ReviewQueuePage oldWidget){
    super.didUpdateWidget(oldWidget);
    if(!identical(oldWidget.dio,widget.dio)||
       !identical(oldWidget.accessToken,widget.accessToken)||
       oldWidget.staffId!=widget.staffId||oldWidget.canEdit!=widget.canEdit){
      generation++;posts=[];error='';loading=true;busy=false;load();
    }
  }
  @override void dispose(){generation++;super.dispose();}
  Future<Options> auth() async{
    final token=await widget.accessToken();
    if(token==null||token.isEmpty)throw StateError('Session expired');
    return Options(headers:{'Authorization':'Bearer $token'});
  }
  Future<void> load()async{
    final gen=generation;
    if(!widget.canEdit){if(mounted)setState((){loading=false;error='Content editor access required';});return;}
    if(mounted)setState((){loading=true;error='';});
    try{
      final options=await auth();
      final response=await widget.dio.get<List<dynamic>>('/v1/admin/feed/review',
        queryParameters:{'state':filter},options:options);
      if(!mounted||generation!=gen)return;
      setState((){
        posts=(response.data??[]).whereType<Map>().map((p)=>p.map(
          (key,value)=>MapEntry(key.toString(),value))).toList();
        loading=false;
      });
    }catch(_){
      if(mounted&&generation==gen)setState((){loading=false;error='Review queue unavailable. Check staff session or connection.';});
    }
  }
  Future<DateTime?> scheduleTime() async{
    final date=await showDatePicker(context:context,firstDate:DateTime.now(),lastDate:DateTime.now().add(const Duration(days:365)));
    if(date==null||!mounted)return null;
    final time=await showTimePicker(context:context,initialTime:TimeOfDay.now());
    if(time==null)return null;
    return DateTime(date.year,date.month,date.day,time.hour,time.minute);
  }
  Future<void> editDraft(Map<String,dynamic> post) async {
    if(busy||!widget.canEdit||post['createdBy']!=widget.staffId)return;
    final gen=generation,sourceDio=widget.dio;
    final id=post['id']?.toString()??'',revision=post['revision'];
    if(id.isEmpty||revision is! int||post['state']!='draft')return;
    final body=TextEditingController(text:post['body']?.toString()??'');
    final transcript=TextEditingController(text:post['transcript']?.toString()??'');
    try {
      final save=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
        title:const Text('Edit draft'),
        content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
          TextField(controller:body,maxLines:4,maxLength:5000,
            decoration:const InputDecoration(labelText:'Original post text')),
          if(post['kind']=='audio')TextField(controller:transcript,maxLines:3,maxLength:15000,
            decoration:const InputDecoration(labelText:'Accessible audio transcript')),
          const Text('The Masana author and approved media remain unchanged.'),
        ])),
        actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Save revision'))]));
      if(save!=true||!mounted||gen!=generation)return;
      if(body.text.trim().isEmpty&&post['kind']=='text')return;
      if(post['kind']=='audio'&&transcript.text.trim().isEmpty)return;
      setState(()=>busy=true);
      final options=await auth();
      if(!mounted||gen!=generation)return;
      options.headers!['Idempotency-Key']='edit-${DateTime.now().microsecondsSinceEpoch}';
      final media=post['media'];
      await sourceDio.patch<void>('/v1/admin/feed/posts/$id/draft',options:options,data:{
        'authorMasanaId':post['authorMasanaId'],
        'kind':post['kind'],'body':body.text.trim(),
        'media':media is List?media:[],
        'transcript':post['kind']=='audio'?transcript.text.trim():null,
        'expectedRevision':revision,
      });
      if(mounted&&gen==generation)await load();
    }on DioException catch(e){
      if(mounted&&gen==generation)setState(()=>error=e.response?.statusCode==409
        ?'Draft was edited by someone else. Refresh before trying again.'
        :e.response?.statusCode==403?'Only the draft creator can change its text.'
        :'Draft update failed. Check connection and reload.');
    }catch(_){
      if(mounted&&gen==generation)setState(()=>error='Draft update could not be confirmed. Reload before retry.');
    }finally{
      body.dispose();transcript.dispose();
      if(mounted&&gen==generation)setState(()=>busy=false);
    }
  }
  Future<void> action(Map<String,dynamic> p,String operation) async{
    if(busy||!widget.canEdit)return;
    final gen=generation,sourceDio=widget.dio;
    final id=p['id']?.toString()??'',revision=p['revision'];
    if(id.isEmpty||revision is! int)return;
    if((operation=='approve'||operation=='schedule')&&widget.staffId==p['createdBy']){
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('A different editor must approve your draft.')));
      return;
    }
    DateTime? due;
    if(operation=='schedule'){
      due=await scheduleTime();
      if(due==null||due.isBefore(DateTime.now().add(const Duration(minutes:1))))return;
    }
    if(!mounted||generation!=gen)return;
    final proceed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text('${operation.replaceAll('_',' ')} post?'),
      content:Text('Review the Masana identity, licensed media and text before applying this audited action.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
    if(proceed!=true||!mounted||generation!=gen)return;
    setState(()=>busy=true);
    try{
      final options=await auth();
      if(!mounted||generation!=gen)return;
      options.headers!['Idempotency-Key']='review-${DateTime.now().microsecondsSinceEpoch}';
      await sourceDio.post<void>('/v1/admin/feed/posts/$id/transition',options:options,
        data:{'action':operation,'expectedRevision':revision,
          if(due!=null)'scheduledAt':due.toUtc().toIso8601String()});
      if(!mounted||generation!=gen)return;
      await load();
    }on DioException catch(e){
      if(!mounted||generation!=gen)return;
      setState(()=>error=e.response?.statusCode==409?'Another editor changed this post. Refresh before retry.'
        :e.response?.statusCode==403?'Approval denied. Check reviewer identity and permissions.'
        :'Action failed; refresh before retrying.');
    }catch(_){if(mounted&&generation==gen)setState(()=>error='Connection or session unavailable. Refresh before retrying.');}
    finally{if(mounted&&generation==gen)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context){
    if(!widget.canEdit)return const Center(child:Text('Content editor access required'));
    return Column(children:[
      Padding(padding:const EdgeInsets.all(12),child:Row(children:[
        Expanded(child:DropdownButtonFormField<String>(
          value:filter,decoration:const InputDecoration(labelText:'Editorial status'),
          items:filters.map((f)=>DropdownMenuItem(value:f,child:Text(f.replaceAll('_',' ')))).toList(),
          onChanged:busy?null:(v){if(v!=null){setState(()=>filter=v);load();}})),
        IconButton(tooltip:'Reload review queue',onPressed:busy?null:load,icon:const Icon(Icons.refresh)),
      ])),
      if(error.isNotEmpty)MaterialBanner(content:Text(error),actions:[TextButton(onPressed:load,child:const Text('Retry'))]),
      Expanded(child:loading?const Center(child:CircularProgressIndicator()):
        posts.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
          const Text('No posts in this review state.'),TextButton(onPressed:load,child:const Text('Refresh'))])):
        ListView.builder(itemCount:posts.length,itemBuilder:(context,i){
          final p=posts[i],state=p['state']?.toString()??'';
          final canApprove=p['createdBy']!=widget.staffId;
          return Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(
            crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text('${p['kind']??'post'} · ${p['authorMasanaId']??'unknown Masana'}',
                style:Theme.of(context).textTheme.titleMedium),
              const SizedBox(height:6),
              SelectableText(p['body']?.toString()??''),
              if(p['transcript']!=null)Text('Transcript: ${p['transcript']}'),
              if(p['scheduledAt']!=null)Text('Scheduled: ${p['scheduledAt']}'),
              Text('Revision ${p['revision']} · ${state.replaceAll('_',' ')}'),
              Wrap(spacing:8,runSpacing:6,children:[
                if(state=='draft')...[
                  if(p['createdBy']==widget.staffId)TextButton(onPressed:busy?null:()=>editDraft(p),child:const Text('Edit draft')),
                  FilledButton(onPressed:busy?null:()=>action(p,'submit'),child:const Text('Send to review')),
                ],
                if(state=='in_review')...[
                  TextButton(onPressed:busy?null:()=>action(p,'revise'),child:const Text('Return for revision')),
                  FilledButton(onPressed:busy||!canApprove?null:()=>action(p,'approve'),child:const Text('Approve & publish')),
                  OutlinedButton(onPressed:busy||!canApprove?null:()=>action(p,'schedule'),child:const Text('Schedule')),
                ],
                if(state=='scheduled'||state=='published')
                  OutlinedButton(onPressed:busy?null:()=>action(p,'take_down'),child:const Text('Take down')),
              ]),
            ])));
        })),
    ]);
  }
}

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'missions_admin_client.dart';

const _missionBlue = Color(0xFF2264CF);

/// A07/A08 compact Android Admin. All writes require server-side roles and revision CAS.
/// Offline data is read-only; a retry never silently resubmits a mutation.
class MissionsAdminScreen extends StatefulWidget {
  const MissionsAdminScreen({super.key, required this.client});
  final MissionsAdminClient client;
  @override State<MissionsAdminScreen> createState() => _MissionsAdminScreenState();
}
class _MissionsAdminScreenState extends State<MissionsAdminScreen> {
  bool loading = true, busy = false;
  Object? error;
  List<MissionView> missions = [];
  List<MissionSlotView> slots = [];
  MissionView? selected;
  MissionScorecard? scorecard;
  @override void initState() { super.initState(); refresh(); }
  String _problem(Object e) {
    if(e is DioException) {
      final code=e.response?.statusCode;
      if(code==401) return 'Session expired. Sign in to continue.';
      if(code==403) return 'Staff role required. Ask an administrator for access.';
      if(code==409) return 'Another editor updated this item. Reload before continuing.';
      if(code==410) return 'Mission publishing is disabled by Operations.';
      if(code==422) return 'Invalid mission, schedule, budget, or approved Masana.';
      if(code==429) return 'Rate limited. Try again later.';
    }
    return 'Connection or service unavailable. Retry when online.';
  }
  void _notice(String message) {
    if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(message)));
  }
  Future<void> refresh() async {
    if(!mounted) return;
    setState(() {loading=true;error=null;});
    try {
      final current = await widget.client.missions();
      MissionView? focus;
      for(final m in current) { if(m.id == selected?.id) {focus=m;break;} }
      if(focus==null && current.isNotEmpty) focus=current.first;
      final s = focus==null ? <MissionSlotView>[] : await widget.client.slots(focus.id);
      final summary = focus==null ? null : await widget.client.scorecard(focus.id);
      if(mounted) setState((){
        missions=current;selected=focus;slots=s;scorecard=summary;loading=false;
      });
    } catch(e) {
      if(mounted) setState(() {error=e;loading=false;});
    }
  }
  Future<void> _showMissionForm() async {
    final character=TextEditingController(),objective=TextEditingController(),
      topic=TextEditingController(),budget=TextEditingController(text:'1000');
    DateTime date=DateTime.now();
    final formKey=GlobalKey<FormState>();
    try {
      final submitted=await showDialog<bool>(context:context,builder:(ctx)=>StatefulBuilder(
        builder:(ctx,update)=>AlertDialog(
          title:const Text('New weekly mission'),
          content:SingleChildScrollView(child:Form(key:formKey,child:Column(
            mainAxisSize:MainAxisSize.min,children:[
              const Text('Staff-controlled draft. All content needs approval at launch.'),
              TextFormField(controller:character,decoration:const InputDecoration(
                labelText:'Approved Masana ID'),validator:(v)=>(v==null||v.trim().length<3)?'Required':null),
              TextFormField(controller:objective,maxLength:600,maxLines:2,
                decoration:const InputDecoration(labelText:'Weekly objective'),
                validator:(v)=>(v==null||v.trim().length<8)?'At least 8 characters':null),
              TextFormField(controller:topic,maxLength:140,
                decoration:const InputDecoration(labelText:'Topic focus'),
                validator:(v)=>(v==null||v.trim().length<2)?'Required':null),
              TextFormField(controller:budget,keyboardType:TextInputType.number,
                decoration:const InputDecoration(labelText:'Max generation cost (integer units)'),
                validator:(v)=>(v==null||!RegExp(r'^(0|[1-9][0-9]{0,14})$').hasMatch(v))
                  ?'Enter whole cost units':null),
              ListTile(title:const Text('Mission week (Monday starts)'),
                subtitle:Text('${date.year}-${date.month.toString().padLeft(2,'0')}-${date.day.toString().padLeft(2,'0')}'),
                trailing:const Icon(Icons.calendar_today),
                onTap:()async{final d=await showDatePicker(context:ctx,initialDate:date,
                  firstDate:DateTime(2025),lastDate:DateTime(2035));
                  if(d!=null)update(()=>date=d);}),
            ]))),
          actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
            FilledButton(onPressed:(){if(formKey.currentState?.validate()==true)
              Navigator.pop(ctx,true);},child:const Text('Save draft'))],
        )));
      if(submitted!=true||busy)return;
      final monday=date.subtract(Duration(days:date.weekday-1));
      final week='${monday.year.toString().padLeft(4,'0')}-${monday.month.toString().padLeft(2,'0')}-${monday.day.toString().padLeft(2,'0')}';
      setState(()=>busy=true);
      try{
        await widget.client.create(characterId:character.text.trim(),weekStart:week,
          objective:objective.text.trim(),topicFocus:topic.text.trim(),budgetMinor:budget.text.trim());
        if(mounted)await refresh();
      }catch(e){_notice(_problem(e));}
      finally{if(mounted)setState(()=>busy=false);}
    }finally{character.dispose();objective.dispose();topic.dispose();budget.dispose();}
  }
  Future<void> _changeState(String state) async {
    final m=selected;if(m==null||busy)return;
    final yes=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(state=='active'?'Activate publication schedule?':'Pause mission?'),
      content:Text(state=='active'
        ?'Only pre-approved text slots will be published when their UTC time arrives. Global posting may still be disabled.'
        :'Stop claiming future slots; an in-flight Feed operation can only be stopped by the global publisher gate.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
    if(yes!=true)return;
    setState(()=>busy=true);
    try{await widget.client.state(m,state);if(mounted)await refresh();}
    catch(e){_notice(_problem(e));}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> _showSlotForm() async {
    final m=selected;if(m==null)return;
    final topic=TextEditingController(),body=TextEditingController(),
      cost=TextEditingController(text:'0');
    DateTime date=DateTime.now();TimeOfDay clock=const TimeOfDay(hour:12,minute:0);
    final form=GlobalKey<FormState>();
    try{
      final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>StatefulBuilder(
        builder:(ctx,update)=>AlertDialog(
          title:const Text('Schedule text post'),
          content:SingleChildScrollView(child:Form(key:form,child:Column(
            mainAxisSize:MainAxisSize.min,children:[
              const Text('Date and time are explicitly UTC. Rich media needs the separate approved media workflow.'),
              TextFormField(controller:topic,maxLength:140,decoration:const InputDecoration(labelText:'Topic'),
                validator:(v)=>(v==null||v.trim().length<2)?'Required':null),
              TextFormField(controller:body,minLines:3,maxLines:6,maxLength:6000,
                decoration:const InputDecoration(labelText:'Editorially reviewed text'),
                validator:(v)=>(v==null||v.trim().isEmpty)?'Required':null),
              TextFormField(controller:cost,keyboardType:TextInputType.number,
                decoration:const InputDecoration(labelText:'Expected generation cost (integer)'),
                validator:(v)=>(v==null||!RegExp(r'^(0|[1-9][0-9]{0,14})$').hasMatch(v))?'Whole units only':null),
              ListTile(title:const Text('UTC date'),subtitle:Text('${date.year}-${date.month}-${date.day}'),
                onTap:()async{final d=await showDatePicker(context:ctx,initialDate:date,
                  firstDate:DateTime(2025),lastDate:DateTime(2035));
                  if(d!=null)update(()=>date=d);}),
              ListTile(title:const Text('UTC time'),subtitle:Text(clock.format(ctx)),
                onTap:()async{final t=await showTimePicker(context:ctx,initialTime:clock);
                  if(t!=null)update(()=>clock=t);}),
            ]))),
          actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
            FilledButton(onPressed:(){if(form.currentState?.validate()==true)
              Navigator.pop(ctx,true);},child:const Text('Save draft'))])));
      if(confirmed!=true||busy)return;
      final at=DateTime.utc(date.year,date.month,date.day,clock.hour,clock.minute).toIso8601String();
      setState(()=>busy=true);
      try{await widget.client.addSlot(m.id,atUtc:at,topic:topic.text.trim(),
        body:body.text.trim(),costMinor:cost.text.trim());
        if(mounted)await refresh();
      }catch(e){_notice(_problem(e));}
      finally{if(mounted)setState(()=>busy=false);}
    }finally{topic.dispose();body.dispose();cost.dispose();}
  }
  Future<void> _slotAction(MissionSlotView slot,{required bool retry})async{
    if(busy)return;
    final yes=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(retry?'Retry unchanged publication key?':'Approve text post?'),
      content:Text(slot.draftBody, maxLines:8,overflow:TextOverflow.ellipsis),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
    if(yes!=true)return;
    setState(()=>busy=true);
    try{if(retry){await widget.client.retry(slot);}else{await widget.client.approve(slot);}
      if(mounted)await refresh();
    }catch(e){_notice(_problem(e));}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Missions & calendar'),backgroundColor:_missionBlue,
      foregroundColor:Colors.white,actions:[
        IconButton(onPressed:loading||busy?null:refresh,tooltip:'Reload missions',
          icon:const Icon(Icons.refresh))]),
    floatingActionButton:error!=null&&missions.isEmpty?null:FloatingActionButton.extended(
      onPressed:busy?null:_showMissionForm,icon:const Icon(Icons.add),
      label:const Text('New mission')),
    body:loading&&missions.isEmpty?const Center(child:CircularProgressIndicator()):
      error!=null&&missions.isEmpty?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
        Text(_problem(error!)),TextButton(onPressed:refresh,child:const Text('Retry'))])):
      ListView(padding:const EdgeInsets.fromLTRB(16,12,16,96),children:[
        if(error!=null)Card(child:ListTile(leading:const Icon(Icons.cloud_off),
          title:const Text('Offline: showing cached session data (read-only)'),
          subtitle:Text(_problem(error!)),trailing:TextButton(onPressed:refresh,child:const Text('Retry')))),
        const Text('All posts are reviewed by staff before publication. No autonomous spending.'),
        if(missions.isEmpty)const Padding(padding:EdgeInsets.all(18),
          child:Text('No weekly missions. Create one for an approved Masana.')),
        if(missions.isNotEmpty)DropdownButtonFormField<String>(
          key:ValueKey(selected?.id),initialValue:selected?.id,
          decoration:const InputDecoration(labelText:'Week / Masana'),
          items:[for(final m in missions)DropdownMenuItem(value:m.id,
            child:Text('${m.weekStart} · ${m.characterId}',overflow:TextOverflow.ellipsis))],
          onChanged:busy||error!=null?null:(id){setState((){
            selected=missions.firstWhere((m)=>m.id==id);slots=[];scorecard=null;});refresh();}),
        if(selected!=null)...[
          const SizedBox(height:12),
          Text(selected!.objective,style:Theme.of(context).textTheme.titleLarge),
          Text('Topic: ${selected!.topicFocus} · ${selected!.state}'),
          Text('Cost units: ${selected!.spentMinor} / ${selected!.budgetMinor}'),
          Wrap(spacing:8,children:[
            if(selected!.state!='active')OutlinedButton.icon(
              onPressed:busy||error!=null?null:()=>_changeState('active'),
              icon:const Icon(Icons.play_arrow),label:const Text('Activate')),
            if(selected!.state=='active')OutlinedButton.icon(
              onPressed:busy||error!=null?null:()=>_changeState('paused'),
              icon:const Icon(Icons.pause),label:const Text('Pause')),
            FilledButton.tonalIcon(onPressed:busy||error!=null?null:_showSlotForm,
              icon:const Icon(Icons.event),label:const Text('Add text slot')),
          ]),
          if(scorecard!=null)Card(child:ListTile(title:const Text('Measured scorecard'),
            subtitle:Text('Published ${scorecard!.published} · Awaiting ${scorecard!.approved} · Failed ${scorecard!.failed}\nEngagement: ${scorecard!.actualEngagement?.toString() ?? 'Not measured yet'}'))),
          const Divider(),
          Text('Scheduled slots (UTC)',style:Theme.of(context).textTheme.titleMedium),
          if(slots.isEmpty)const ListTile(title:Text('No slots scheduled')),
          for(final slot in slots)Card(child:Column(children:[
            ListTile(title:Text(slot.topicSafe()),subtitle:Text(
              '${slot.scheduledAt} · ${slot.state} · ${slot.estimatedCostMinor} cost units\n${slot.draftBody}',
              maxLines:5,overflow:TextOverflow.ellipsis)),
            if(slot.lastError!=null)Text('Failure: ${slot.lastError}',
              style:TextStyle(color:Theme.of(context).colorScheme.error)),
            if(slot.postId!=null)Text('Published post: ${slot.postId}'),
            if(slot.state=='draft')Align(alignment:Alignment.centerRight,child:TextButton(
              onPressed:busy||error!=null?null:()=>_slotAction(slot,retry:false),
              child:const Text('Review & approve'))),
            if(slot.state=='failed')Align(alignment:Alignment.centerRight,child:TextButton(
              onPressed:busy||error!=null?null:()=>_slotAction(slot,retry:true),
              child:const Text('Review & retry'))),
          ])),
        ],
        if(busy)const LinearProgressIndicator(),
      ]),
  );
}
extension on MissionSlotView {
  String topicSafe()=>kind=='text'?'Text post':'Media post';
}

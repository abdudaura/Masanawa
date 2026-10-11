import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// A05 staff authoring, no member-facing publisher. Media picker uses existing approved S3 asset catalog.
class ContentStudioPage extends StatefulWidget {
  const ContentStudioPage({super.key,required this.dio,required this.accessToken,
    required this.approvedMasana,required this.canEdit,this.pickApprovedMedia});
  final Dio dio;
  final Future<String?> Function() accessToken;
  final Future<List<({String id,String name})>> Function() approvedMasana;
  final bool canEdit;
  final Future<List<String>> Function()? pickApprovedMedia;
  @override State<ContentStudioPage> createState()=>_ContentStudioPageState();
}
class _ContentStudioPageState extends State<ContentStudioPage> {
  final text=TextEditingController(),transcript=TextEditingController();
  String? selected,problem;
  String kind='text';
  List<String> media=[];
  List<({String id,String name})> authors=[];
  bool loading=true,submitting=false,done=false;
  String? _draftKey;
  int _generation=0;
  @override void initState(){super.initState();load();}
  @override
  void didUpdateWidget(covariant ContentStudioPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.dio,oldWidget.dio) ||
        !identical(widget.accessToken,oldWidget.accessToken) ||
        !identical(widget.approvedMasana,oldWidget.approvedMasana) ||
        widget.canEdit!=oldWidget.canEdit) {
      _generation++;
      text.clear();transcript.clear();
      media=[];authors=[];selected=null;_draftKey=null;
      loading=true;submitting=false;done=false;problem=null;
      load();
    }
  }
  @override void dispose(){_generation++;text.dispose();transcript.dispose();super.dispose();}
  Future<void> load() async{
    final gen=_generation;
    if(!widget.canEdit){setState(()=>loading=false);return;}
    try{final values=await widget.approvedMasana();if(!mounted||gen!=_generation)return;
      setState((){authors=values;selected=values.isEmpty?null:values.first.id;loading=false;problem=null;});
    }catch(_){if(mounted&&gen==_generation)setState((){loading=false;problem='Unable to load approved Masana';});}
  }
  Future<void> chooseMedia()async{
    final gen=_generation;
    if(widget.pickApprovedMedia==null)return;
    try{final ids=await widget.pickApprovedMedia!();if(mounted&&gen==_generation)setState((){media=ids.take(kind=='image'?10:1).toList();_draftKey=null;});}
    catch(_){if(mounted&&gen==_generation)setState(()=>problem='Media library unavailable');}
  }
  Future<void> saveDraft() async{
    final gen=_generation;
    final sourceDio=widget.dio;
    if(submitting||selected==null)return;
    if(kind=='text'&&text.text.trim().isEmpty){setState(()=>problem='Post text required');return;}
    if(kind!='text'&&media.isEmpty){setState(()=>problem='Select approved media');return;}
    if(kind=='audio'&&transcript.text.trim().isEmpty){setState(()=>problem='Audio transcript required');return;}
    setState((){submitting=true;problem=null;done=false;});
    try{
      final token=await widget.accessToken();
      if(!mounted||gen!=_generation)return;
      if(token==null||token.isEmpty)throw StateError('Session expired');
      final key=_draftKey??='feed-${DateTime.now().microsecondsSinceEpoch}';
      await sourceDio.post<void>('/v1/admin/feed/drafts',
        data:{'authorMasanaId':selected,'kind':kind,'body':text.text.trim(),
          'media':media,'transcript':kind=='audio'?transcript.text:null},
        options:Options(headers:{'Authorization':'Bearer $token','Idempotency-Key':key}));
      if(!mounted||gen!=_generation)return;
      setState((){done=true;media=[];text.clear();transcript.clear();_draftKey=null;});
    }on DioException catch(e){
      if(mounted&&gen==_generation)setState(()=>problem=e.response?.statusCode==403?'You do not have content editor access':e.response?.statusCode==409?'Draft changed or request key conflicted. Review before retry.':'Draft save failed; retry with the same key after checking connection');
    }catch(_){if(mounted&&gen==_generation)setState(()=>problem='Draft unavailable; check session and retry');}
    finally{if(mounted&&gen==_generation)setState(()=>submitting=false);}
  }
  @override Widget build(BuildContext context){
    if(!widget.canEdit)return const Center(child:Text('Content editor permission required'));
    if(loading)return const Center(child:CircularProgressIndicator());
    return ListView(padding:const EdgeInsets.all(16),children:[
      Text('Content Studio',style:Theme.of(context).textTheme.headlineSmall),
      if(problem!=null)MaterialBanner(content:Text(problem!),actions:[TextButton(onPressed:load,child:const Text('Retry'))]),
      if(done)const ListTile(leading:Icon(Icons.check_circle_outline),title:Text('Draft saved for editorial review')),
      if(authors.isEmpty)const Text('No approved Masana available. Approve a profile first.'),
      DropdownButtonFormField<String>(value:selected,decoration:const InputDecoration(labelText:'Publish as Masana'),
        items:authors.map((a)=>DropdownMenuItem(value:a.id,child:Text(a.name))).toList(),
        onChanged:submitting?null:(value)=>setState((){selected=value;_draftKey=null;})),
      const SizedBox(height:16),
      SegmentedButton<String>(segments:const [
        ButtonSegment(value:'text',label:Text('Text')),ButtonSegment(value:'image',label:Text('Image')),
        ButtonSegment(value:'audio',label:Text('Audio'))],
        selected:{kind},onSelectionChanged:submitting?null:(v)=>setState((){kind=v.first;media=[];_draftKey=null;})),
      TextField(controller:text,maxLength:5000,maxLines:5,onChanged:(_)=>_draftKey=null,decoration:const InputDecoration(labelText:'Post body')),
      if(kind!='text')ListTile(title:Text('${media.length} approved media selected'),
        subtitle:const Text('Only licensed uploads from the existing media library'),
        trailing:TextButton(onPressed:submitting?null:chooseMedia,child:const Text('Choose'))),
      if(kind=='audio')TextField(controller:transcript,maxLength:15000,maxLines:4,onChanged:(_)=>_draftKey=null,
        decoration:const InputDecoration(labelText:'Accessible audio transcript')),
      const SizedBox(height:24),
      FilledButton.icon(onPressed:submitting||selected==null?null:saveDraft,
        icon:submitting?const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)):const Icon(Icons.publish),
        label:const Text('Save draft')),
    ]);
  }
}

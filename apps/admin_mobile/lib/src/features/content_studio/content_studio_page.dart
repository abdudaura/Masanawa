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
  @override void initState(){super.initState();load();}
  @override void dispose(){text.dispose();transcript.dispose();super.dispose();}
  Future<void> load() async{
    if(!widget.canEdit){setState(()=>loading=false);return;}
    try{final values=await widget.approvedMasana();if(!mounted)return;
      setState((){authors=values;selected=values.isEmpty?null:values.first.id;loading=false;problem=null;});
    }catch(_){if(mounted)setState((){loading=false;problem='Unable to load approved Masana';});}
  }
  Future<void> chooseMedia()async{
    if(widget.pickApprovedMedia==null)return;
    try{final ids=await widget.pickApprovedMedia!();if(mounted)setState(()=>media=ids.take(kind=='image'?10:1).toList());}
    catch(_){if(mounted)setState(()=>problem='Media library unavailable');}
  }
  Future<void> publish() async{
    if(submitting||selected==null)return;
    if(kind=='text'&&text.text.trim().isEmpty){setState(()=>problem='Post text required');return;}
    if(kind!='text'&&media.isEmpty){setState(()=>problem='Select approved media');return;}
    if(kind=='audio'&&transcript.text.trim().isEmpty){setState(()=>problem='Audio transcript required');return;}
    setState((){submitting=true;problem=null;done=false;});
    try{
      final token=await widget.accessToken();if(token==null||token.isEmpty)throw StateError('Session expired');
      final key='feed-${DateTime.now().microsecondsSinceEpoch}';
      await widget.dio.post<void>('/v1/admin/feed/posts',
        data:{'authorMasanaId':selected,'kind':kind,'body':text.text.trim(),
          'media':media,'transcript':kind=='audio'?transcript.text:null},
        options:Options(headers:{'Authorization':'Bearer $token','Idempotency-Key':key}));
      if(!mounted)return;
      setState((){done=true;media=[];text.clear();transcript.clear();});
    }on DioException catch(e){
      if(mounted)setState(()=>problem=e.response?.statusCode==403?'You do not have content editor access':'Publish failed; retry after checking connection');
    }catch(_){if(mounted)setState(()=>problem='Publish unavailable; check session and retry');}
    finally{if(mounted)setState(()=>submitting=false);}
  }
  @override Widget build(BuildContext context){
    if(!widget.canEdit)return const Center(child:Text('Content editor permission required'));
    if(loading)return const Center(child:CircularProgressIndicator());
    return ListView(padding:const EdgeInsets.all(16),children:[
      Text('Content Studio',style:Theme.of(context).textTheme.headlineSmall),
      if(problem!=null)MaterialBanner(content:Text(problem!),actions:[TextButton(onPressed:load,child:const Text('Retry'))]),
      if(done)const ListTile(leading:Icon(Icons.check_circle_outline),title:Text('Published successfully')),
      if(authors.isEmpty)const Text('No approved Masana available. Approve a profile first.'),
      DropdownButtonFormField<String>(value:selected,decoration:const InputDecoration(labelText:'Publish as Masana'),
        items:authors.map((a)=>DropdownMenuItem(value:a.id,child:Text(a.name))).toList(),
        onChanged:submitting?null:(value)=>setState(()=>selected=value)),
      const SizedBox(height:16),
      SegmentedButton<String>(segments:const [
        ButtonSegment(value:'text',label:Text('Text')),ButtonSegment(value:'image',label:Text('Image')),
        ButtonSegment(value:'audio',label:Text('Audio'))],
        selected:{kind},onSelectionChanged:submitting?null:(v)=>setState((){kind=v.first;media=[];})),
      TextField(controller:text,maxLength:5000,maxLines:5,decoration:const InputDecoration(labelText:'Post body')),
      if(kind!='text')ListTile(title:Text('${media.length} approved media selected'),
        subtitle:const Text('Only licensed uploads from the existing media library'),
        trailing:TextButton(onPressed:submitting?null:chooseMedia,child:const Text('Choose'))),
      if(kind=='audio')TextField(controller:transcript,maxLength:15000,maxLines:4,
        decoration:const InputDecoration(labelText:'Accessible audio transcript')),
      const SizedBox(height:24),
      FilledButton.icon(onPressed:submitting||selected==null?null:publish,
        icon:submitting?const SizedBox(width:16,height:16,child:CircularProgressIndicator(strokeWidth:2)):const Icon(Icons.publish),
        label:const Text('Publish')),
    ]);
  }
}
